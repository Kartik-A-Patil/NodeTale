import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { buttonPrimary, buttonSecondary, buttonGhostIcon, input, focusRing } from '../ui/styles';
import { shrinkCoverImage } from '../../utils/coverImage';

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  /** Resolves with an error message to show, or null on success. */
  onCreate: (name: string, coverImage: string | null) => Promise<string | null>;
}

export function CreateProjectModal({ open, onClose, onCreate }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [cover, setCover] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fresh form each time it opens.
  useEffect(() => {
    if (open) {
      setName('');
      setCover(null);
      setError('');
      setBusy(false);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give your story a name.');
      return;
    }
    setBusy(true);
    const problem = await onCreate(trimmed, cover);
    setBusy(false);
    if (problem) setError(problem);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New story"
      description="Start from a blank board with a Start scene. You can rename it or change the cover later."
      onSubmit={submit}
      actions={
        <>
          <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" className={buttonPrimary} disabled={busy}>{busy ? 'Creating…' : 'Create story'}</button>
        </>
      }
    >
      <label htmlFor="new-story-name" className="mb-1.5 block text-xs font-medium text-nt-ink-2">Name</label>
      <input
        id="new-story-name"
        autoFocus
        value={name}
        onChange={(e) => { setName(e.target.value); setError(''); }}
        placeholder="e.g. The Lighthouse Keeper"
        aria-invalid={!!error}
        aria-describedby={error ? 'new-story-error' : undefined}
        className={input}
      />
      {error && <p id="new-story-error" className="mt-1.5 text-xs text-nt-danger">{error}</p>}

      <div className="mt-4">
        <span className="mb-1.5 block text-xs font-medium text-nt-ink-2">Cover <span className="text-nt-ink-3">(optional)</span></span>
        {cover ? (
          <div className="relative overflow-hidden rounded-md border border-nt-line">
            <img src={cover} alt="Cover preview" className="aspect-[16/7] w-full object-cover" />
            <button type="button" onClick={() => setCover(null)} className={`${buttonGhostIcon} absolute right-2 top-2 bg-nt-bg/80`} aria-label="Remove cover">
              <X size={15} />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()}
            className={`flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-nt-line-strong py-5 text-sm text-nt-ink-3 transition-colors duration-150 hover:border-nt-ink-3 hover:text-nt-ink-2 ${focusRing}`}>
            <ImagePlus size={16} aria-hidden /> Choose an image
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" tabIndex={-1}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) setCover(await shrinkCoverImage(file));
          }} />
      </div>
    </Dialog>
  );
}
