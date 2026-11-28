import { useSyncExternalStore } from 'react';
import { LogOut, UserPlus } from 'lucide-react';
import { LiveSession } from '../../services/liveSession';

// Who's in a live session. Everyone works on their own screen; only changes sync.

const noSession = () => () => {};
const useSessionVersion = (session: LiveSession | null) =>
  useSyncExternalStore(session ? session.subscribe : noSession, () => session?.version ?? 0);

/** Who's in the session, with Invite (host) and End/Leave. */
export function LivePill({ session, onInvite }: { session: LiveSession; onInvite: () => void }) {
  useSessionVersion(session);
  const host = session.role === 'host';
  return (
    <div className="flex items-center gap-2 rounded-full border border-nt-line bg-nt-surface/95 py-1 pl-3 pr-1 text-xs text-nt-ink-2 shadow-lg backdrop-blur" role="status" aria-label="Live session">
      <span className="flex items-center gap-1.5 font-medium text-nt-ink">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-hidden /> Live
      </span>
      <span className="flex -space-x-1" aria-label={session.peers.map((p) => p.name).join(', ')}>
        {session.peers.map((p) => (
          <span key={p.id} title={p.id === session.me.id ? `${p.name} (you)` : p.name}
            className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-nt-surface text-[10px] font-semibold text-[#0f0f11]"
            style={{ background: p.color }}>
            {p.name.slice(0, 1).toUpperCase()}
          </span>
        ))}
      </span>
      {host && (
        <button type="button" onClick={onInvite} className="flex h-7 items-center gap-1 rounded-full px-2 text-nt-ink-2 hover:bg-nt-raised hover:text-nt-ink" title="Invite someone">
          <UserPlus size={13} aria-hidden /> Invite
        </button>
      )}
      <button type="button" onClick={() => session.end(host ? 'You ended the session.' : 'You left the session.')}
        className="flex h-7 items-center gap-1 rounded-full px-2 text-nt-ink-3 hover:bg-nt-raised hover:text-nt-danger" title={host ? 'End the session for everyone' : 'Leave the session'}>
        <LogOut size={13} aria-hidden /> {host ? 'End' : 'Leave'}
      </button>
    </div>
  );
}
