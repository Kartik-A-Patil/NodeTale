import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, Copy, PenLine, Play } from 'lucide-react';
import { Project } from '../models/story';
import { answerInvite, Answer, Progress } from '../services/liveShare';
import { finalizeAndSaveImportedProject } from '../services/projectImport';
import { buttonPrimary, buttonSecondary } from './ui/styles';
import { TransferProgress } from './share/TransferProgress';

const PlayMode = React.lazy(() => import('./PlayMode'));

type Step = 'answering' | 'waiting' | 'receiving' | 'done';

// Opening a share link: answer the invite, show the reply code to send back,
// then receive the story and its media straight from the sender's browser
// and keep it as an editable copy. The code arrives in the URL's # (a link)
// or as router state (pasted on the dashboard).
export default function SharePreview() {
  const location = useLocation();
  const navigate = useNavigate();
  const code = (location.state as { code?: string } | null)?.code ?? location.hash.slice(1);
  const [step, setStep] = useState<Step>('answering');
  const [name, setName] = useState('');
  const [reply, setReply] = useState('');
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [story, setStory] = useState<Project | null>(null);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const answer = useRef<Answer | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStep('answering');
    setError('');
    if (!code) {
      setError('This link has no invite in it. Make sure the whole link was copied.');
      return;
    }
    (async () => {
      const a = await answerInvite(code);
      if (cancelled) return a.close();
      answer.current = a;
      setName(a.name);
      setReply(a.reply);
      setStep('waiting');
      const received = await a.receive((p) => {
        if (cancelled) return;
        setStep('receiving');
        setProgress(p);
      });
      const saved = await finalizeAndSaveImportedProject({ ...received, modifiedAt: Date.now() });
      if (cancelled) return;
      setStory(saved);
      setStep('done');
      a.close();
    })().catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
      answer.current?.close();
    };
  }, [code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
    } catch {
      setError('Couldn’t copy automatically. Select the code and copy it.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-nt-bg px-4 text-nt-ink">
      <main className="w-full max-w-md">
        {error ? (
          <>
            <h1 className="text-xl font-semibold">Can’t open this story</h1>
            <p className="mt-2 text-sm leading-relaxed text-nt-ink-2">{error}</p>
            <button type="button" className={`${buttonSecondary} mt-6`} onClick={() => navigate('/')}>Go to my stories</button>
          </>
        ) : step === 'answering' ? (
          <p className="text-sm text-nt-ink-3" role="status">Opening the invite…</p>
        ) : (
          <>
            <p className="text-sm text-nt-ink-3">{step === 'done' ? 'The story is yours' : 'Someone is sharing a story with you'}</p>
            <h1 className="mt-1 text-2xl font-semibold [text-wrap:balance]">{name}</h1>

            {step === 'waiting' && (
              <>
                <p className="mt-4 text-sm leading-relaxed text-nt-ink-2">
                  Send this reply code back to them. The story and its media arrive here once they paste it. Keep this page open.
                </p>
                <textarea
                  readOnly
                  rows={4}
                  value={reply}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Reply code"
                  className="mt-3 w-full resize-none break-all rounded-md border border-nt-line bg-nt-surface p-2.5 font-mono text-xs leading-relaxed text-nt-ink-2"
                />
                <button type="button" className={`${buttonPrimary} mt-3`} onClick={copy}>
                  {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? 'Copied' : 'Copy reply code'}
                </button>
              </>
            )}

            {(step === 'receiving' || step === 'done') && (
              <div className="mt-5">
                <TransferProgress progress={progress} verb="Receiving" finished={step === 'done'} />
              </div>
            )}

            {step === 'done' && story && (
              <>
                <p className="mt-4 text-sm leading-relaxed text-nt-ink-2">Saved to your stories, with all its images, sound and video.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button type="button" className={buttonPrimary} onClick={() => navigate(`/${story.id}`, { replace: true })}>
                    <PenLine size={15} aria-hidden /> Open in editor
                  </button>
                  <button type="button" className={buttonSecondary} onClick={() => setPlaying(true)}>
                    <Play size={15} aria-hidden /> Play
                  </button>
                </div>
              </>
            )}

            <button type="button" className="mt-8 block text-sm text-nt-ink-3 underline-offset-4 hover:text-nt-ink hover:underline" onClick={() => navigate('/')}>
              Go to my stories
            </button>
          </>
        )}
      </main>
      {playing && story && (
        <React.Suspense fallback={null}>
          <PlayMode project={story} onClose={() => setPlaying(false)} />
        </React.Suspense>
      )}
    </div>
  );
}
