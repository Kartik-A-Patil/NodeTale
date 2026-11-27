import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Minimize2 } from 'lucide-react';
import { LazyRichTextEditor } from './LazyRichTextEditor';
import { toolButton } from './editorStyles';

interface ExpandedEditorProps {
  title: string;
  initialValue: string;
  onChange: (value: string) => void;
  onClose: () => void;
}

// A roomier writing surface for long passages. Native modal <dialog>: focus is
// trapped, Escape closes, and it sits above the canvas without z-index games.
export function ExpandedEditor({ title, initialValue, onChange, onClose }: ExpandedEditorProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return createPortal(
    <dialog
      ref={ref}
      aria-label={`Edit ${title}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // Portaled out of the canvas node in the DOM, but React still bubbles
      // events to it: keep clicks from selecting or opening menus on the node.
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === ref.current) onClose();
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
      className="nt-dialog flex h-[min(85vh,52rem)] w-[min(52rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-nt-line bg-nt-surface p-0 text-nt-ink shadow-2xl [&:not([open])]:hidden"
    >
      <header className="flex items-center gap-3 border-b border-nt-line py-2 pl-6 pr-2">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-nt-ink">{title || 'Untitled scene'}</h2>
        <span className="hidden text-xs text-nt-ink-3 sm:inline">
          <kbd className="font-sans">/</kbd> blocks · <kbd className="font-sans">{'{{'}</kbd> variables · <kbd className="font-sans">Esc</kbd> close
        </span>
        <button type="button" onClick={onClose} className={toolButton} aria-label="Back to the canvas" title="Back to the canvas">
          <Minimize2 size={16} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden px-6 py-5 text-[15px] leading-relaxed text-nt-ink-2 sm:px-10">
        <LazyRichTextEditor initialValue={initialValue} onChange={onChange} onEscape={onClose} />
      </div>
    </dialog>,
    document.body,
  );
}
