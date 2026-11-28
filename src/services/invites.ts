import { Project } from '../models/story';
import { createInvite, Invite, Progress } from './liveShare';
import { replyInviteKey } from './connectCode';
import { codeFromPasted, shareUrl } from './shareLink';
import { liveSession, LiveSession, myPeerName, PEER_COLORS, Access } from './liveSession';
import { backUp } from './backups';
import { shortId } from '../utils/id';

// Invites waiting for a reply live here, not in the Share dialog: the dialog
// can close and the reply be pasted later (from the share panel), and several
// invites can wait at once. A reply names the invite it answers, so pasting
// it finds the right one by itself.

export type InviteMode = 'copy' | 'live';
export type InviteStatus = 'waiting' | 'sending' | 'sent' | 'failed';

export interface PendingInvite {
  id: string;
  projectId: string;
  mode: InviteMode;
  /** The share link (or a bare code in the desktop app). */
  link: string;
  status: InviteStatus;
  progress: Progress | null;
  error: string;
  /** Live invites: may they edit, or only watch? */
  access: Access;
}

const entries = new Map<string, { info: PendingInvite; invite: Invite; getProject: () => Project }>();
let snapshot: PendingInvite[] = [];
const listeners = new Set<() => void>();

const changed = () => {
  snapshot = [...entries.values()].map((e) => e.info);
  listeners.forEach((fn) => fn());
};
const update = (id: string, patch: Partial<PendingInvite>) => {
  const e = entries.get(id);
  if (!e) return;
  e.info = { ...e.info, ...patch };
  changed();
};

export class NoMatchingInvite extends Error {}

export const invites = {
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  /** All invites (stable array between changes, for useSyncExternalStore). */
  all: () => snapshot,

  /** A new invite for one person. `getProject` is read when they connect, so they get the story as it is then. */
  async create(projectId: string, getProject: () => Project, mode: InviteMode, access: Access = 'edit'): Promise<PendingInvite> {
    const invite = await createInvite(getProject, { live: mode === 'live' });
    const info: PendingInvite = {
      id: invite.key, projectId, mode, access, link: shareUrl(invite.code) ?? invite.code,
      status: 'waiting', progress: null, error: '',
    };
    entries.set(info.id, { info, invite, getProject });
    changed();
    return info;
  },

  /** Is this text a reply to one of our invites? (For offering to paste it.) */
  matches(text: string): boolean {
    const key = replyInviteKey(codeFromPasted(text));
    return !!key && entries.get(key)?.info.status === 'waiting';
  },

  /** Connect the invite this reply answers, then send the story (and for live, join the session). */
  async accept(text: string): Promise<PendingInvite> {
    const code = codeFromPasted(text);
    const key = replyInviteKey(code);
    const entry = key ? entries.get(key) : undefined;
    if (!entry || entry.info.status !== 'waiting') {
      throw new NoMatchingInvite(key
        ? 'That reply is for a link that’s no longer waiting. Send them a new link.'
        : 'That isn’t a reply code. Ask them for the code their page shows.');
    }
    const { info, invite, getProject } = entry;
    update(info.id, { status: 'sending', error: '' });
    try {
      const channel = await invite.accept(code, (progress) => update(info.id, { progress }));
      if (info.mode === 'live') {
        const running = liveSession.get();
        let session = running && running.projectId === info.projectId && running.role === 'host' ? running : null;
        if (!session) {
          // A session is starting: keep a copy of the story as it was, to go back to.
          await backUp(getProject(), 'before live session').catch(() => {});
          session = liveSession.start(new LiveSession('host', info.projectId, { id: shortId(), name: myPeerName.get() || 'Host', color: PEER_COLORS[0], access: 'edit' }));
        }
        session.addGuest(channel, info.access);
      } else {
        invite.close();
      }
      update(info.id, { status: 'sent' });
      // Done: the panel shows it for a moment, then it goes.
      setTimeout(() => invites.forget(info.id), 6000);
      return entries.get(info.id)?.info ?? info;
    } catch (err) {
      update(info.id, { status: 'failed', error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  /** Stop waiting: the link stops working. */
  discard(id: string) {
    const e = entries.get(id);
    if (!e) return;
    if (e.info.status !== 'sent') e.invite.close();
    entries.delete(id);
    changed();
  },

  /** Forget a finished invite (its connection, if live, now belongs to the session). */
  forget(id: string) {
    if (entries.delete(id)) changed();
  },

  /** Leaving a story drops its waiting invites. */
  discardFor(projectId: string) {
    for (const [id, e] of entries) if (e.info.projectId === projectId && e.info.status === 'waiting') invites.discard(id);
  },

  /** Anything that would be lost by closing the page? */
  busy: (projectId: string) => snapshot.some((i) => i.projectId === projectId && (i.status === 'waiting' || i.status === 'sending')),
};
