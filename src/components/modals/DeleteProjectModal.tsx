import { useState } from 'react';
import { Dialog } from '../ui/NativeDialog';
import { buttonDanger, buttonSecondary } from '../ui/styles';

interface DeleteProjectModalProps {
  /** Name of the story to delete; null when closed. */
  projectName: string | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteProjectModal({ projectName, onClose, onConfirm }: DeleteProjectModalProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={projectName !== null}
      onClose={onClose}
      title={`Delete “${projectName ?? ''}”?`}
      description="The story and all its boards will be removed from this device. This can’t be undone. Export it first if you might want it back."
      actions={
        <>
          <button type="button" className={buttonSecondary} onClick={onClose} autoFocus>Keep it</button>
          <button type="button" className={buttonDanger} disabled={busy}
            onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }}>
            {busy ? 'Deleting…' : 'Delete story'}
          </button>
        </>
      }
    />
  );
}
