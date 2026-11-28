import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Project } from '../../models/story';
import { createInvite, Invite, Progress } from '../../services/liveShare';
import { codeFromPasted, shareUrl } from '../../services/shareLink';
import { Dialog } from '../ui/NativeDialog';
import { buttonPrimary, buttonSecondary, input } from '../ui/styles';
import { TransferProgress } from '../share/TransferProgress';

interface ShareStoryModalProps {
  /** The story to share (the live canvas when opened); null when closed. */
  project: Project | null;
  onClose: () => void;
}

type Step = 'preparing' | 'waiting' | 'sending' | 'sent';

// Send the story, with all its media, straight from this browser to someone
// else's: they open the link, send back the reply code their page shows, and
// pasting it here starts the transfer. Nothing is uploaded anywhere.
export function ShareStoryModal({ project, onClose }: ShareStoryModalProps) {
  const [step, setStep] = useState<Step>('preparing');
  const [link, setLink] = useState('');
  const [reply, setReply] = useState('');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [round, setRound] = useState(0); // a fresh invite for the next person
  const invite = useRef<Invite | null>(null);

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    setStep('preparing');
    setLink('');
    setReply('');
    setProgress(null);
    setError('');
    setCopied(false);
    createInvite(project).then(
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
  }, [project, round]);

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
      await invite.current.accept(codeFromPasted(text), setProgress);
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
        ? 'Done. They have their own copy now, with all its media.'
        : 'They open the link and send you back a reply code. Paste it here and the story goes straight to them, media included.'}
      onSubmit={(e) => { e.preventDefault(); if (step === 'waiting') connect(reply); }}
      actions={step === 'sent' ? (
        <>
          <button type="button" className={buttonSecondary} onClick={() => setRound((r) => r + 1)}>Share with someone else</button>
          <button type="button" className={buttonPrimary} onClick={onClose}>Done</button>
        </>
      ) : (
        <button type="button" className={buttonSecondary} onClick={onClose}>{step === 'sending' ? 'Stop' : 'Cancel'}</button>
      )}
    >
      {!busy && (
        <div className="space-y-4">
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
