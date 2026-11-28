import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Copy, Play } from 'lucide-react';
import { Project } from '../models/story';
import { decodeStory } from '../services/shareLink';
import { finalizeAndSaveImportedProject } from '../services/projectImport';
import { hashString } from '../utils/contentHash';
import { buttonPrimary, buttonSecondary } from './ui/styles';

const PlayMode = React.lazy(() => import('./PlayMode'));

// Opening a share link: the story in the link, with a choice to play it right
// away (nothing saved) or keep an editable copy in this browser's stories.
// The code arrives in the URL's # (a link) or as router state (pasted on the dashboard).
export default function SharePreview() {
  const location = useLocation();
  const navigate = useNavigate();
  const code = (location.state as { code?: string } | null)?.code ?? location.hash.slice(1);
  const [story, setStory] = useState<Project | null>(null);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStory(null);
    setError('');
    if (!code) {
      setError('This link has no story in it. Make sure the whole link was copied.');
      return;
    }
    decodeStory(code).then(
      // A stable id per link, so Play Mode's saves and endings stay with this story.
      (p) => !cancelled && setStory({ ...p, id: `share-${hashString(code)}` }),
      (err) => !cancelled && setError(err instanceof Error ? err.message : String(err)),
    );
    return () => { cancelled = true; };
  }, [code]);

  const makeCopy = async () => {
    if (!story) return;
    setSaving(true);
    try {
      const saved = await finalizeAndSaveImportedProject({ ...story, modifiedAt: Date.now() });
      navigate(`/${saved.id}`, { replace: true });
    } catch (err) {
      setError(`Couldn’t save a copy: ${err instanceof Error ? err.message : String(err)}`);
      setSaving(false);
    }
  };

  const nodes = story?.boards.flatMap((b) => b.nodes) ?? [];
  const scenes = nodes.filter((n) => n.type === 'elementNode').length;
  const facts = story && [
    `${scenes} ${scenes === 1 ? 'scene' : 'scenes'}`,
    story.boards.length > 1 && `${story.boards.length} boards`,
    story.variables.length > 0 && `${story.variables.length} ${story.variables.length === 1 ? 'variable' : 'variables'}`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="flex min-h-screen items-center justify-center bg-nt-bg px-4 text-nt-ink">
      <main className="w-full max-w-md">
        {error ? (
          <>
            <h1 className="text-xl font-semibold">Can’t open this story</h1>
            <p className="mt-2 text-sm leading-relaxed text-nt-ink-2">{error}</p>
            <button type="button" className={`${buttonSecondary} mt-6`} onClick={() => navigate('/')}>Go to my stories</button>
          </>
        ) : !story ? (
          <p className="text-sm text-nt-ink-3" role="status">Opening the story…</p>
        ) : (
          <>
            <p className="text-sm text-nt-ink-3">Someone shared a story with you</p>
            <h1 className="mt-1 text-2xl font-semibold [text-wrap:balance]">{story.name}</h1>
            <p className="mt-2 text-sm text-nt-ink-2">{facts}</p>
            <p className="mt-4 text-sm leading-relaxed text-nt-ink-3">
              Share links carry the story’s text and logic. Images, sound and video aren’t included.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button type="button" className={buttonPrimary} onClick={() => setPlaying(true)} disabled={scenes === 0}>
                <Play size={15} aria-hidden /> Play
              </button>
              <button type="button" className={buttonSecondary} onClick={makeCopy} disabled={saving}>
                <Copy size={15} aria-hidden /> {saving ? 'Saving…' : 'Make an editable copy'}
              </button>
            </div>
            <button type="button" className="mt-8 text-sm text-nt-ink-3 underline-offset-4 hover:text-nt-ink hover:underline" onClick={() => navigate('/')}>
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
