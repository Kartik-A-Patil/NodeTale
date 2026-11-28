import { useEffect, useState } from 'react';
import { codeFromPasted } from '../../services/shareLink';
import { Dialog } from '../ui/NativeDialog';
import { buttonPrimary, buttonSecondary } from '../ui/styles';

// Paste a share link (or the bare code the desktop app shares) to open it.
export function OpenShareLinkModal({ open, onClose, onOpen }: { open: boolean; onClose: () => void; onOpen: (code: string) => void }) {
  const [text, setText] = useState('');
  useEffect(() => { if (open) setText(''); }, [open]);
  const code = codeFromPasted(text);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Open a share link"
      description="Paste the NodeTale share link or code someone sent you to receive their story."
      onSubmit={(e) => { e.preventDefault(); if (code) onOpen(code); }}
      actions={
        <>
          <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" className={buttonPrimary} disabled={!code}>Open</button>
        </>
      }
    >
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="https://…/share#v2.…"
        aria-label="Share link or code"
        rows={4}
        className="w-full resize-none break-all rounded-md border border-nt-line-strong bg-nt-bg p-2.5 font-mono text-xs text-nt-ink placeholder:text-nt-ink-3"
      />
    </Dialog>
  );
}
