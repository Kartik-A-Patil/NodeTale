import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Project } from '../../models/story';
import { encodeStory, shareUrl, LONG_LINK } from '../../services/shareLink';
import { Dialog } from '../ui/NativeDialog';
import { buttonPrimary, buttonSecondary } from '../ui/styles';

interface ShareStoryModalProps {
  /** The story to share (the live canvas when opened); null when closed. */
  project: Project | null;
  onClose: () => void;
}

// A link that holds the whole story. Anyone with it can play it or keep an
// editable copy; nothing is uploaded anywhere.
export function ShareStoryModal({ project, onClose }: ShareStoryModalProps) {
  const [text, setText] = useState('');
  const [isLink, setIsLink] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    setText('');
    setError('');
    setCopied(false);
    encodeStory(project).then(
      (code) => {
        if (cancelled) return;
        const url = shareUrl(code);
        setIsLink(!!url);
        setText(url ?? code);
      },
      (err) => !cancelled && setError(`Couldn’t make a link: ${err instanceof Error ? err.message : String(err)}`),
    );
    return () => { cancelled = true; };
  }, [project]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError('Couldn’t copy automatically. Select the text and copy it.');
    }
  };

  const hasMedia = !!project?.assets.length;

  return (
    <Dialog
      open={project !== null}
      onClose={onClose}
      title="Share a link"
      description={isLink
        ? 'Anyone with this link can play the story or keep an editable copy. Nothing is uploaded: the story is inside the link.'
        : 'Send this code. In NodeTale, they choose “Open a share link” on their stories page and paste it.'}
      actions={
        <>
          <button type="button" className={buttonSecondary} onClick={onClose}>Close</button>
          <button type="button" className={buttonPrimary} onClick={copy} disabled={!text}>
            {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? 'Copied' : isLink ? 'Copy link' : 'Copy code'}
          </button>
        </>
      }
    >
      <textarea
        readOnly
        value={text || 'Making the link…'}
        onFocus={(e) => e.currentTarget.select()}
        aria-label={isLink ? 'Share link' : 'Share code'}
        rows={4}
        className="w-full resize-none break-all rounded-md border border-nt-line bg-nt-bg p-2.5 font-mono text-xs leading-relaxed text-nt-ink-2"
      />
      <div className="mt-2 space-y-1.5 text-xs leading-relaxed text-nt-ink-3">
        {text && <p>{text.length.toLocaleString()} characters.{text.length > LONG_LINK && ' Some chat apps and email clients cut long links short; if it doesn’t open, send the story as a file instead.'}</p>}
        {hasMedia && <p>Images, sound and video aren’t included in links.</p>}
        {error && <p className="text-nt-danger">{error}</p>}
      </div>
    </Dialog>
  );
}
