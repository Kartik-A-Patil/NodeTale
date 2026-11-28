import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, Copy, PenLine, Play } from 'lucide-react';
import { Project } from '../models/story';
import { answerInvite, Answer, Progress } from '../services/liveShare';
import { finalizeAndSaveImportedProject } from '../services/projectImport';
import { loadProject, saveProject } from '../services/storageService';
import { backUp, editedSinceSession, markSynced } from '../services/backups';
import { liveSession, LiveSession, myPeerName } from '../services/liveSession';
import { shortId } from '../utils/id';
import { buttonPrimary, buttonSecondary, input } from './ui/styles';
import { TransferProgress } from './share/TransferProgress';

const PlayMode = React.lazy(() => import('./PlayMode'));

type Step = 'opening' | 'waiting' | 'receiving' | 'done';

// Opening a share link: show the reply code to send back, then receive the
// story and its media straight from the sender's browser and keep it as an
// editable copy. The code arrives in the URL's # (a link) or as router state
// (pasted on the dashboard).
export default function SharePreview() {
  const location = useLocation();
  const navigate = useNavigate();
  const code = (location.state as { code?: string } | null)?.code ?? location.hash.slice(1);
  const [step, setStep] = useState<Step>('opening');
  const [reply, setReply] = useState('');
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [story, setStory] = useState<Project | null>(null);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [live, setLive] = useState(false);
  const [name, setName] = useState(() => myPeerName.get());
  const nameRef = useRef(name);
  nameRef.current = name;
  const answer = useRef<Answer | null>(null);
  // Nobody connected for a while: the link may be stale (one per person, and
  // only while the sender keeps the story open).
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (step !== 'waiting') return;
    const timer = setTimeout(() => setSlow(true), 2 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    let cancelled = false;
    setStep('opening');
    setError('');
    if (!code) {
      setError('This link is missing its code. Make sure the whole link was copied.');
      return;
    }
    (async () => {
      const a = await answerInvite(code);
      if (cancelled) return a.close();
      answer.current = a;
      setLive(a.live);
      setReply(a.reply);
      setStep('waiting');
      const { project: received, channel } = await a.receive((p) => {
        if (cancelled) return;
        setStep('receiving');
        setProgress(p);
      });
      if (cancelled) return;
      if (a.live) {
        // Editing together: join, keep the story under the host's id (a later
        // session updates this same copy) and go straight into the editor.
        const me = nameRef.current.trim() || 'Guest';
        myPeerName.set(me);
        const session = liveSession.start(new LiveSession('guest', received.id, { id: shortId(), name: me, color: '' }));
        const now = await session.join(channel, me);
        // Rejoining replaces your copy with theirs: if you'd changed it on your
        // own since the last session, keep that version as a backup first.
        const mine = await loadProject(now.id);
        if (mine && editedSinceSession(mine)) await backUp(mine, 'your copy before rejoining').catch(() => {});
        await saveProject({ ...now, modifiedAt: Date.now() });
        markSynced(now);
        answer.current = null; // the connection now belongs to the session
        if (!cancelled) navigate(`/${now.id}`, { replace: true });
        return;
      }
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
  }, [code, navigate]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
    } catch {
      setError('Couldn’t copy automatically. Select the code and copy it.');
    }
  };

  const title = story?.name ?? progress?.name;

  return (
    <div className="flex min-h-screen items-center justify-center bg-nt-bg px-4 text-nt-ink">
      <main className="w-full max-w-md">
        {error ? (
          <>
            <h1 className="text-xl font-semibold">Can’t open this story</h1>
            <p className="mt-2 text-sm leading-relaxed text-nt-ink-2">{error}</p>
            <button type="button" className={`${buttonSecondary} mt-6`} onClick={() => navigate('/')}>Go to my stories</button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold [text-wrap:balance]">{title ?? 'Someone is sharing a story with you'}</h1>

            {(step === 'opening' || step === 'waiting') && (
              <>
                <p className="mt-3 text-sm leading-relaxed text-nt-ink-2">
                  {live
                    ? 'You’re invited to edit this story together. Send them this reply code; once they paste it, the story opens here and you edit it live.'
                    : 'Send them this reply code. The story arrives here, with all its media, once they paste it.'}
                </p>
                {live && (
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (shown to others)" aria-label="Your name" maxLength={24} className={`${input} mt-4`} />
                )}
                <div className="mt-4 flex gap-2">
                  <input readOnly value={reply || 'Preparing…'} onFocus={(e) => e.currentTarget.select()} aria-label="Reply code" className={`${input} min-w-0 flex-1 font-mono text-xs`} />
                  <button type="button" className={buttonPrimary} onClick={copy} disabled={!reply}>
                    {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                {reply && !slow && <p className="mt-3 animate-pulse text-xs text-nt-ink-3" role="status">Waiting for them… keep this page open.</p>}
                {slow && (
                  <p className="mt-3 text-xs leading-relaxed text-amber-300" role="status">
                    Still waiting. Make sure they pasted your reply code. If it’s been a while, the link may have expired: each link works once, while their story stays open. Ask them for a new one. This page keeps waiting meanwhile.
                  </p>
                )}
              </>
            )}

            {(step === 'receiving' || step === 'done') && (
              <div className="mt-5">
                <TransferProgress progress={progress} verb="Receiving" finished={step === 'done'} />
              </div>
            )}

            {step === 'done' && story && (
              <>
                <p className="mt-4 text-sm text-nt-ink-2">Saved to your stories.</p>
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
