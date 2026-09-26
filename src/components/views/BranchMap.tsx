import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hierarchy, tree, HierarchyPointNode } from 'd3-hierarchy';
import { linkHorizontal } from 'd3-shape';
import { StoryGraph } from '../../core/graph/storyGraph';
import {
  EmptyView, FocusNode, itemProps, LegendItem, NodeTooltip, Tooltip, ViewFrame,
  branchColor, branchMark, branchName, truncate, useTooltip, useZoomPan,
} from './shared';

interface TreeDatum {
  key: string;
  nodeId: string;
  /** node: first time the story reaches it; join: reached again from elsewhere; loop: leads back to an earlier node. */
  kind: 'node' | 'join' | 'loop';
  linkLabel?: string;
  children: TreeDatum[];
  descendants: number;
}

const ROW = 52;
const COL = 270;
const BOX_W = 190;
const BOX_H = 34;
// Big maps open with deeper levels folded so the first view is readable (and fast).
const AUTO_COLLAPSE_SIZE = 250;
const AUTO_COLLAPSE_DEPTH = 6;

// The story as a tree from Start. Each node appears once, where the story
// first reaches it; later arrivals become "joins"/"loops" stubs so shared
// paths and cycles stay visible without duplicating whole subtrees.
function buildTree(graph: StoryGraph): TreeDatum | null {
  if (!graph.startId) return null;
  const placed = new Set<string>([graph.startId]);
  const make = (nodeId: string, key: string, linkLabel?: string): TreeDatum => ({ key, nodeId, kind: 'node', linkLabel, children: [], descendants: 0 });
  const root = make(graph.startId, graph.startId);
  const stack: TreeDatum[] = [root];
  while (stack.length) {
    const datum = stack.pop()!;
    const links = graph.out.get(datum.nodeId) || [];
    for (const link of links) {
      if (placed.has(link.target)) {
        datum.children.push({
          key: `${datum.key}>${link.target}`,
          nodeId: link.target,
          kind: graph.backEdges.has(link) ? 'loop' : 'join',
          linkLabel: link.label,
          children: [],
          descendants: 0,
        });
      } else {
        placed.add(link.target);
        const child = make(link.target, link.target, link.label);
        datum.children.push(child);
        stack.push(child);
      }
    }
  }
  const count = (d: TreeDatum): number => (d.descendants = d.children.reduce((n, c) => n + 1 + count(c), 0));
  count(root);
  return root;
}

const linkPath = linkHorizontal<{ source: [number, number]; target: [number, number] }, [number, number]>()
  .source((d) => d.source)
  .target((d) => d.target);

export default function BranchMap({ graph, onFocusNode }: { graph: StoryGraph; onFocusNode: FocusNode }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const contentRef = useRef<SVGGElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const { fit, zoomBy } = useZoomPan(svgRef, contentRef);
  // Start (tree root) sits at (0, 0) in layout coords; anchor there when the map is too big to fit readably.
  const fitReadable = useCallback(() => fit({ minScale: 0.8, anchor: [-BOX_W / 2, 0] }), [fit]);
  const { tooltip, show, hide } = useTooltip(frameRef);
  const data = useMemo(() => buildTree(graph), [graph]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const folded = new Set<string>();
    if (!data || data.descendants < AUTO_COLLAPSE_SIZE) return folded;
    const walk = (d: TreeDatum, depth: number) => {
      if (depth >= AUTO_COLLAPSE_DEPTH && d.children.length) folded.add(d.key);
      else d.children.forEach((c) => walk(c, depth + 1));
    };
    walk(data, 0);
    return folded;
  });
  const layout = useMemo(() => {
    if (!data) return null;
    const root = hierarchy(data, (d) => (collapsed.has(d.key) ? null : d.children));
    return tree<TreeDatum>().nodeSize([ROW, COL])(root);
  }, [data, collapsed]);

  // Fit once the first layout is on screen; later collapse/expand keeps the viewport.
  const fitted = useRef(false);
  useEffect(() => {
    if (!layout || fitted.current) return;
    fitted.current = true;
    requestAnimationFrame(() => fitReadable());
  }, [layout, fitReadable]);

  const deadEndsByNode = useMemo(() => {
    const map = new Map<string, string[]>();
    graph.deadEnds.forEach((d) => map.set(d.nodeId, [...(map.get(d.nodeId) || []), d.what]));
    return map;
  }, [graph]);
  const endingSet = useMemo(() => new Set(graph.endings), [graph]);

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const summary = graph.startId
    ? `${graph.reachable.size} reachable · ${graph.endings.length} ${graph.endings.length === 1 ? 'ending' : 'endings'} · ${graph.deadEnds.length} dead ${graph.deadEnds.length === 1 ? 'end' : 'ends'} · ${graph.backEdges.size} ${graph.backEdges.size === 1 ? 'loop' : 'loops'}`
    : undefined;

  const legend = (
    <>
      {graph.branchRoots.slice(0, 8).map((root, i) => (
        <LegendItem key={root.target} swatch={<><circle cx="7" cy="7" r="6" fill={branchColor(i)} /><text x="7" y="10.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="oklch(var(--nt-bg))">{branchMark(i)}</text></>}>
          {truncate(root.label, 18)}
        </LegendItem>
      ))}
      <LegendItem swatch={<rect x="2" y="3" width="10" height="8" rx="4" fill="none" stroke="oklch(var(--nt-ink-3))" strokeDasharray="2 2" />}>joins / loops back</LegendItem>
      <LegendItem swatch={<rect x="1" y="3" width="12" height="8" rx="2" fill="none" stroke="oklch(var(--nt-danger))" strokeDasharray="3 2" />}>dead end</LegendItem>
      {collapsed.size > 0 && (
        <button type="button" onClick={() => setCollapsed(new Set())} className="rounded-md border border-nt-line px-2 py-1 text-nt-ink-2 hover:bg-nt-raised hover:text-nt-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-nt-focus">
          Expand all ({collapsed.size} folded)
        </button>
      )}
    </>
  );

  const aside = (
    <div className="space-y-5">
      {graph.deadEnds.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold text-nt-ink">Dead ends</h3>
          <ul className="space-y-1">
            {graph.deadEnds.map((d) => (
              <li key={`${d.nodeId}:${d.what}`}>
                <button type="button" onClick={() => onFocusNode(d.nodeId)} className="w-full rounded px-2 py-1 text-left text-nt-ink-2 hover:bg-nt-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-nt-focus">
                  {graph.nodes.get(d.nodeId)?.label} <span className="text-nt-ink-3">· {d.what === 'jump' ? 'jump has no target' : `“${d.what}” goes nowhere`}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h3 className="mb-2 font-semibold text-nt-ink">Not reachable from Start ({graph.unreachable.length})</h3>
        {graph.unreachable.length === 0 ? (
          <p className="text-nt-ink-3">Every scene can be reached.</p>
        ) : (
          <ul className="space-y-1">
            {graph.unreachable.map((id) => {
              const node = graph.nodes.get(id)!;
              return (
                <li key={id}>
                  <button type="button" onClick={() => onFocusNode(id)} className="w-full rounded px-2 py-1 text-left text-nt-ink-2 hover:bg-nt-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-nt-focus">
                    {node.label} <span className="text-nt-ink-3">· {node.boardName}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  if (!layout) {
    return (
      <ViewFrame title="Branches">
        <EmptyView title="No Start node yet">
          Name a scene “Start” and the branch map will draw every path from it: where choices split, where they rejoin, and where they end.
        </EmptyView>
      </ViewFrame>
    );
  }

  const nodes = layout.descendants() as HierarchyPointNode<TreeDatum>[];

  return (
    <ViewFrame title="Branches" summary={summary} legend={legend} onFit={fitReadable} onZoom={zoomBy} aside={aside} frameRef={frameRef}>
      <svg ref={svgRef} className="h-full w-full cursor-grab active:cursor-grabbing" role="group" aria-label="Branch map">
        <g ref={contentRef}>
          {layout.links().map((link) => {
            const t = link.target.data;
            const start: [number, number] = [link.source.y + BOX_W / 2, link.source.x];
            const end: [number, number] = [link.target.y - BOX_W / 2, link.target.x];
            const stub = t.kind !== 'node';
            return (
              <g key={`${link.source.data.key}->${t.key}`}>
                <path d={linkPath({ source: start, target: end }) ?? undefined} fill="none" stroke={stub ? 'oklch(var(--nt-line-strong))' : branchColor(graph.branchOf.get(t.nodeId))} strokeOpacity={stub ? 1 : 0.7} strokeWidth={1.5} strokeDasharray={stub ? '4 4' : undefined} />

              </g>
            );
          })}
          {nodes.map((n) => {
            const d = n.data;
            const node = graph.nodes.get(d.nodeId)!;
            const x = n.y - BOX_W / 2;
            const y = n.x - BOX_H / 2;
            if (d.kind !== 'node') {
              const text = `${d.kind === 'loop' ? '⟲ loops to' : '↩ joins'} ${node.label}`;
              return (
                <g key={d.key} transform={`translate(${x},${y + 4})`} {...itemProps(`${text}. Open on canvas`, () => onFocusNode(d.nodeId))}
                  onMouseMove={(e) => show(e, <NodeTooltip node={node} extra={d.kind === 'loop' ? 'This choice returns to an earlier scene.' : 'This path merges into a scene reached earlier.'} />)}
                  onMouseLeave={hide}>
                  <rect className="nt-focus-ring" x={-3} y={-3} width={BOX_W + 6} height={BOX_H - 2} rx={16} fill="none" stroke="oklch(var(--nt-focus))" strokeWidth={2} />
                  <rect width={BOX_W} height={BOX_H - 8} rx={13} fill="oklch(var(--nt-bg))" stroke="oklch(var(--nt-line-strong))" strokeDasharray="4 3" />
                  <text x={12} y={17} fontSize="11.5" fill="oklch(var(--nt-ink-2))">{truncate(text, 28)}</text>
                  {d.linkLabel && <text x={2} y={-5} fontSize="10.5" fill="oklch(var(--nt-ink-3))">{truncate(d.linkLabel, 34)}</text>}
                </g>
              );
            }
            const tag = graph.branchOf.get(d.nodeId);
            const dead = deadEndsByNode.get(d.nodeId);
            // Condition branch that leads here, as a caption above the box (the link gap is too short for it).
            const caption = d.linkLabel && <text x={2} y={-5} fontSize="10.5" fill="oklch(var(--nt-ink-3))">{truncate(d.linkLabel, 34)}</text>;
            const isEnding = endingSet.has(d.nodeId);
            const isStart = d.nodeId === graph.startId;
            const hasChildren = d.children.length > 0;
            const isCollapsed = collapsed.has(d.key);
            const color = branchColor(tag);
            return (
              <g key={d.key} transform={`translate(${x},${y})`}>
                {caption}
                <g {...itemProps(`${node.label}, ${branchName(tag, graph.branchRoots)}${isEnding ? ', ending' : ''}${dead ? ', dead end' : ''}. Open on canvas`, () => onFocusNode(d.nodeId))}
                  onMouseMove={(e) => show(e, <NodeTooltip node={node} extra={<span>{branchName(tag, graph.branchRoots)}{isEnding ? ' · Ending' : ''}{dead ? ` · Dead end (${dead.join(', ')})` : ''}</span>} />)}
                  onMouseLeave={hide}>
                  <rect className="nt-focus-ring" x={-3} y={-3} width={BOX_W + 6} height={BOX_H + 6} rx={9} fill="none" stroke="oklch(var(--nt-focus))" strokeWidth={2} />
                  <rect width={BOX_W} height={BOX_H} rx={7} fill="oklch(var(--nt-surface))"
                    stroke={dead ? 'oklch(var(--nt-danger))' : isStart ? 'oklch(var(--nt-accent))' : 'oklch(var(--nt-line))'}
                    strokeWidth={dead || isStart ? 1.5 : 1} strokeDasharray={dead ? '4 3' : undefined} />
                  {node.type === 'conditionNode' ? (
                    <path d="M17 7 L27 17 L17 27 L7 17 Z" fill={color} />
                  ) : node.type === 'jumpNode' ? (
                    <path d="M8 9 L26 17 L8 25 Z" fill={color} />
                  ) : (
                    <circle cx={17} cy={17} r={9.5} fill={color} />
                  )}
                  <text x={17} y={20.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="oklch(var(--nt-bg))">{branchMark(tag)}</text>
                  <text x={34} y={21} fontSize="12.5" fontWeight={isStart ? 600 : 500} fill="oklch(var(--nt-ink))">{truncate(node.label, isEnding ? 15 : 21)}</text>
                  {isEnding && (
                    <g transform={`translate(${BOX_W - 42},9)`}>
                      <rect width={34} height={16} rx={8} fill="oklch(var(--nt-raised))" stroke="oklch(var(--nt-line-strong))" />
                      <text x={17} y={11.5} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="oklch(var(--nt-ink-2))">END</text>
                    </g>
                  )}
                </g>
                {hasChildren && (
                  <g transform={`translate(${BOX_W + 10},${BOX_H / 2})`} {...itemProps(`${isCollapsed ? 'Expand' : 'Collapse'} ${d.descendants} scenes after ${node.label}`, () => toggle(d.key))}>
                    <rect className="nt-focus-ring" x={-12} y={-12} width={24} height={24} rx={12} fill="none" stroke="oklch(var(--nt-focus))" strokeWidth={2} />
                    <circle r={9} fill="oklch(var(--nt-raised))" stroke="oklch(var(--nt-line-strong))" />
                    <text y={4} textAnchor="middle" fontSize="12" fill="oklch(var(--nt-ink-2))">{isCollapsed ? '+' : '−'}</text>
                    {isCollapsed && <text x={14} y={4} fontSize="11" fill="oklch(var(--nt-ink-3))">{d.descendants} hidden</text>}
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <Tooltip tooltip={tooltip} />
    </ViewFrame>
  );
}
