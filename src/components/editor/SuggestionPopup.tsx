import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import type { SuggestionState } from './extensions/suggestionMenu';
import { editorPopup } from './editorStyles';

type KeyHandler = (event: KeyboardEvent) => boolean;

// Escapes that closed a menu, so the editor doesn't also treat them as "leave".
// (By the time the editor sees the key, the menu's state is already cleared.)
const menuEscapes = new WeakSet<KeyboardEvent>();
export const isMenuEscape = (event: KeyboardEvent) => menuEscapes.has(event);

/** State + stable callbacks wiring one SuggestionMenu extension to its popup. */
export function useSuggestion() {
  const [state, setState] = useState<SuggestionState | null>(null);
  const keyHandler = useRef<KeyHandler | null>(null);
  const [handlers] = useState(() => ({
    onChange: setState,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        menuEscapes.add(event);
        return false;
      }
      return keyHandler.current?.(event) ?? false;
    },
  }));
  return { state, keyHandler, handlers };
}

interface SuggestionPopupProps {
  state: SuggestionState | null;
  keyHandler: React.MutableRefObject<KeyHandler | null>;
  container: HTMLElement | null;
  /** Shown when nothing matches; without it the popup hides instead. */
  emptyText?: string;
  /** Code names (variables, functions) in the code font. */
  mono?: boolean;
}

// Compact, code-editor style list: one line per item, a small icon coloured by
// kind, the name, and its detail dimmed on the right.
export function SuggestionPopup({ state, keyHandler, container, emptyText, mono }: SuggestionPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  // The highlight resets whenever the item list changes (the query moved on).
  const [highlight, setHighlight] = useState({ items: state?.items, index: 0 });
  const items = state?.items ?? [];
  const index = highlight.items === state?.items ? Math.min(highlight.index, items.length - 1) : 0;
  const move = (next: number) => setHighlight({ items: state?.items, index: (next + items.length) % items.length });

  keyHandler.current = state && items.length ? (event) => {
    if (event.key === 'ArrowDown') { move(index + 1); return true; }
    if (event.key === 'ArrowUp') { move(index - 1); return true; }
    if (event.key === 'Enter' || event.key === 'Tab') { state.select(items[index]); return true; }
    return false;
  } : null;

  useLayoutEffect(() => {
    const el = ref.current;
    const rect = state?.clientRect();
    if (!el || !rect) return;
    computePosition({ getBoundingClientRect: () => rect }, el, {
      strategy: 'fixed',
      placement: 'bottom-start',
      middleware: [offset(6), flip(), shift({ padding: 8 })],
    }).then(({ x, y }) => Object.assign(el.style, { left: `${x}px`, top: `${y}px` }));
  });

  useLayoutEffect(() => {
    ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!state || !container || (!items.length && !emptyText)) return null;

  return createPortal(
    <div
      ref={ref}
      data-editor-popup
      role="listbox"
      className={`fixed left-0 top-0 z-[70] max-h-64 w-72 overflow-y-auto p-1 [font-variant-ligatures:none] ${editorPopup}`}
      onMouseDown={(event) => event.preventDefault()}
    >
      {items.length === 0 && <p className="px-2 py-1.5 text-xs text-nt-ink-3">{emptyText}</p>}
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={i === index}
            className="flex h-7 w-full items-center gap-2 rounded px-2 text-left text-nt-ink-2 aria-selected:bg-nt-raised aria-selected:text-nt-ink"
            onMouseEnter={() => setHighlight({ items: state.items, index: i })}
            onClick={() => state.select(item)}
          >
            {Icon && <Icon size={14} className="shrink-0" style={{ color: item.color }} aria-hidden />}
            <span className={`min-w-0 shrink truncate ${mono ? 'font-mono text-[12.5px]' : 'text-[13px]'}`}>{item.title}</span>
            {item.hint && <span className={`ml-auto min-w-0 truncate pl-3 text-[11px] text-nt-ink-3 ${mono ? 'font-mono' : ''}`}>{item.hint}</span>}
          </button>
        );
      })}
    </div>,
    container,
  );
}
