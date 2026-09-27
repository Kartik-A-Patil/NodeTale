import { useEffect, useRef, useState } from 'react';

/** Open state for a floating menu: closes on outside pointer-down or Escape. */
export function usePopover<T extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

// Shared look for everything that floats over the canvas.
export const island = 'rounded-xl border border-nt-line bg-nt-surface shadow-lg shadow-black/40';
export const menuPanel = 'absolute z-40 min-w-52 overflow-hidden rounded-lg border border-nt-line bg-nt-surface py-1 shadow-2xl shadow-black/50';
export const menuItem = 'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm text-nt-ink-2 outline-none hover:bg-nt-raised hover:text-nt-ink focus-visible:bg-nt-raised focus-visible:text-nt-ink disabled:pointer-events-none disabled:opacity-40';
export const toolButton = 'inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-lg px-1.5 text-nt-ink-2 transition-colors duration-150 hover:bg-nt-raised hover:text-nt-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-nt-focus disabled:pointer-events-none disabled:opacity-35';
export const toolButtonActive = 'bg-nt-raised text-nt-ink';
