import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hierarchy, tree as d3tree, HierarchyPointNode } from 'd3-hierarchy';
import { linkHorizontal } from 'd3-shape';
import { StateTree, StateTreeNode, pathTo } from '../../../core/sim/stateTree';
import { Simulator, formatValue, branchLabel, valuesEqual } from '../../../core/sim/simulate';
import { StoryGraph } from '../../../core/graph/storyGraph';
import { EmptyView, itemProps, truncate, useTooltip, Tooltip } from '../shared';
import { useZoomPan } from '../shared';

// Layout (px, before zoom). Boxes are as tall as their content; the tree
// spaces siblings by their real heights (see `separation`).
const COL = 320;
const BOX_W = 260;
const PAD_X = 12;
const TITLE_H = 30;
const LINE_H = 16;
const PAD_BOTTOM = 10;
const GAP = 18;
const STUB_H = 28;
// ~6.6px per char at 11px monospace inside BOX_W minus padding.
const CHARS_PER_LINE = Math.floor((BOX_W - PAD_X * 2) / 6.6);

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

type Tone = 'change' | 'branch' | 'danger' | 'muted' | 'watch';
interface Line {
  text: string;
  tone: Tone;
}

const TONE: Record<Tone, string> = {
  change: 'oklch(var(--nt-accent))',
  branch: 'oklch(var(--nt-branch-0))',
  danger: 'oklch(var(--nt-danger))',
  muted: 'oklch(var(--nt-ink-3))',
  watch: 'oklch(var(--nt-ink-2))',
};

/** Hard-wrap a line of monospace text to the box width (values are never cut off). */
const wrap = (text: string, tone: Tone): Line[] => {
  const out: Line[] = [];
  for (let i = 0; i < text.length; i += CHARS_PER_LINE) out.push({ text: text.slice(i, i + CHARS_PER_LINE), tone });
  return out.length ? out : [{ text: '', tone }];
};

const full = (v: unknown) => formatValue(v, 10_000);

/** Everything a state box shows, one entry per rendered line. */
function linesOf(d: StateTreeNode, isCondition: boolean, watch: string[]): Line[] {
  const lines: Line[] = [];
  if (isCondition) {
    lines.push(...(d.branchTaken ? wrap(`takes ${branchLabel(d.branchTaken)}`, 'branch') : wrap('no branch matches: story stops', 'danger')));
  }
  for (const name of d.changed) lines.push(...wrap(`${name} ${full(d.before[name])} → ${full(d.after[name])}`, 'change'));
  if (d.error) lines.push(...wrap(d.error, 'danger'));
  for (const name of watch) {
    if (!d.changed.includes(name)) lines.push(...wrap(`${name} ${full(d.after[name])}`, 'watch'));
  }
  if (lines.length === 0) lines.push({ text: 'no change', tone: 'muted' });
  return lines;
}

const heightOf = (d: StateTreeNode, lines: Line[]) => (d.kind === 'scene' ? TITLE_H + lines.length * LINE_H + PAD_BOTTOM : STUB_H);

const linkPath = linkHorizontal<{ source: [number, number]; target: [number, number] }, [number, number]>()
  .source((d) => d.source)
  .target((d) => d.target);

export function StateTreeCanvas({ tree, sim, graph, watch, selectedKey, onSelect, onShowMore, controlsRef }: StateTreeCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const contentRef = useRef<SVGGElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const { fit, zoomBy, centerOn } = useZoomPan(svgRef, contentRef);
  const { tooltip, show, hide } = useTooltip(frameRef);
  const fitReadable = useCallback(() => fit({ minScale: 0.8, anchor: [-BOX_W / 2, 0] }), [fit]);
  controlsRef.current = { fit: fitReadable, zoomBy };

  const label = useCallback((id: string) => sim.node(id)?.node.data?.label || graph.nodes.get(id)?.label || 'Scene', [sim, graph]);
  const isCondition = useCallback((id: string) => sim.node(id)?.node.type === 'conditionNode', [sim]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Fold defaults are re-applied whenever the tree is rebuilt (new scenario).
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

  // Lines per state, computed once per tree/watch list and shared by layout + render.
  const linesByKey = useMemo(() => {
    const map = new Map<string, Line[]>();
    for (const n of tree.byKey.values()) map.set(n.key, n.kind === 'scene' ? linesOf(n, isCondition(n.nodeId), watch) : []);
    return map;
  }, [tree, watch, isCondition]);
  const heightFor = useCallback((d: StateTreeNode) => heightOf(d, linesByKey.get(d.key) ?? []), [linesByKey]);

  const layout = useMemo(() => {
    if (!tree.root) return null;
    const root = hierarchy(tree.root, (d) => (collapsed.has(d.key) ? null : d.children));
    // nodeSize height 1 => separation() is in pixels: half of each box plus a gap.
    return d3tree<StateTreeNode>()
      .nodeSize([1, COL])
      .separation((a, b) => heightFor(a.data) / 2 + heightFor(b.data) / 2 + GAP * (a.parent === b.parent ? 1 : 1.6))(root);
  }, [tree, collapsed, heightFor]);

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
    if (!box || !node || node.left < box.left || node.right > box.right || node.top < box.top || node.bottom > box.bottom) {
      requestAnimationFrame(() => centerOn(target.y, target.x));
    }
  }, [layout, selectedKey, centerOn]);

  const onRoute = useMemo(() => new Set(selectedKey ? pathTo(tree, selectedKey).map((n) => n.key) : []), [tree, selectedKey]);

  const hiddenCount = (n: StateTreeNode): number => n.children.reduce((sum, c) => sum + 1 + hiddenCount(c), 0);
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Hover card: every variable with its full value at this point.
  const card = (d: StateTreeNode) => {
    const steps = pathTo(tree, d.key).length;
    return (
      <div className="min-w-56">
        <div className="font-medium text-nt-ink">{label(d.nodeId)}</div>
        <div className="text-nt-ink-3">{steps} {steps === 1 ? 'scene' : 'scenes'} from Start</div>
        <table className="mt-2 w-full font-mono text-[11px]">
          <tbody>
            {sim.variables.map((v) => {
              const changed = d.changed.includes(v.name);
              return (
                <tr key={v.id} className="align-top">
                  <th scope="row" className="pr-3 text-left font-normal text-nt-ink-3">{v.name}</th>
                  <td className={`break-all ${changed ? 'text-nt-accent' : valuesEqual(d.after[v.name], v.value) ? 'text-nt-ink-2' : 'text-nt-ink'}`}>
                    {changed && <span className="text-nt-ink-3">{full(d.before[v.name])} → </span>}{full(d.after[v.name])}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-2 text-nt-ink-3">Click to pin in the side panel</div>
      </div>
    );
  };

  if (!layout) {
    return (
      <EmptyView title="No Start node yet">
        Name a scene “Start”. The state tree then follows every path from it and shows what each variable holds at every step.
      </EmptyView>
    );
  }

  const nodes = layout.descendants() as HierarchyPointNode<StateTreeNode>[];

  return (
    <div ref={frameRef} className="relative h-full w-full">
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
            const h = heightFor(d);
            const x = n.y - BOX_W / 2;
            const y = n.x - h / 2;
            const selected = d.key === selectedKey;

            if (d.kind !== 'scene') {
              const repeated = d.repeats ? label(tree.byKey.get(d.repeats)?.nodeId ?? d.nodeId) : label(d.nodeId);
              const text = d.kind === 'more' ? 'More states… show more'
                : d.kind === 'loop' ? `⟲ back to ${repeated}, same values`
                : `↩ same state as ${repeated}`;
              return (
                <g key={d.key} transform={`translate(${x},${y})`} data-state-key={d.key}
                  {...itemProps(d.kind === 'more' ? 'Show more states' : `${text}. Select the original`, () => (d.kind === 'more' ? onShowMore() : onSelect(d.repeats ?? d.key)))}>
                  <rect className="nt-focus-ring" x={-3} y={-3} width={BOX_W + 6} height={STUB_H + 6} rx={17} fill="none" stroke="oklch(var(--nt-focus))" strokeWidth={2} />
                  <rect width={BOX_W} height={STUB_H} rx={14} fill="oklch(var(--nt-bg))" stroke={d.kind === 'more' ? 'oklch(var(--nt-accent))' : 'oklch(var(--nt-line-strong))'} strokeDasharray="4 3" />
                  <text x={14} y={18} fontSize="11.5" fill={d.kind === 'more' ? 'oklch(var(--nt-accent))' : 'oklch(var(--nt-ink-2))'}>{truncate(text, 38)}</text>
                </g>
              );
            }

            const scene = sim.node(d.nodeId)?.node;
            const lines = linesByKey.get(d.key) ?? [];
            const isStart = d.nodeId === sim.startId;
            const status = d.error ? 'ERROR' : d.noBranch ? 'STOPS' : d.isEnding ? 'END' : null;
            const hasChildren = d.children.length > 0;
            const isCollapsed = collapsed.has(d.key);
            const a11y = `${label(d.nodeId)}. ${lines.map((l) => l.text).join(' ')}${status ? `. ${status}` : ''}. Select to pin all values`;

            return (
              <g key={d.key} transform={`translate(${x},${y})`} data-state-key={d.key}>
                <g {...itemProps(a11y, () => onSelect(d.key))} onMouseMove={(e) => show(e, card(d))} onMouseLeave={hide}>
                  <rect className="nt-focus-ring" x={-3} y={-3} width={BOX_W + 6} height={h + 6} rx={10} fill="none" stroke="oklch(var(--nt-focus))" strokeWidth={2} />
                  <rect width={BOX_W} height={h} rx={8} fill="oklch(var(--nt-surface))"
                    stroke={selected ? 'oklch(var(--nt-accent))' : d.error || d.noBranch ? 'oklch(var(--nt-danger))' : isStart ? 'oklch(var(--nt-accent) / 0.6)' : 'oklch(var(--nt-line))'}
                    strokeWidth={selected ? 2 : 1} strokeDasharray={d.noBranch ? '4 3' : undefined} />
                  {scene?.type === 'conditionNode' ? (
                    <path d="M16 8 L24 16 L16 24 L8 16 Z" fill="oklch(var(--nt-branch-0))" />
                  ) : scene?.type === 'jumpNode' ? (
                    <path d="M9 9 L24 16 L9 23 Z" fill="oklch(var(--nt-branch-3))" />
                  ) : (
                    <circle cx={16} cy={16} r={6.5} fill={isStart ? 'oklch(var(--nt-accent))' : 'oklch(var(--nt-ink-2))'} />
                  )}
                  <text x={30} y={20.5} fontSize="12.5" fontWeight={600} fill="oklch(var(--nt-ink))">{truncate(label(d.nodeId), status ? 24 : 30)}</text>
                  {status && (
                    <g transform={`translate(${BOX_W - 50},8)`}>
                      <rect width={42} height={16} rx={8} fill="oklch(var(--nt-raised))" stroke={status === 'END' ? 'oklch(var(--nt-line-strong))' : 'oklch(var(--nt-danger))'} />
                      <text x={21} y={11.5} textAnchor="middle" fontSize="9" fontWeight="700" fill={status === 'END' ? 'oklch(var(--nt-ink-2))' : 'oklch(var(--nt-danger))'}>{status}</text>
                    </g>
                  )}
                  {lines.map((line, i) => (
                    <text key={i} x={PAD_X} y={TITLE_H + i * LINE_H + 11} fontSize="11" className="font-mono" fill={TONE[line.tone]} xmlSpace="preserve">
                      {line.text}
                    </text>
                  ))}
                </g>
                {hasChildren && (
                  <g transform={`translate(${BOX_W + 12},${h / 2})`} {...itemProps(`${isCollapsed ? 'Expand' : 'Collapse'} ${hiddenCount(d)} states after ${label(d.nodeId)}`, () => toggle(d.key))}>
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
      <Tooltip tooltip={tooltip} />
    </div>
  );
}
