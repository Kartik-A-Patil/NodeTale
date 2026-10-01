import { memo, useLayoutEffect, useRef } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import { renderStoryHtml } from '../../utils/html';

/** Where a double-click started editing, so the editor can put the caret there. */
export interface EditStart {
  x: number;
  y: number;
  scrollTop: number;
}

// Rendered (sanitized, variable-wrapped, Prism-highlighted) HTML by source. With
// viewport culling nodes remount as they scroll into view; this skips redoing
// that work for content rendered before. Bounded for large boards.
const RENDER_CACHE_LIMIT = 1000;
const renderCache = new Map<string, string>();

const renderInto = (target: HTMLElement, html: string) => {
  const cached = renderCache.get(html);
  if (cached !== undefined) {
    target.innerHTML = cached;
    return;
  }
  target.innerHTML = renderStoryHtml(html);
  Prism.highlightAllUnder(target);
  if (renderCache.size >= RENDER_CACHE_LIMIT) renderCache.delete(renderCache.keys().next().value!);
  renderCache.set(html, target.innerHTML);
};

interface StoryTextProps {
  html: string;
  placeholder?: string;
  onStartEdit?: (start: EditStart) => void;
}

// Read-only story text. Same boxes as RichTextEditor (column > scroll container
// > .nt-prose) and the same stylesheet, so swapping one for the other is
// pixel-identical apart from the caret.
export const StoryText = memo(function StoryText({ html, placeholder, onStartEdit }: StoryTextProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const proseRef = useRef<HTMLDivElement>(null);

  // Layout effect: the text must be in place before paint, or leaving the
  // editor would flash an empty node for a frame.
  useLayoutEffect(() => {
    if (proseRef.current) renderInto(proseRef.current, html);
  }, [html]);

  return (
    <div
      className="relative flex h-full w-full flex-col"
      onDoubleClick={onStartEdit && ((event) => {
        event.stopPropagation();
        onStartEdit({ x: event.clientX, y: event.clientY, scrollTop: scrollRef.current?.scrollTop ?? 0 });
      })}
    >
      <div ref={scrollRef} className="h-full w-full cursor-text overflow-auto">
        {!html && placeholder && (
          <span className="pointer-events-none absolute left-0 top-0 select-none italic text-nt-ink-3/70">{placeholder}</span>
        )}
        <div ref={proseRef} className="nt-prose markdown-content" />
      </div>
    </div>
  );
});
