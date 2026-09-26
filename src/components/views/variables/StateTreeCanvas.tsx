import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hierarchy, tree as d3tree, HierarchyPointNode } from 'd3-hierarchy';
import { linkHorizontal } from 'd3-shape';
import { StateTree, StateTreeNode, pathTo } from '../../../core/sim/stateTree';
import { Simulator, formatValue, branchLabel } from '../../../core/sim/simulate';
import { StoryGraph } from '../../../core/graph/storyGraph';
import { EmptyView, itemProps, truncate } from '../shared';
import { useZoomPan } from '../shared';

const ROW = 84;
const COL = 300;
const BOX_W = 244;
const BOX_H = 66;
// Folding defaults: a loop is shown once (a path is folded the third time it
// reaches the same scene); if that still leaves a huge tree, fold deep levels too.
const FOLD_ON_VISIT = 3;
const AUTO_COLLAPSE_SIZE = 250;
const AUTO_COLLAPSE_DEPTH = 10;

interface StateTreeCanvasProps {
  tree: StateTree;
  sim: Simulator;
  graph: StoryGraph;
  watch: string[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onShowMore: () => void;
  /** Exposes fit/zoom to the frame header. */
  controlsRef: React.MutableRefObject<{ fit: () => void; zoomBy: (k: number) => void } | null>;
}

const change = (node: StateTreeNode, name: string) =>
  `${name} ${formatValue(node.before[name], 10)} → ${formatValue(node.after[name], 10)}`;

const linkPath = linkHorizontal<{ source: [number, number]; target: [number, number] }, [number, number]>()
  .source((d) => d.source)
  .target((d) => d.target);

export function StateTreeCanvas({ tree, sim, graph, watch, selectedKey, onSelect, onShowMore, controlsRef }: StateTreeCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const contentRef = useRef<SVGGElement>(null);
  const { fit, zoomBy, centerOn } = useZoomPan(svgRef, contentRef);
  const fitReadable = useCallback(() => fit({ minScale: 0.8, anchor: [-BOX_W / 2, 0] }), [fit]);
  controlsRef.current = { fit: fitReadable, zoomBy };

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Big trees open folded below a readable depth (re-applied when the tree is rebuilt).
  useEffect(() => {
    const folded = new Set<string>();
    if (tree.root) {
      let visible = 0;
      const walk = (n: StateTreeNode) => {
        visible++;
        if (n.visit >= FOLD_ON_VISIT && n.children.length) folded.add(n.key);
        else n.children.forEach(walk);
      };
      walk(tree.root);
      if (visible > AUTO_COLLAPSE_SIZE) {
        const deep = (n: StateTreeNode, depth: number) => {
          if (folded.has(n.key)) return;
          if (depth >= AUTO_COLLAPSE_DEPTH && n.children.length) folded.add(n.key);
          else n.children.forEach((c) => deep(c, depth + 1));
        };
        deep(tree.root, 0);
      }
    }
    setCollapsed(folded);
  }, [tree]);

  const layout = useMemo(() => {
    if (!tree.root) return null;
    const root = hierarchy(tree.root, (d) => (collapsed.has(d.key) ? null : d.children));
    return d3tree<StateTreeNode>().nodeSize([ROW, COL])(root);
  }, [tree, collapsed]);

  const fitted = useRef(false);
  useEffect(() => {
    if (!layout || fitted.current) return;
    fitted.current = true;
    requestAnimationFrame(fitReadable);
  }, [layout, fitReadable]);

  // A state selected from outside the canvas (Problems → "Show in state tree")
  // may be inside a folded branch: unfold its ancestors, then bring it into view.
  const revealRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedKey) return;
    revealRef.current = selectedKey;
    setCollapsed((prev) => {
      const ancestors = selectedKey.split('.').map((_, i, parts) => parts.slice(0, i + 1).join('.')).slice(0, -1);
      if (!ancestors.some((a) => prev.has(a))) return prev;
      const next = new Set(prev);
      ancestors.forEach((a) => next.delete(a));
      return next;
    });
  }, [selectedKey]);
  useEffect(() => {
    const key = revealRef.current;
    if (!key || !layout) return;
    const target = layout.descendants().find((n) => n.data.key === key);
    if (!target) return;
    revealRef.current = null;
    const svg = svgRef.current;
    const box = svg?.getBoundingClientRect();
    const node = svg?.querySelector(`[data-state-key="${CSS.escape(key)}"]`)?.getBoundingClientRect();
    // Only move the view when the node isn't already comfortably visible.
    if (!box || !node || node.left < box.left || node.right > box.right || node.top < box.top || node.bottom > box.bottom) {
      requestAnimationFrame(() => centerOn(target.y, target.x));
    }
  }, [layout, selectedKey, centerOn]);

  // Highlight the route from Start to the selected state.
  const onRoute = useMemo(() => new Set(selectedKey ? pathTo(tree, selectedKey).map((n) => n.key) : []), [tree, selectedKey]);

  const hiddenCount = (n: StateTreeNode): number => n.children.reduce((sum, c) => sum + 1 + hiddenCount(c), 0);
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (!layout) {
    return (
      <EmptyView title="No Start node yet">
        Name a scene “Start”. The state tree then follows every path from it and shows what each variable holds at every step.
      </EmptyView>
    );
  }

  const nodes = layout.descendants() as HierarchyPointNode<StateTreeNode>[];

  return (
    <svg ref={svgRef} className="h-full w-full cursor-grab active:cursor-grabbing" role="group" aria-label="Variable state tree"
      onFocus={(e) => {
        // Keyboard focus on an off-screen state pans it into view.
        const holder = (e.target as Element).closest('[data-state-key]');
        const target = holder && layout.descendants().find((n) => n.data.key === holder.getAttribute('data-state-key'));
        const box = svgRef.current?.getBoundingClientRect();
        const r = holder?.getBoundingClientRect();
        if (target && box && r && (r.left < box.left || r.right > box.right || r.top < box.top || r.bottom > box.bottom)) centerOn(target.y, target.x);
      }}>
      <g ref={contentRef}>
        {layout.links().map((link) => {
          const hot = onRoute.has(link.target.data.key);
          const stub = link.target.data.kind !== 'scene';
          return (
            <path key={link.target.data.key}
              d={linkPath({ source: [link.source.y + BOX_W / 2, link.source.x], target: [link.target.y - BOX_W / 2, link.target.x] }) ?? undefined}
              fill="none" strokeWidth={hot ? 2.25 : 1.5}
              stroke={hot ? 'oklch(var(--nt-accent))' : stub ? 'oklch(var(--nt-line-strong))' : 'oklch(var(--nt-ink-3) / 0.6)'}
              strokeDasharray={stub ? '4 4' : undefined} />
          );
        })}
        {nodes.map((n) => {
          const d = n.data;
          const scene = sim.node(d.nodeId)?.node;
          const label = scene?.data?.label || graph.nodes.get(d.nodeId)?.label || 'Scene';
          const x = n.y - BOX_W / 2;
          const y = n.x - BOX_H / 2;
          const selected = d.key === selectedKey;

          if (d.kind !== 'scene') {
            const repeated = d.repeats ? sim.node(tree.byKey.get(d.repeats)?.nodeId ?? '')?.node?.data?.label : undefined;
            const text = d.kind === 'more' ? 'More states… show more'
              : d.kind === 'loop' ? `⟲ back to ${repeated ?? label}, same values`
              : `↩ same state as ${repeated ?? label}`;
            return (
              <g key={d.key} transform={`translate(${x},${y + 14})`} data-state-key={d.key}
                {...itemProps(d.kind === 'more' ? 'Show more states' : `${text}. Select`, () => (d.kind === 'more' ? onShowMore() : onSelect(d.repeats ?? d.key)))}>
                <rect className="nt-focus-ring" x={-3} y={-3} width={BOX_W + 6} height={34} rx={17} fill="none" stroke="oklch(var(--nt-focus))" strokeWidth={2} />
                <rect width={BOX_W} height={28} rx={14} fill="oklch(var(--nt-bg))" stroke={d.kind === 'more' ? 'oklch(var(--nt-accent))' : 'oklch(var(--nt-line-strong))'} strokeDasharray="4 3" />
                <text x={14} y={18} fontSize="11.5" fill={d.kind === 'more' ? 'oklch(var(--nt-accent))' : 'oklch(var(--nt-ink-2))'}>{truncate(text, 36)}</text>
              </g>
            );
          }

          const isStart = d.nodeId === sim.startId;
          const isCondition = scene?.type === 'conditionNode';
          const status = d.error ? 'ERROR' : d.noBranch ? 'STOPS' : d.isEnding ? 'END' : null;
          const line2 = isCondition
            ? d.branchTaken ? `took: ${branchLabel(d.branchTaken)}` : 'no branch matches: story stops'
            : d.changed.length ? d.changed.map((c) => change(d, c)).join(' · ') : d.error ? d.error : 'no change';
          const line2Color = (isCondition && !d.branchTaken) || d.error ? 'oklch(var(--nt-danger))'
            : isCondition ? 'oklch(var(--nt-branch-0))' : d.changed.length ? 'oklch(var(--nt-accent))' : 'oklch(var(--nt-ink-3))';
          const watched = watch.map((w) => `${w} ${formatValue(d.after[w], 8)}`).join(' · ');
          const hasChildren = d.children.length > 0;
          const isCollapsed = collapsed.has(d.key);
          const a11y = `${label}. ${line2}.${watched ? ` ${watched}.` : ''}${status ? ` ${status}.` : ''} Select to see all values`;

          return (
            <g key={d.key} transform={`translate(${x},${y})`} data-state-key={d.key}>
              <g {...itemProps(a11y, () => onSelect(d.key))}>
                <rect className="nt-focus-ring" x={-3} y={-3} width={BOX_W + 6} height={BOX_H + 6} rx={10} fill="none" stroke="oklch(var(--nt-focus))" strokeWidth={2} />
                <rect width={BOX_W} height={BOX_H} rx={8} fill="oklch(var(--nt-surface))"
                  stroke={selected ? 'oklch(var(--nt-accent))' : d.error || d.noBranch ? 'oklch(var(--nt-danger))' : isStart ? 'oklch(var(--nt-accent) / 0.6)' : 'oklch(var(--nt-line))'}
                  strokeWidth={selected ? 2 : 1} strokeDasharray={d.noBranch ? '4 3' : undefined} />
                {isCondition ? (
                  <path d="M16 8 L24 16 L16 24 L8 16 Z" fill="oklch(var(--nt-branch-0))" />
                ) : scene?.type === 'jumpNode' ? (
                  <path d="M9 9 L24 16 L9 23 Z" fill="oklch(var(--nt-branch-3))" />
                ) : (
                  <circle cx={16} cy={16} r={6.5} fill={isStart ? 'oklch(var(--nt-accent))' : 'oklch(var(--nt-ink-2))'} />
                )}
                <text x={30} y={20.5} fontSize="12.5" fontWeight={600} fill="oklch(var(--nt-ink))">{truncate(label, status ? 20 : 26)}</text>
                {status && (
                  <g transform={`translate(${BOX_W - 50},8)`}>
                    <rect width={42} height={16} rx={8} fill="oklch(var(--nt-raised))" stroke={status === 'END' ? 'oklch(var(--nt-line-strong))' : 'oklch(var(--nt-danger))'} />
                    <text x={21} y={11.5} textAnchor="middle" fontSize="9" fontWeight="700" fill={status === 'END' ? 'oklch(var(--nt-ink-2))' : 'oklch(var(--nt-danger))'}>{status}</text>
                  </g>
                )}
                <text x={12} y={40} fontSize="11" className="font-mono" fill={line2Color}>{truncate(line2, 36)}</text>
                {watched && <text x={12} y={57} fontSize="11" className="font-mono" fill="oklch(var(--nt-ink-3))">{truncate(watched, 36)}</text>}
              </g>
              {hasChildren && (
                <g transform={`translate(${BOX_W + 12},${BOX_H / 2})`} {...itemProps(`${isCollapsed ? 'Expand' : 'Collapse'} ${hiddenCount(d)} states after ${label}`, () => toggle(d.key))}>
                  <rect className="nt-focus-ring" x={-12} y={-12} width={24} height={24} rx={12} fill="none" stroke="oklch(var(--nt-focus))" strokeWidth={2} />
                  <circle r={9} fill="oklch(var(--nt-raised))" stroke="oklch(var(--nt-line-strong))" />
                  <text y={4} textAnchor="middle" fontSize="12" fill="oklch(var(--nt-ink-2))">{isCollapsed ? '+' : '−'}</text>
                  {isCollapsed && <text x={14} y={4} fontSize="11" fill="oklch(var(--nt-ink-3))">{hiddenCount(d)} hidden</text>}
                </g>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
