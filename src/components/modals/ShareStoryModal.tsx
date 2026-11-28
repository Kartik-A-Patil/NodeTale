import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Project } from '../../models/story';
import { createInvite, Invite, Progress } from '../../services/liveShare';
import { liveSession, LiveSession, myPeerName, PEER_COLORS } from '../../services/liveSession';
import { shortId } from '../../utils/id';
import { codeFromPasted, shareUrl } from '../../services/shareLink';
import { Dialog } from '../ui/NativeDialog';
import { buttonPrimary, buttonSecondary, input } from '../ui/styles';
import { TransferProgress } from '../share/TransferProgress';

interface ShareStoryModalProps {
  /** The story to share (the live canvas when opened); null when closed. */
  project: Project | null;
  /** The story as it is right now (sent when they connect, not when the link was made). */
  getProject: () => Project;
  onClose: () => void;
}

type Step = 'preparing' | 'waiting' | 'sending' | 'sent';
type Mode = 'copy' | 'live';

// Send the story, with all its media, straight from this browser to someone
// else's: they open the link, send back the reply code their page shows, and
// pasting it here starts the transfer. Nothing is uploaded anywhere.
export function ShareStoryModal({ project, getProject, onClose }: ShareStoryModalProps) {
  const running = liveSession.get();
  const hosting = running && project && running.projectId === project.id && running.role === 'host' ? running : null;
  const [mode, setMode] = useState<Mode>('copy');
  const [name, setName] = useState(() => myPeerName.get());
  const [step, setStep] = useState<Step>('preparing');
  const [link, setLink] = useState('');
  const [reply, setReply] = useState('');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [round, setRound] = useState(0); // a fresh invite for the next person
  const invite = useRef<Invite | null>(null);

  // Opening it from the Live pill's Invite: straight to editing together.
  useEffect(() => { if (project) setMode(hosting ? 'live' : 'copy'); }, [project, hosting]);

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    setStep('preparing');
    setLink('');
    setReply('');
    setProgress(null);
    setError('');
    setCopied(false);
    createInvite(getProject, { live: mode === 'live' }).then(
      (inv) => {
        if (cancelled) return inv.close();
        invite.current = inv;
        setLink(shareUrl(inv.code) ?? inv.code);
        setStep('waiting');
      },
      (err) => !cancelled && setError(`Couldn’t prepare sharing: ${err instanceof Error ? err.message : String(err)}`),
    );
    return () => {
      cancelled = true;
      invite.current?.close();
      invite.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, round, mode]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError('Couldn’t copy automatically. Select the link and copy it.');
    }
  };

  const connect = async (text: string) => {
    if (!invite.current || !text.trim()) return;
    setError('');
    setStep('sending');
    try {
      const channel = await invite.current.accept(codeFromPasted(text), setProgress);
      if (mode === 'live' && project) {
        const me = name.trim() || 'Host';
        myPeerName.set(me);
        const session = hosting ?? liveSession.start(new LiveSession('host', project.id, { id: shortId(), name: me, color: PEER_COLORS[0] }));
        session.addGuest(channel);
        invite.current = null; // the connection now belongs to the session
      }
      setStep('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('waiting');
    }
  };

  const busy = step === 'sending' || step === 'sent';

  return (
    <Dialog
      open={project !== null}
      onClose={onClose}
      title="Share"
      description={step === 'sent'
        ? mode === 'live' ? 'Connected. You’re editing together: changes appear for everyone as they’re made.' : 'Done. They have their own copy now, with all its media.'
        : mode === 'live'
          ? 'They open the link and send you back a reply code. Paste it here: they get the story with its media, then you edit it together, live.'
          : 'They open the link and send you back a reply code. Paste it here and the story goes straight to them, media included.'}
      onSubmit={(e) => { e.preventDefault(); if (step === 'waiting') connect(reply); }}
      actions={step === 'sent' ? (
        <>
          <button type="button" className={buttonSecondary} onClick={() => setRound((r) => r + 1)}>{mode === 'live' ? 'Invite someone else' : 'Share with someone else'}</button>
          <button type="button" className={buttonPrimary} onClick={onClose}>Done</button>
        </>
      ) : (
        <button type="button" className={buttonSecondary} onClick={onClose}>{step === 'sending' ? 'Stop' : 'Cancel'}</button>
      )}
    >
      {!busy && (
        <div className="space-y-4">
          <div role="radiogroup" aria-label="How to share" className="grid grid-cols-2 rounded-md border border-nt-line bg-nt-bg p-0.5 text-sm">
            {([['copy', 'Send a copy'], ['live', 'Edit together']] as const).map(([m, label]) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} disabled={!!hosting && m === 'copy'}
                className={`h-8 rounded transition-colors disabled:opacity-40 ${mode === m ? 'bg-nt-raised text-nt-ink' : 'text-nt-ink-3 hover:text-nt-ink-2'}`}>
                {label}
              </button>
            ))}
          </div>
          {mode === 'live' && !hosting && (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (shown to others)" aria-label="Your name" maxLength={24} className={input} />
          )}
          <div className="flex gap-2">
            <input readOnly value={link || 'Preparing the link…'} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" className={`${input} min-w-0 flex-1 font-mono text-xs`} />
            <button type="button" className={buttonPrimary} onClick={copy} disabled={!link}>
              {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              // A pasted reply is complete: connect right away.
              onPaste={(e) => { const text = e.clipboardData.getData('text'); if (text.trim()) { e.preventDefault(); setReply(text); connect(text); } }}
              disabled={step !== 'waiting'}
              placeholder="Paste their reply code"
              aria-label="Reply code"
              className={`${input} min-w-0 flex-1 font-mono text-xs`}
            />
            {reply.trim() && <button type="submit" className={buttonSecondary}>Connect</button>}
          </div>
          <p className="text-xs text-nt-ink-3">One link per person. Keep this window open until they have it.</p>
        </div>
      )}
      {busy && <TransferProgress progress={progress} verb="Sending" finished={step === 'sent'} />}
      {error && <p className="mt-3 text-xs leading-relaxed text-nt-danger">{error}</p>}
    </Dialog>
  );
}
