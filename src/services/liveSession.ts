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

export interface Peer { id: string; name: string; color: string }

/** One entity's new value (null: deleted). Keys: "node:<board>:<id>", "edge:<board>:<id>", "meta". */
export interface Op { key: string; value: unknown }

type Message =
  | { t: 'hello'; peer: Pick<Peer, 'id' | 'name'> }
  | { t: 'welcome'; you: Peer; peers: Peer[]; project: Project }
  | { t: 'peers'; peers: Peer[] }
  | { t: 'op'; from: string; seq: number; ops: Op[] }
  | { t: 'asset'; from: string; id: string; size: number; type: string };

// Distinct, readable on the dark canvas; the host always takes the first.
export const PEER_COLORS = ['#f97316', '#38bdf8', '#a3e635', '#f472b6', '#facc15', '#c084fc', '#2dd4bf', '#fb7185'];

interface Link {
  ch: Channel & { close?: () => void; addEventListener(type: 'close', fn: () => void): void };
  peerId?: string;
  /** Files go one at a time per channel: their pieces mustn't interleave. */
  fileQueue: Promise<void>;
  incoming: { id: string; size: number; type: string; parts: ArrayBuffer[]; got: number; from: string } | null;
}

export interface SessionEvents {
  /** Changes from others, to apply to the editor. */
  onOps?: (ops: Op[]) => void;
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
  private backlog: Op[] = [];
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
      events.onOps(this.backlog);
      this.backlog = [];
    }
    return () => { if (this.events === events) this.events = {}; };
  }

  // ---- connections ----

  /** Host: a guest whose copy has arrived joins the session. */
  addGuest(ch: Link['ch']) {
    const link: Link = { ch, fileQueue: Promise.resolve(), incoming: null };
    this.links.push(link);
    this.listen(link);
    ch.addEventListener('close', () => this.dropLink(link));
  }

  /** Guest: join over the channel the copy arrived on; resolves with the story as it is right now. */
  join(ch: Link['ch'], name: string): Promise<Project> {
    const link: Link = { ch, fileQueue: Promise.resolve(), incoming: null };
    this.links = [link];
    const welcomed = new Promise<Project>((resolve) => { this.onWelcome = resolve; });
    this.listen(link);
    ch.addEventListener('close', () => this.end('The host ended the session. You still have your own copy.'));
    // The host starts listening once our copy has arrived, which can be just
    // after we say hello: repeat it until welcomed (the host ignores repeats).
    const hello = () => this.post(link, { t: 'hello', peer: { id: this.me.id, name } });
    hello();
    const retry = setInterval(() => (this.onWelcome && !this.ended ? hello() : clearInterval(retry)), 400);
    return welcomed;
  }
  private onWelcome: ((p: Project) => void) | null = null;

  private dropLink(link: Link) {
    this.links = this.links.filter((l) => l !== link);
    if (link.peerId) {
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
    if (!ops.length || this.ended) return;
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
        const peer: Peer = { id: m.peer.id, name: m.peer.name || 'Guest', color: PEER_COLORS[this.peers.length % PEER_COLORS.length] };
        link.peerId = peer.id;
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
          this.apply(m.ops);
          this.broadcast(m); // to everyone, the sender too: that's its confirmation
          return;
        }
        if (m.from === this.me.id) {
          for (const op of m.ops) if (this.pending.get(op.key) === m.seq) this.pending.delete(op.key);
          return;
        }
        this.apply(m.ops.filter((op) => !this.pending.has(op.key)));
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
  }

  private async finishFile(link: Link) {
    const f = link.incoming!;
    link.incoming = null;
    const blob = new Blob(f.parts, { type: f.type });
    await getStorageAdapter().saveAsset(blob, f.id);
    this.events.onAsset?.(f.id);
    // Host passes it on to everyone else.
    if (this.role === 'host') {
      for (const l of this.links) if (l !== link && l.peerId) this.queueFile(l, { t: 'asset', from: f.from, id: f.id, size: f.size, type: f.type }, blob);
    }
  }

  private apply(ops: Op[]) {
    if (!ops.length) return;
    if (this.events.onOps) this.events.onOps(ops);
    else this.backlog.push(...ops);
  }

  // ---- ending ----

  end(reason = 'The session ended.') {
    if (this.ended) return;
    this.ended = reason;
    for (const l of this.links) { try { l.ch.close?.(); } catch { /* already closed */ } }
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
