import { useEffect, useState, useSyncExternalStore } from 'react';
import { ChevronDown, ChevronUp, ClipboardPaste, Copy, LogOut, UserPlus, X } from 'lucide-react';
import { LiveSession } from '../../services/liveSession';
import { invites } from '../../services/invites';
import { useLocalPref } from '../../utils/localPrefs';
import { TransferProgress } from './TransferProgress';

const noSession = () => () => {};
const useSessionVersion = (session: LiveSession | null) =>
  useSyncExternalStore(session ? session.subscribe : noSession, () => session?.version ?? 0);

const row = 'flex items-center gap-2 px-3 py-1.5 text-xs';
const iconButton = 'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-nt-ink-3 transition-colors hover:bg-nt-raised hover:text-nt-ink';

// Sharing at a glance, top right under Play: who's in the live session, links
// still waiting for a reply, transfers in progress. Collapses to a chip.
export function SharePanel({ projectId, session, onInvite }: { projectId: string; session: LiveSession | null; onInvite: () => void }) {
  useSessionVersion(session);
  const all = useSyncExternalStore(invites.subscribe, invites.all);
  const mine = all.filter((i) => i.projectId === projectId);
  const waiting = mine.filter((i) => i.status === 'waiting');
  const [collapsed, setCollapsed] = useLocalPref('nodetale:sharePanel:collapsed', false);
  const [error, setError] = useState('');

  // Back in the tab with their reply already copied: connect without asking,
  // if the browser lets us read the clipboard without a prompt.
  useEffect(() => {
    if (!waiting.length) return;
    const check = async () => {
      try {
        const perm = await navigator.permissions?.query({ name: 'clipboard-read' as PermissionName });
        if (perm?.state !== 'granted') return;
        const text = await navigator.clipboard.readText();
        if (invites.matches(text)) await invites.accept(text);
      } catch { /* not allowed here; the Paste button still works */ }
    };
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, [waiting.length]);

  if (!session && !mine.length) return null;

  const paste = async () => {
    setError('');
    try { await invites.accept(await navigator.clipboard.readText()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t read the clipboard. Use Share to paste the reply.'); }
  };

  const host = session?.role === 'host';
  const title = session ? `Live · ${session.peers.length}` : `${waiting.length || mine.length} waiting`;

  if (collapsed) {
    return (
      <button type="button" onClick={() => setCollapsed(false)} aria-expanded={false} aria-label="Show sharing"
        className="flex h-8 items-center gap-2 rounded-full border border-nt-line bg-nt-surface/95 pl-3 pr-2 text-xs font-medium text-nt-ink shadow-lg backdrop-blur">
        <span className={`h-2 w-2 rounded-full ${session ? 'animate-pulse bg-emerald-400' : 'bg-amber-400'}`} aria-hidden />
        {title}
        <ChevronDown size={14} className="text-nt-ink-3" aria-hidden />
      </button>
    );
  }

  return (
    <aside className="w-64 overflow-hidden rounded-xl border border-nt-line bg-nt-surface/95 text-nt-ink-2 shadow-lg backdrop-blur" aria-label="Sharing">
      <header className="flex items-center gap-2 py-2 pl-3 pr-1.5">
        <span className={`h-2 w-2 rounded-full ${session ? 'animate-pulse bg-emerald-400' : 'bg-amber-400'}`} aria-hidden />
        <span className="flex-1 text-xs font-semibold text-nt-ink">{session ? 'Editing together' : 'Sharing'}</span>
        <button type="button" onClick={() => setCollapsed(true)} className={iconButton} aria-expanded aria-label="Collapse sharing" title="Collapse">
          <ChevronUp size={14} />
        </button>
      </header>

      {session && (
        <ul className="border-t border-nt-line/60 py-1" aria-label="People in this session">
          {session.peers.map((p) => (
            <li key={p.id} className={row}>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-[#0f0f11]" style={{ background: p.color }} aria-hidden>
                {p.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-nt-ink">{p.name}</span>
              {p.id === session.me.id && <span className="text-nt-ink-3">you</span>}
            </li>
          ))}
        </ul>
      )}

      {mine.length > 0 && (
        <ul className="border-t border-nt-line/60 py-1" aria-label="Links waiting for a reply">
          {mine.map((i) => (
            <li key={i.id} className="px-3 py-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">
                  {i.status === 'waiting' && <>{i.mode === 'live' ? 'Invite' : 'Copy'} link · <span className="text-nt-ink-3">waiting for reply</span></>}
                  {i.status === 'sending' && (i.mode === 'live' ? 'Connecting…' : 'Sending a copy…')}
                  {i.status === 'sent' && <span className="text-emerald-400">{i.mode === 'live' ? 'Joined' : 'Copy sent'}</span>}
                  {i.status === 'failed' && <span className="text-nt-danger">Couldn’t connect</span>}
                </span>
                {i.status === 'waiting' && (
                  <button type="button" className={iconButton} title="Copy link" aria-label="Copy link" onClick={() => navigator.clipboard.writeText(i.link).catch(() => {})}><Copy size={12} /></button>
                )}
                {(i.status === 'waiting' || i.status === 'failed') && (
                  <button type="button" className={iconButton} title="Cancel this link" aria-label="Cancel this link" onClick={() => invites.discard(i.id)}><X size={12} /></button>
                )}
              </div>
              {i.status === 'sending' && i.progress && <div className="mt-1.5"><TransferProgress progress={i.progress} verb="Sending" /></div>}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="px-3 pb-1 text-xs text-nt-danger">{error}</p>}

      <footer className="flex items-center gap-1 border-t border-nt-line/60 p-1.5">
        {waiting.length > 0 && (
          <button type="button" onClick={paste} className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-nt-ink hover:bg-nt-raised" title="Connect using the reply in your clipboard">
            <ClipboardPaste size={13} aria-hidden /> Paste reply
          </button>
        )}
        {(!session || host) && (
          <button type="button" onClick={onInvite} className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-nt-ink-2 hover:bg-nt-raised hover:text-nt-ink" title="Share with someone">
            <UserPlus size={13} aria-hidden /> {session ? 'Invite' : 'Share'}
          </button>
        )}
        {session && (
          <button type="button" onClick={() => session.end(host ? 'You ended the session.' : 'You left the session.')}
            className="ml-auto flex h-7 items-center gap-1 rounded-md px-2 text-xs text-nt-ink-3 hover:bg-nt-raised hover:text-nt-danger" title={host ? 'End the session for everyone' : 'Leave the session'}>
            <LogOut size={13} aria-hidden /> {host ? 'End' : 'Leave'}
          </button>
        )}
      </footer>
    </aside>
  );
}
