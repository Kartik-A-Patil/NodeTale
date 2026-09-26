import React, { useCallback, useEffect, useRef, useState } from 'react';
import { select } from 'd3-selection';
import 'd3-transition'; // augments Selection with interrupt/transition, which d3-zoom's types expect
import { zoom, zoomIdentity, zoomTransform, ZoomBehavior, ZoomTransform } from 'd3-zoom';
import { ZoomIn, ZoomOut, Scan } from 'lucide-react';
import { BranchTag, branchLetter, GraphNode } from '../../core/graph/storyGraph';
import { htmlToText } from '../../utils/html';

export type FocusNode = (nodeId: string) => void;

// ---------- branch colour + marker (never colour alone) ----------

export type LaneTag = BranchTag | 'unreachable';

export const branchColor = (tag: LaneTag | undefined): string =>
  typeof tag === 'number' ? `oklch(var(--nt-branch-${tag % 8}))` : tag === 'shared' ? 'oklch(var(--nt-ink-2))' : 'oklch(var(--nt-ink-3))';

export const branchMark = (tag: LaneTag | undefined): string =>
  typeof tag === 'number' ? branchLetter(tag) : tag === 'shared' ? '∗' : tag === 'unreachable' ? '?' : '•';

export const branchName = (tag: LaneTag | undefined, roots: { label: string }[]): string =>
  typeof tag === 'number'
    ? `Branch ${branchLetter(tag)}${roots[tag] ? ` · ${roots[tag].label}` : ''}`
    : tag === 'shared' ? 'Shared by branches' : tag === 'unreachable' ? 'Not reachable from Start' : 'Before the first choice';

export const excerpt = (node: GraphNode, max = 140): string => {
  const text = node.content ? htmlToText(node.content).replace(/\s+/g, ' ').trim() : '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

export const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

// ---------- zoom / pan ----------

interface ZoomPanOptions {
  /** Called on every zoom event. Without it, the transform is applied to `contentRef` directly (no React render per frame). */
  onZoom?: (t: ZoomTransform) => void;
  scaleExtent?: [number, number];
}

// d3-zoom drives the maths and input handling; React owns the SVG. For views
// that only need a moved/scaled group, the transform is set on the element
// directly so panning a large map doesn't re-render it every frame.
export function useZoomPan(
  svgRef: React.RefObject<SVGSVGElement | null>,
  contentRef: React.RefObject<SVGGElement | null>,
  { onZoom, scaleExtent = [0.1, 3] }: ZoomPanOptions = {}
) {
  const behaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const onZoomRef = useRef(onZoom);
  onZoomRef.current = onZoom;
  const [minK, maxK] = scaleExtent;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([minK, maxK])
      .on('zoom', (event: { transform: ZoomTransform }) => {
        if (onZoomRef.current) onZoomRef.current(event.transform);
        else contentRef.current?.setAttribute('transform', event.transform.toString());
      });
    behaviorRef.current = behavior;
    const selection = select(svg);
    selection.call(behavior).on('dblclick.zoom', null);
    return () => {
      selection.on('.zoom', null);
    };
  }, [svgRef, contentRef, minK, maxK]);

  /**
   * Fit the content to the viewport. With `minScale`, never zoom out past a
   * readable level; if the content is then bigger than the view, `anchor`
   * (content coords) is kept at the left edge, vertically centred.
   */
  const fit = useCallback(({ padding = 48, minScale, anchor }: { padding?: number; minScale?: number; anchor?: [number, number] } = {}) => {
    const svg = svgRef.current;
    const content = contentRef.current;
    const behavior = behaviorRef.current;
    if (!svg || !behavior) return;
    if (!content || onZoomRef.current) {
      select(svg).call(behavior.transform, zoomIdentity);
      return;
    }
    const box = content.getBBox();
    const { clientWidth: w, clientHeight: h } = svg;
    if (!box.width || !box.height || !w || !h) return;
    const fitK = Math.min(1.25, (w - padding * 2) / box.width, (h - padding * 2) / box.height);
    const k = Math.max(minK, minScale ?? minK, fitK);
    let tx = (w - box.width * k) / 2 - box.x * k;
    let ty = (h - box.height * k) / 2 - box.y * k;
    if (k > fitK && anchor) {
      tx = padding - anchor[0] * k;
      ty = h / 2 - anchor[1] * k;
    }
    select(svg).call(behavior.transform, zoomIdentity.translate(tx, ty).scale(k));
  }, [svgRef, contentRef, minK]);

  const zoomBy = useCallback((factor: number) => {
    if (svgRef.current && behaviorRef.current) select(svgRef.current).call(behaviorRef.current.scaleBy, factor);
  }, [svgRef]);

  /** Pan (keeping the zoom, but at least `minScale`) so a content point sits in the middle. */
  const centerOn = useCallback((x: number, y: number, minScale = 0.8) => {
    const svg = svgRef.current;
    const behavior = behaviorRef.current;
    if (!svg || !behavior) return;
    const k = Math.max(zoomTransform(svg).k, minScale);
    select(svg).call(behavior.transform, zoomIdentity.translate(svg.clientWidth / 2 - x * k, svg.clientHeight / 2 - y * k).scale(k));
  }, [svgRef]);

  return { fit, zoomBy, centerOn };
}

// ---------- tooltip ----------

export interface TooltipState {
  x: number;
  y: number;
  content: React.ReactNode;
}

export function useTooltip(frameRef: React.RefObject<HTMLElement | null>) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const show = useCallback((event: { clientX: number; clientY: number }, content: React.ReactNode) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, content });
  }, [frameRef]);
  const hide = useCallback(() => setTooltip(null), []);
  return { tooltip, show, hide };
}

export const Tooltip = ({ tooltip }: { tooltip: TooltipState | null }) =>
  tooltip ? (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 max-w-xs rounded-md border border-nt-line bg-nt-raised px-3 py-2 text-xs text-nt-ink-2 shadow-lg"
      style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
    >
      {tooltip.content}
    </div>
  ) : null;

export const NodeTooltip = ({ node, extra }: { node: GraphNode; extra?: React.ReactNode }) => {
  const text = excerpt(node);
  return (
    <>
      <div className="font-medium text-nt-ink">{node.label}</div>
      <div className="text-nt-ink-3">{node.boardName}{node.date ? ` · ${new Date(node.date).toLocaleString()}` : ''}</div>
      {text && <div className="mt-1 leading-snug">{text}</div>}
      {extra && <div className="mt-1">{extra}</div>}
      <div className="mt-1.5 text-nt-ink-3">Click or press Enter to open on the canvas</div>
    </>
  );
};

// ---------- frame ----------

interface ViewFrameProps {
  title: string;
  summary?: React.ReactNode;
  legend?: React.ReactNode;
  onFit?: () => void;
  onZoom?: (factor: number) => void;
  aside?: React.ReactNode;
  /** Width of the side panel (Tailwind class). */
  asideClassName?: string;
  frameRef?: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}

const iconButton =
  'flex h-8 w-8 items-center justify-center rounded-md border border-nt-line bg-nt-surface text-nt-ink-2 transition-colors duration-150 hover:bg-nt-raised hover:text-nt-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-nt-focus';

export const ViewFrame = ({ title, summary, legend, onFit, onZoom, aside, asideClassName = 'w-64', frameRef, children }: ViewFrameProps) => (
  <section aria-label={title} className="absolute inset-0 flex flex-col bg-nt-bg text-nt-ink">
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-nt-line px-5 py-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-nt-ink">{title}</h2>
        {summary && <p className="text-xs text-nt-ink-3">{summary}</p>}
      </div>
      {legend && <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-nt-ink-2">{legend}</div>}
      {(onFit || onZoom) && (
        <div className="ml-auto flex gap-1.5">
          {onZoom && (
            <>
              <button type="button" className={iconButton} onClick={() => onZoom(1 / 1.3)} aria-label="Zoom out" title="Zoom out"><ZoomOut size={15} /></button>
              <button type="button" className={iconButton} onClick={() => onZoom(1.3)} aria-label="Zoom in" title="Zoom in"><ZoomIn size={15} /></button>
            </>
          )}
          {onFit && (
            <button type="button" className={iconButton} onClick={onFit} aria-label="Fit to view" title="Fit to view"><Scan size={15} /></button>
          )}
        </div>
      )}
    </header>
    <div className="flex min-h-0 flex-1">
      {/* overflow-clip, not hidden: focusing an off-screen SVG item would otherwise scroll this box and misalign the view. */}
      <div ref={frameRef} className="relative min-w-0 flex-1 overflow-clip">{children}</div>
      {aside && <aside className={`${asideClassName} shrink-0 overflow-y-auto border-l border-nt-line bg-nt-surface p-4 text-xs`}>{aside}</aside>}
    </div>
  </section>
);

export const EmptyView = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="flex h-full items-center justify-center p-8">
    <div className="max-w-sm text-center">
      <h3 className="text-sm font-semibold text-nt-ink">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-nt-ink-3">{children}</div>
    </div>
  </div>
);

export const LegendItem = ({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) => (
  <span className="flex items-center gap-1.5">
    <svg width="14" height="14" aria-hidden className="shrink-0">{swatch}</svg>
    {children}
  </span>
);

/** Keyboard + pointer props for an SVG item that opens a node on the canvas. */
export const itemProps = (label: string, onActivate: () => void) => ({
  role: 'button',
  tabIndex: 0,
  'aria-label': label,
  className: 'cursor-pointer outline-none nt-svg-item',
  onClick: onActivate,
  onKeyDown: (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate();
    }
  },
});
