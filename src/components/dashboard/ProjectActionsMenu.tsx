import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, FolderOpen, PenLine, Copy, ImagePlus, ImageOff, Download, Trash2 } from 'lucide-react';
import { buttonGhostIcon } from '../ui/styles';

export interface ProjectActions {
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onChangeCover: (file: File) => void;
  onRemoveCover?: () => void;
  onDelete: () => void;
}

const item = 'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-nt-ink-2 outline-none hover:bg-nt-raised hover:text-nt-ink focus-visible:bg-nt-raised focus-visible:text-nt-ink';

export function ProjectActionsMenu({ name, actions }: { name: string; actions: ProjectActions }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const run = (fn: () => void) => () => {
    close(false);
    fn();
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role=menuitem]') || [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus(); }
    else if (e.key === 'Tab') close(false);
  };

  return (
    <div ref={rootRef} className="relative" onKeyDown={(e) => e.stopPropagation()}>
      <button ref={triggerRef} type="button" className={buttonGhostIcon} aria-label={`Actions for ${name}`}
        aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <MoreHorizontal size={17} />
      </button>
      {open && (
        <div ref={menuRef} role="menu" aria-label={`Actions for ${name}`} onKeyDown={onMenuKey}
          className="absolute right-0 top-9 z-30 w-52 overflow-hidden rounded-lg border border-nt-line bg-nt-surface py-1 shadow-2xl">
          <button role="menuitem" tabIndex={-1} className={item} onClick={run(actions.onOpen)}><FolderOpen size={15} aria-hidden /> Open</button>
          <button role="menuitem" tabIndex={-1} className={item} onClick={run(actions.onRename)}><PenLine size={15} aria-hidden /> Rename <kbd className="ml-auto font-mono text-[11px] text-nt-ink-3">F2</kbd></button>
          <button role="menuitem" tabIndex={-1} className={item} onClick={run(actions.onDuplicate)}><Copy size={15} aria-hidden /> Duplicate</button>
          <button role="menuitem" tabIndex={-1} className={item} onClick={run(actions.onExport)}><Download size={15} aria-hidden /> Export as .json</button>
          <button role="menuitem" tabIndex={-1} className={item} onClick={() => { close(false); fileRef.current?.click(); }}><ImagePlus size={15} aria-hidden /> Change cover…</button>
          {actions.onRemoveCover && (
            <button role="menuitem" tabIndex={-1} className={item} onClick={run(actions.onRemoveCover)}><ImageOff size={15} aria-hidden /> Remove cover</button>
          )}
          <div className="my-1 h-px bg-nt-line" role="separator" />
          <button role="menuitem" tabIndex={-1} className={`${item} text-nt-danger hover:text-nt-danger focus-visible:text-nt-danger`} onClick={run(actions.onDelete)}>
            <Trash2 size={15} aria-hidden /> Delete <kbd className="ml-auto font-mono text-[11px] text-nt-ink-3">Del</kbd>
          </button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) actions.onChangeCover(file);
        }} />
    </div>
  );
}
