import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Check, ClipboardPaste, Copy, QrCode as QrIcon, Send } from 'lucide-react';
import { Project } from '../../models/story';
import { invites, InviteMode } from '../../services/invites';
import { liveSession, myPeerName, Access } from '../../services/liveSession';
import { Dialog } from '../ui/NativeDialog';
import { buttonPrimary, buttonSecondary, input } from '../ui/styles';
import { TransferProgress } from './TransferProgress';
import { QrCode } from './QrCode';

interface ShareDialogProps {
  /** The story to share; null when closed. */
  project: Project | null;
  /** The story as it is right now (sent when they connect, not when the link was made). */
  getProject: () => Project;
  onClose: () => void;
}

const canSystemShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
const smallButton = 'inline-flex h-8 items-center gap-1.5 rounded-md border border-nt-line px-2.5 text-xs text-nt-ink-2 transition-colors hover:bg-nt-raised hover:text-nt-ink disabled:opacity-40';

// Send someone the story (a copy, or to edit together). The invite lives in
// the invite store, so this can close while you wait for their reply.
export function ShareDialog({ project, getProject, onClose }: ShareDialogProps) {
  const all = useSyncExternalStore(invites.subscribe, invites.all);
  const running = liveSession.get();
  const hosting = !!(running && project && running.projectId === project.id && running.role === 'host');
  const [mode, setMode] = useState<InviteMode>('copy');
  const [access, setAccess] = useState<Access>('edit');
  const [name, setName] = useState(() => myPeerName.get());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState(false);
  const [round, setRound] = useState(0);
  const creating = useRef(0);

  // Opening from the session panel's Invite: straight to editing together.
  useEffect(() => { if (project) setMode(hosting ? 'live' : 'copy'); }, [project, hosting]);

  // The invite shown: one already waiting for this story and mode, or a new one.
  useEffect(() => {
    if (!project) return;
    setError(''); setReply(''); setCopied(false); setQr(false);
    const waiting = round === 0 && invites.all().find((i) => i.projectId === project.id && i.mode === mode && i.access === access && i.status === 'waiting');
    if (waiting) { setCurrentId(waiting.id); return; }
    setCurrentId(null);
    const ticket = ++creating.current;
    invites.create(project.id, getProject, mode, access).then(
      (inv) => { if (ticket === creating.current) setCurrentId(inv.id); else invites.discard(inv.id); },
      (err) => setError(`Couldn’t prepare sharing: ${err instanceof Error ? err.message : String(err)}`),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, mode, access, round]);

  const current = all.find((i) => i.id === currentId) ?? null;

  const switchMode = (m: InviteMode) => {
    // The unused invite for the other mode isn't needed.
    if (current?.status === 'waiting') invites.discard(current.id);
    setMode(m);
  };
  const switchAccess = (a: Access) => {
    if (a === access) return;
    if (current?.status === 'waiting') invites.discard(current.id);
    setAccess(a);
  };

  const copy = async () => {
    if (!current) return;
    try { await navigator.clipboard.writeText(current.link); setCopied(true); }
    catch { setError('Couldn’t copy automatically. Select the link and copy it.'); }
  };

  const send = () => current && navigator.share({ title: project?.name, text: `Open this to ${mode === 'live' ? 'edit' : 'get'} “${project?.name}” in NodeTale`, url: current.link }).catch(() => {});

  const connect = async (text: string) => {
    if (!text.trim()) return;
    setError('');
    if (mode === 'live' && !hosting) myPeerName.set(name.trim() || 'Host');
    try { await invites.accept(text); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setReply(text);
      await connect(text);
    } catch {
      setError('Couldn’t read the clipboard. Paste the reply into the box instead.');
    }
  };

  const status = current?.status ?? 'waiting';
  const busy = status === 'sending' || status === 'sent';

  return (
    <Dialog
      open={project !== null}
      onClose={onClose}
      title="Share"
      description={status === 'sent'
        ? mode === 'live' ? 'Connected. You’re editing together.' : 'Done. They have their own copy, with all its media.'
        : mode === 'live'
          ? 'They open the link and send back a reply code. Then you edit the story together, each on your own screen.'
          : 'They open the link and send back a reply code. Then the story goes straight to them, media included.'}
      onSubmit={(e) => { e.preventDefault(); if (status === 'waiting') connect(reply); }}
      actions={status === 'sent' ? (
        <>
          <button type="button" className={buttonSecondary} onClick={() => setRound((r) => r + 1)}>{mode === 'live' ? 'Invite someone else' : 'Share with someone else'}</button>
          <button type="button" className={buttonPrimary} onClick={onClose}>Done</button>
        </>
      ) : (
        <button type="button" className={buttonSecondary} onClick={onClose}>Close</button>
      )}
    >
      {!busy && (
        <div className="space-y-4">
          <div role="radiogroup" aria-label="How to share" className="grid grid-cols-2 rounded-md border border-nt-line bg-nt-bg p-0.5 text-sm">
            {([['copy', 'Send a copy'], ['live', 'Edit together']] as const).map(([m, label]) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => switchMode(m)} disabled={hosting && m === 'copy'}
                className={`h-8 rounded transition-colors disabled:opacity-40 ${mode === m ? 'bg-nt-raised text-nt-ink' : 'text-nt-ink-3 hover:text-nt-ink-2'}`}>
                {label}
              </button>
            ))}
          </div>
          {mode === 'live' && (
            <div className="flex gap-2">
              {!hosting && <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (shown to others)" aria-label="Your name" maxLength={24} className={`${input} min-w-0 flex-1`} />}
              <select value={access} onChange={(e) => switchAccess(e.target.value as Access)} aria-label="What they can do"
                className={`${input} ${hosting ? 'flex-1' : 'w-32'} cursor-pointer`}>
                <option value="edit">Can edit</option>
                <option value="view">Can view</option>
              </select>
            </div>
          )}

          <div>
            <div className="flex gap-2">
              <input readOnly value={current?.link ?? 'Preparing the link…'} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" className={`${input} min-w-0 flex-1 font-mono text-xs`} />
              <button type="button" className={buttonPrimary} onClick={copy} disabled={!current}>
                {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              {canSystemShare && <button type="button" className={smallButton} onClick={send} disabled={!current}><Send size={13} aria-hidden /> Send…</button>}
              <button type="button" className={smallButton} onClick={() => setQr((q) => !q)} disabled={!current} aria-pressed={qr}><QrIcon size={13} aria-hidden /> QR code</button>
            </div>
            {qr && current && <div className="mt-3 flex justify-center"><QrCode text={current.link} /></div>}
          </div>

          <div className="flex gap-2">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              // A pasted reply is complete: connect right away.
              onPaste={(e) => { const text = e.clipboardData.getData('text'); if (text.trim()) { e.preventDefault(); setReply(text); connect(text); } }}
              disabled={!current}
              placeholder="Paste their reply code"
              aria-label="Reply code"
              className={`${input} min-w-0 flex-1 font-mono text-xs`}
            />
            {reply.trim()
              ? <button type="submit" className={buttonSecondary}>Connect</button>
              : <button type="button" className={buttonSecondary} onClick={pasteFromClipboard} disabled={!current} title="Paste their reply from the clipboard"><ClipboardPaste size={15} aria-hidden /> Paste</button>}
          </div>
          <p className="text-xs text-nt-ink-3">One link per person. You can close this: paste their reply later from the Sharing panel.</p>
        </div>
      )}
      {busy && <TransferProgress progress={current?.progress ?? null} verb="Sending" finished={status === 'sent'} />}
      {(error || current?.error) && <p className="mt-3 text-xs leading-relaxed text-nt-danger">{error || current?.error}</p>}
      {status === 'failed' && <button type="button" className={`${smallButton} mt-3`} onClick={() => setRound((r) => r + 1)}>Make a new link</button>}
    </Dialog>
  );
}
