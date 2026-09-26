import React, { useEffect, useRef } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Buttons, right-aligned. */
  actions: React.ReactNode;
  /** Wraps content + actions in a form so Enter submits. */
  onSubmit?: (e: React.FormEvent) => void;
}

// Native <dialog> with showModal(): focus is trapped, Escape closes, the rest
// of the page is inert, and the backdrop comes from ::backdrop. No portal or
// focus-trap library needed.
export function Dialog({ open, onClose, title, description, children, actions, onSubmit }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const body = (
    <>
      <h2 className="text-base font-semibold text-nt-ink">{title}</h2>
      {description && <div className="mt-1.5 text-sm leading-relaxed text-nt-ink-2">{description}</div>}
      {children && <div className="mt-5">{children}</div>}
      <div className="mt-6 flex justify-end gap-2">{actions}</div>
    </>
  );

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // Click on the backdrop (the dialog element itself, outside the panel) closes.
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
      className="nt-dialog w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-nt-line bg-nt-surface p-0 text-nt-ink shadow-2xl"
    >
      {onSubmit ? (
        <form onSubmit={onSubmit} className="p-6">{body}</form>
      ) : (
        <div className="p-6">{body}</div>
      )}
    </dialog>
  );
}
