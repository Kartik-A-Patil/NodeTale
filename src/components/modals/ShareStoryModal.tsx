import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Project } from '../../models/story';
import { createInvite, Invite, Progress } from '../../services/liveShare';
import { codeFromPasted, shareUrl } from '../../services/shareLink';
import { Dialog } from '../ui/NativeDialog';
import { buttonPrimary, buttonSecondary } from '../ui/styles';
import { TransferProgress } from '../share/TransferProgress';

interface ShareStoryModalProps {
  /** The story to share (the live canvas when opened); null when closed. */
  project: Project | null;
  onClose: () => void;
}

type Step = 'preparing' | 'waiting' | 'sending' | 'sent';

const codeBox = 'w-full resize-none break-all rounded-md border border-nt-line bg-nt-bg p-2.5 font-mono text-xs leading-relaxed text-nt-ink-2';

// Sharing sends the story and all its media straight from this browser to the
// other person's: a link carries the invite, they send back a reply code, and
// the transfer runs while this window stays open. Nothing is uploaded anywhere.
export function ShareStoryModal({ project, onClose }: ShareStoryModalProps) {
  const [step, setStep] = useState<Step>('preparing');
  const [link, setLink] = useState('');
  const [isLink, setIsLink] = useState(true);
  const [reply, setReply] = useState('');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [round, setRound] = useState(0); // a new invite for the next person
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
        const url = shareUrl(inv.code);
        setIsLink(!!url);
        setLink(url ?? inv.code);
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

  const connect = async () => {
    if (!invite.current) return;
    setError('');
    setStep('sending');
    try {
      await invite.current.accept(codeFromPasted(reply), setProgress);
      setStep('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('waiting');
    }
  };

  const description = {
    preparing: 'Preparing a link…',
    waiting: isLink
      ? 'Send this link. When they open it, their page shows a reply code: paste it below to send them the story with all its images, sound and video.'
      : 'Send this code. They paste it into “Open a share link” on their stories page, then send you back the reply code it shows.',
    sending: 'Connected. Keep this window open until the transfer finishes.',
    sent: 'Done. They now have their own copy of the story, with all its media.',
  }[step];

  return (
    <Dialog
      open={project !== null}
      onClose={onClose}
      title="Share"
      description={description}
      onSubmit={(e) => { e.preventDefault(); if (step === 'waiting' && reply.trim()) connect(); }}
      actions={step === 'sent' ? (
        <>
          <button type="button" className={buttonSecondary} onClick={() => setRound((r) => r + 1)}>Share with someone else</button>
          <button type="button" className={buttonPrimary} onClick={onClose}>Done</button>
        </>
      ) : (
        <>
          <button type="button" className={buttonSecondary} onClick={onClose}>{step === 'sending' ? 'Stop' : 'Cancel'}</button>
          {step !== 'sending' && <button type="submit" className={buttonPrimary} disabled={step !== 'waiting' || !reply.trim()}>Connect</button>}
        </>
      )}
    >
      {(step === 'preparing' || step === 'waiting') && (
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-nt-ink-2">1. Send them this {isLink ? 'link' : 'code'}</span>
              <button type="button" onClick={copy} disabled={!link} className="inline-flex items-center gap-1 text-xs text-nt-ink-3 hover:text-nt-ink disabled:opacity-50">
                {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <textarea readOnly rows={3} value={link || 'Preparing…'} onFocus={(e) => e.currentTarget.select()} aria-label={isLink ? 'Share link' : 'Share code'} className={codeBox} />
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-nt-ink-2">2. Paste the reply code they send back</span>
            <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} disabled={step !== 'waiting'} placeholder="v2.…" aria-label="Reply code" className={`${codeBox} text-nt-ink placeholder:text-nt-ink-3`} />
          </label>
          <p className="text-xs leading-relaxed text-nt-ink-3">This link works for one person. Keep this window open until they have the story.</p>
        </div>
      )}
      {(step === 'sending' || step === 'sent') && <TransferProgress progress={progress} verb="Sending" finished={step === 'sent'} />}
      {error && <p className="mt-3 text-xs leading-relaxed text-nt-danger">{error}</p>}
    </Dialog>
  );
}
