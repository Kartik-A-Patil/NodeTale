import { Project } from '../models/story';
import { getStorageAdapter } from './storage';
import { Channel, sendBytes } from './liveShare';

// Editing a story together, live: everyone works on their own screen, on
// any board, and changes (and media) sync between them. One person hosts; each guest is connected to
// the host (invited with a link and a reply code, see liveShare.ts), and every
// change goes through the host, who passes it on to everyone in one order.
//
// What's synced is an "entity": a node, a connection, or the project's
// settings (name, variables, media list, boards). The later change to an
// entity wins. Consistency: the host echoes each change back to everyone,
// its sender included. A guest ignores others' changes to an entity it has
// changed itself until its own change comes back, so whatever the host saw
// last is what everyone ends up with.

export type Access = 'edit' | 'view';
export interface Peer { id: string; name: string; color: string; access?: Access }

/** A recent change by someone else, for the activity list. */
export interface Activity { peerId: string; name: string; color: string; key: string; label: string; nodeId?: string; deleted?: boolean; at: number }
/** Something worth a line in the panel: someone left, disconnected, joined. */
export interface Notice { id: number; kind: 'joined' | 'left' | 'disconnected'; text: string; at: number }

/** One entity's new value (null: deleted). Keys: "node:<board>:<id>", "edge:<board>:<id>", "meta". */
export interface Op { key: string; value: unknown }

type Message =
  | { t: 'hello'; peer: Pick<Peer, 'id' | 'name'> }
  | { t: 'welcome'; you: Peer; peers: Peer[]; project: Project }
  | { t: 'peers'; peers: Peer[] }
  | { t: 'op'; from: string; seq: number; ops: Op[] }
  | { t: 'asset'; from: string; id: string; size: number; type: string }
  /** Said before closing on purpose, so the others can tell leaving from a lost connection. */
  | { t: 'bye'; from: string; why: 'left' | 'ended' };

// Distinct, readable on the dark canvas; the host always takes the first.
export const PEER_COLORS = ['#f97316', '#38bdf8', '#a3e635', '#f472b6', '#facc15', '#c084fc', '#2dd4bf', '#fb7185'];

interface Link {
  ch: Channel & { close?: () => void; addEventListener(type: 'close', fn: () => void): void };
  peerId?: string;
  /** Host: what this guest may do (view-only guests' changes are ignored). */
  access: Access;
  /** They said goodbye (so closing isn't a lost connection). */
  saidBye?: boolean;
  /** Files go one at a time per channel: their pieces mustn't interleave. */
  fileQueue: Promise<void>;
  incoming: { id: string; size: number; type: string; parts: ArrayBuffer[]; got: number; from: string } | null;
}

export interface SessionEvents {
  /** Changes from others (and who made them), to apply to the editor. */
  onOps?: (ops: Op[], from: string) => void;
  /** A media file someone added has arrived (and is saved). */
  onAsset?: (id: string) => void;
  /** Who's here, or the session itself, changed. */
  onChange?: () => void;
}

export class LiveSession {
  readonly role: 'host' | 'guest';
  readonly projectId: string;
  me: Peer;
  peers: Peer[] = [];
  ended: string | null = null;
  private links: Link[] = [];
  private seq = 0;
  /** Guest: entity key -> seq of its own latest unconfirmed change. */
  private pending = new Map<string, number>();
  private events: SessionEvents = {};
  /** Changes that arrived before the editor was ready for them. */
  private backlog: { ops: Op[]; from: string }[] = [];
  /** Recent changes by others, newest first. */
  activity: Activity[] = [];
  /** Recent comings and goings, newest first. */
  notices: Notice[] = [];
  private noticeId = 0;
  private listeners = new Set<() => void>();
  /** Host: the story as it is now, for people joining. */
  getProject: () => Project | null = () => null;

  constructor(role: 'host' | 'guest', projectId: string, me: Peer) {
    this.role = role;
    this.projectId = projectId;
    this.me = me;
    if (role === 'host') this.peers = [me];
  }

  // ---- for React (useSyncExternalStore) ----
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private changed() {
    this.version++;
    this.listeners.forEach((fn) => fn());
    this.events.onChange?.();
  }
  version = 0;

  /** The editor attaches here once it's loaded; earlier changes are handed over then. */
  attach(events: SessionEvents) {
    this.events = events;
    if (this.backlog.length && events.onOps) {
      for (const { ops, from } of this.backlog) events.onOps(ops, from);
      this.backlog = [];
    }
    return () => { if (this.events === events) this.events = {}; };
  }

  // ---- connections ----

  /** View-only guests can't change anything. */
  get canEdit() { return this.me.access !== 'view'; }

  /** Host: a guest whose copy has arrived joins the session, to edit or only to watch. */
  addGuest(ch: Link['ch'], access: Access = 'edit') {
    const link: Link = { ch, access, fileQueue: Promise.resolve(), incoming: null };
    this.links.push(link);
    this.listen(link);
    ch.addEventListener('close', () => this.dropLink(link));
  }

  /** Guest: join over the channel the copy arrived on; resolves with the story as it is right now. */
  join(ch: Link['ch'], name: string): Promise<Project> {
    const link: Link = { ch, access: 'edit', fileQueue: Promise.resolve(), incoming: null };
    this.links = [link];
    const welcomed = new Promise<Project>((resolve) => { this.onWelcome = resolve; });
    this.listen(link);
    ch.addEventListener('close', () => {
      const host = this.peers.find((p) => p.id !== this.me.id)?.name ?? 'the host';
      this.end(link.saidBye
        ? `${host} ended the session. You still have your own copy.`
        : `Lost the connection to ${host}. You still have your own copy; ask for a new link to rejoin.`);
    });
    // The host starts listening once our copy has arrived, which can be just
    // after we say hello: repeat it until welcomed (the host ignores repeats).
    const hello = () => this.post(link, { t: 'hello', peer: { id: this.me.id, name } });
    hello();
    const retry = setInterval(() => (this.onWelcome && !this.ended ? hello() : clearInterval(retry)), 400);
    return welcomed;
  }
  private onWelcome: ((p: Project) => void) | null = null;

  /** A line in the panel for a while: "Ana left", "Bo disconnected". */
  private notice(kind: Notice['kind'], text: string) {
    this.notices = [{ id: ++this.noticeId, kind, text, at: Date.now() }, ...this.notices].slice(0, 5);
  }

  /** Note someone's change for the activity list; repeated edits to one thing (typing, dragging) make one entry. */
  record(entry: Omit<Activity, 'at'>) {
    const at = Date.now();
    const [last] = this.activity;
    if (last && last.peerId === entry.peerId && last.key === entry.key && at - last.at < 15000) this.activity = [{ ...last, ...entry, at }, ...this.activity.slice(1)];
    else this.activity = [{ ...entry, at }, ...this.activity].slice(0, 30);
    this.changed();
  }

  private dropLink(link: Link) {
    this.links = this.links.filter((l) => l !== link);
    if (link.peerId) {
      const name = this.peers.find((p) => p.id === link.peerId)?.name ?? 'Someone';
      if (!this.ended) this.notice(link.saidBye ? 'left' : 'disconnected', link.saidBye ? `${name} left` : `${name} disconnected`);
      this.peers = this.peers.filter((p) => p.id !== link.peerId);
      this.broadcast({ t: 'peers', peers: this.peers });
      this.changed();
    }
  }

  private post(link: Link, m: Message) {
    try { link.ch.send(JSON.stringify(m)); } catch { /* closing */ }
  }
  private broadcast(m: Message, except?: Link) {
    for (const l of this.links) if (l !== except && l.peerId) this.post(l, m);
  }

  // ---- outgoing ----

  /** Your changes, to everyone. */
  sendOps(ops: Op[]) {
    if (!ops.length || this.ended || !this.canEdit) return;
    const seq = ++this.seq;
    if (this.role === 'guest') ops.forEach((op) => this.pending.set(op.key, seq));
    const m: Message = { t: 'op', from: this.me.id, seq, ops };
    if (this.role === 'host') this.broadcast(m);
    else this.links.forEach((l) => this.post(l, m));
  }

  /** A media file you added, to everyone (guests send it to the host, who passes it on). */
  shareAsset(id: string, blob: Blob) {
    const targets = this.role === 'host' ? this.links.filter((l) => l.peerId) : this.links;
    for (const l of targets) this.queueFile(l, { t: 'asset', from: this.me.id, id, size: blob.size, type: blob.type }, blob);
  }
  private queueFile(link: Link, header: Extract<Message, { t: 'asset' }>, blob: Blob) {
    link.fileQueue = link.fileQueue.then(async () => {
      this.post(link, header);
      await sendBytes(link.ch, blob);
    }).catch(() => {});
  }

  // ---- incoming ----

  private listen(link: Link) {
    link.ch.addEventListener('message', (e) => {
      if (typeof e.data !== 'string') return this.onBytes(link, e.data as ArrayBuffer);
      let m: Message;
      try { m = JSON.parse(e.data); } catch { return; }
      // Messages of the initial copy share this channel; they aren't ours.
      if (!m || typeof m !== 'object' || !('t' in m)) return;
      this.onMessage(link, m);
    });
  }

  private onMessage(link: Link, m: Message) {
    switch (m.t) {
      case 'hello': {
        if (this.role !== 'host' || link.peerId === m.peer.id) return; // a repeat
        const peer: Peer = { id: m.peer.id, name: m.peer.name || 'Guest', color: PEER_COLORS[this.peers.length % PEER_COLORS.length], access: link.access };
        link.peerId = peer.id;
        this.notice('joined', `${peer.name} joined${peer.access === 'view' ? ' (view only)' : ''}`);
        this.peers = [...this.peers.filter((p) => p.id !== peer.id), peer];
        const project = this.getProject();
        if (project) this.post(link, { t: 'welcome', you: peer, peers: this.peers, project });
        this.broadcast({ t: 'peers', peers: this.peers }, link);
        this.changed();
        return;
      }
      case 'welcome':
        this.me = m.you;
        this.peers = m.peers;
        this.changed();
        this.onWelcome?.(m.project);
        this.onWelcome = null;
        return;
      case 'peers':
        this.peers = m.peers;
        this.changed();
        return;
      case 'op':
        if (this.role === 'host') {
          if (link.access === 'view') return; // view-only: ignored, not passed on
          this.apply(m.ops, m.from);
          this.broadcast(m); // to everyone, the sender too: that's its confirmation
          return;
        }
        if (m.from === this.me.id) {
          for (const op of m.ops) if (this.pending.get(op.key) === m.seq) this.pending.delete(op.key);
          return;
        }
        this.apply(m.ops.filter((op) => !this.pending.has(op.key)), m.from);
        return;
      case 'bye':
        link.saidBye = true;
        return;
      case 'asset':
        link.incoming = { id: m.id, size: m.size, type: m.type, parts: [], got: 0, from: m.from };
        if (m.size === 0) this.finishFile(link);
        return;
    }
  }

  private onBytes(link: Link, part: ArrayBuffer) {
    const f = link.incoming;
    if (!f) return;
    f.parts.push(part);
    f.got += part.byteLength;
    if (f.got >= f.size) this.finishFile(link);
    else this.changed(); // progress for the panel
  }

  /** Media arriving right now, for "Receiving media · 40%". */
  get receiving(): { files: number; done: number; total: number } | null {
    const incoming = this.links.map((l) => l.incoming).filter((f): f is NonNullable<Link['incoming']> => !!f);
    if (!incoming.length) return null;
    return { files: incoming.length, done: incoming.reduce((s, f) => s + f.got, 0), total: incoming.reduce((s, f) => s + f.size, 0) };
  }

  private async finishFile(link: Link) {
    const f = link.incoming!;
    link.incoming = null;
    const blob = new Blob(f.parts, { type: f.type });
    await getStorageAdapter().saveAsset(blob, f.id);
    this.events.onAsset?.(f.id);
    this.changed();
    // Host passes it on to everyone else.
    if (this.role === 'host') {
      for (const l of this.links) if (l !== link && l.peerId) this.queueFile(l, { t: 'asset', from: f.from, id: f.id, size: f.size, type: f.type }, blob);
    }
  }

  private apply(ops: Op[], from: string) {
    if (!ops.length) return;
    if (this.events.onOps) this.events.onOps(ops, from);
    else this.backlog.push({ ops, from });
  }

  // ---- ending ----

  /** End (host) or leave (guest). `byChoice`: say goodbye first, so the others can tell it from a lost connection. */
  end(reason = 'The session ended.', byChoice = false) {
    if (this.ended) return;
    this.ended = reason;
    const links = this.links;
    if (byChoice) for (const l of links) this.post(l, { t: 'bye', from: this.me.id, why: this.role === 'host' ? 'ended' : 'left' });
    // A moment for the goodbye to go out before the channels close.
    setTimeout(() => { for (const l of links) { try { l.ch.close?.(); } catch { /* already closed */ } } }, byChoice ? 150 : 0);
    this.links = [];
    this.changed();
    if (current === this) {
      current = null;
      notifyCurrent();
    }
  }
}

// One session at a time, outside React: it has to survive the guest moving
// from the share page into the editor.
let current: LiveSession | null = null;
const currentListeners = new Set<() => void>();
function notifyCurrent() { currentListeners.forEach((fn) => fn()); }

export const liveSession = {
  get: () => current,
  start(session: LiveSession) {
    current?.end();
    current = session;
    notifyCurrent();
    return session;
  },
  subscribe(fn: () => void) { currentListeners.add(fn); return () => { currentListeners.delete(fn); }; },
  /**
   * For the editor's effect: returns its cleanup, which ends this project's
   * session when the editor really goes away. Deferred a tick so React's
   * StrictMode check (unmount + immediate remount in development) doesn't end it.
   */
  endWhenLeft(projectId: string | undefined) {
    clearTimeout(leaveTimer);
    return () => {
      const s = current;
      if (s && s.projectId === projectId) leaveTimer = setTimeout(() => s.end(), 0);
    };
  },
};
let leaveTimer: ReturnType<typeof setTimeout> | undefined;
/** Your name in sessions, remembered on this device. */
export const myPeerName = {
  get: () => { try { return localStorage.getItem('nodetale:myName') || ''; } catch { return ''; } },
  set: (name: string) => { try { localStorage.setItem('nodetale:myName', name); } catch { /* not kept */ } },
};
