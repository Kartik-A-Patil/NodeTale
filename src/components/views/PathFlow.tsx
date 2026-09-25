import { useEffect, useMemo, useRef } from 'react';
import { sankey, sankeyLeft, sankeyLinkHorizontal, SankeyLink, SankeyNode } from 'd3-sankey';
import { PATH_CAP, StoryGraph } from '../../core/graph/storyGraph';
import {
  EmptyView, FocusNode, itemProps, LegendItem, NodeTooltip, Tooltip, ViewFrame,
  branchColor, truncate, useTooltip, useZoomPan,
} from './shared';

interface FlowNode {
  id: string;
  kind: 'start' | 'fork' | 'merge' | 'ending' | 'stop';
}
interface FlowLink {
  source: string;
  target: string;
  /** Routes from Start to an ending that use this step. */
  routes: number;
  label?: string;
  /** Scenes collapsed into this step (a straight run with no choices). */
  via: string[];
}

type LaidNode = SankeyNode<FlowNode, FlowLink>;
type LaidLink = SankeyLink<FlowNode, FlowLink>;

const COLUMN_W = 230;
const NODE_W = 10;
const fmt = (n: number) => (n >= PATH_CAP ? `${PATH_CAP / 1000}k+` : n.toLocaleString());

// Collapse the (loop-free) story graph to the points where something happens:
// Start, forks, merges, endings and stops. Straight runs between them become
// one step whose width is the number of distinct routes using it.
function condense(graph: StoryGraph) {
  if (!graph.startId) return null;
  const forward = (id: string) => (graph.out.get(id) || []).filter((l) => !graph.backEdges.has(l));
  const inDegree = new Map<string, number>();
  for (const id of graph.reachable) for (const l of forward(id)) inDegree.set(l.target, (inDegree.get(l.target) ?? 0) + 1);
  const deadEndNodes = new Set(graph.deadEnds.map((d) => d.nodeId));
  const endingSet = new Set(graph.endings);
  const kindOf = (id: string): FlowNode['kind'] | null => {
    if (id === graph.startId) return 'start';
    if (endingSet.has(id)) return 'ending';
    const outs = forward(id).length;
    if (outs === 0) return 'stop';
    if (outs > 1 || deadEndNodes.has(id)) return 'fork';
    if ((inDegree.get(id) ?? 0) > 1) return 'merge';
    return null;
  };

  const nodes: FlowNode[] = [];
  const links: FlowLink[] = [];
  for (const id of graph.order) {
    const kind = kindOf(id);
    if (!kind) continue;
    nodes.push({ id, kind });
    for (const first of forward(id)) {
      const via: string[] = [];
      let cur = first.target;
      while (!kindOf(cur)) {
        via.push(cur);
        cur = forward(cur)[0].target;
      }
      const routes = Math.min(PATH_CAP, (graph.pathsFromStart.get(id) ?? 0) * (graph.pathsToEnd.get(cur) ?? 0));
      links.push({ source: id, target: cur, routes, label: first.label, via });
    }
  }
  return { nodes, links };
}

export default function PathFlow({ graph, onFocusNode }: { graph: StoryGraph; onFocusNode: FocusNode }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const contentRef = useRef<SVGGElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const { fit, zoomBy } = useZoomPan(svgRef, contentRef);
  const { tooltip, show, hide } = useTooltip(frameRef);

  const condensed = useMemo(() => condense(graph), [graph]);
  const total = graph.startId ? graph.pathsToEnd.get(graph.startId) ?? 0 : 0;

  const layout = useMemo(() => {
    if (!condensed || condensed.links.length === 0) return null;
    // Depth via longest path so columns read left to right in story order.
    const depth = new Map<string, number>();
    for (const n of condensed.nodes) if (!depth.has(n.id)) depth.set(n.id, 0);
    for (const n of condensed.nodes) {
      for (const l of condensed.links.filter((x) => x.source === n.id)) {
        depth.set(l.target, Math.max(depth.get(l.target) ?? 0, (depth.get(n.id) ?? 0) + 1));
      }
    }
    const columns = Math.max(...depth.values()) + 1;
    const height = Math.max(240, condensed.nodes.length * 34);
    // Routes vary by orders of magnitude; a floor keeps rare routes (and routes
    // that never reach an ending) visible. Widths are relative, labels are exact.
    const floor = Math.max(1, total / 60);
    return sankey<FlowNode, FlowLink>()
      .nodeId((d) => d.id)
      .nodeAlign(sankeyLeft)
      .nodeWidth(NODE_W)
      .nodePadding(22)
      .extent([[0, 0], [columns * COLUMN_W, height]])({
        nodes: condensed.nodes.map((n) => ({ ...n })),
        links: condensed.links.map((l) => ({ ...l, value: Math.max(l.routes, floor) })),
      });
  }, [condensed, total]);

  const fitted = useRef(false);
  useEffect(() => {
    if (!layout || fitted.current) return;
    fitted.current = true;
    const start = layout.nodes.find((n) => n.kind === 'start');
    requestAnimationFrame(() => fit({ minScale: 0.75, anchor: [start?.x0 ?? 0, ((start?.y0 ?? 0) + (start?.y1 ?? 0)) / 2] }));
  }, [layout, fit]);

  const bottleneck = (id: string) => {
    const from = graph.pathsFromStart.get(id) ?? 0;
    const to = graph.pathsToEnd.get(id) ?? 0;
    return total > 0 && total < PATH_CAP && from * to === total;
  };

  const loops = [...graph.backEdges];
  const summary = graph.startId
    ? `${fmt(total)} distinct ${total === 1 ? 'route' : 'routes'} to ${graph.endings.length} ${graph.endings.length === 1 ? 'ending' : 'endings'}${loops.length ? ` · ${loops.length} ${loops.length === 1 ? 'loop' : 'loops'} not counted` : ''}`
    : undefined;

  const legend = (
    <>
      <LegendItem swatch={<rect x="1" y="4" width="12" height="6" rx="1" fill="oklch(var(--nt-branch-0) / 0.5)" />}>width = routes through this step</LegendItem>
      <LegendItem swatch={<rect x="1" y="4" width="12" height="6" rx="1" fill="none" stroke="oklch(var(--nt-ink-3))" strokeDasharray="2 2" />}>never reaches an ending</LegendItem>
      <LegendItem swatch={<path d="M7 1 L13 7 L7 13 L1 7 Z" fill="oklch(var(--nt-accent))" />}>every route passes here</LegendItem>
    </>
  );

  const aside = (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 font-semibold text-nt-ink">Endings</h3>
        <ul className="space-y-1">
          {graph.endings.map((id) => (
            <li key={id}>
              <button type="button" onClick={() => onFocusNode(id)} className="flex w-full justify-between gap-2 rounded px-2 py-1 text-left text-nt-ink-2 hover:bg-nt-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-nt-focus">
                <span className="truncate">{graph.nodes.get(id)?.label}</span>
                <span className="shrink-0 font-mono text-nt-ink-3">{fmt(graph.pathsFromStart.get(id) ?? 0)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {loops.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold text-nt-ink">Loops</h3>
          <ul className="space-y-1">
            {loops.map((l) => (
              <li key={`${l.source}->${l.target}`}>
                <button type="button" onClick={() => onFocusNode(l.source)} className="w-full rounded px-2 py-1 text-left text-nt-ink-2 hover:bg-nt-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-nt-focus">
                  {graph.nodes.get(l.source)?.label} <span className="text-nt-ink-3">⟲ back to</span> {graph.nodes.get(l.target)?.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  if (!layout) {
    return (
      <ViewFrame title="Paths">
        <EmptyView title={graph.startId ? 'No choices to follow yet' : 'No Start node yet'}>
          {graph.startId
            ? 'Connect scenes from Start onward. This view shows how choices funnel into your endings and how many distinct routes reach each one.'
            : 'Name a scene “Start”. This view then shows how choices funnel into your endings and how many distinct routes reach each one.'}
        </EmptyView>
      </ViewFrame>
    );
  }

  const linkPath = sankeyLinkHorizontal<FlowNode, FlowLink>();

  return (
    <ViewFrame title="Paths" summary={summary} legend={legend} onFit={() => fit()} onZoom={zoomBy} aside={aside} frameRef={frameRef}>
      <svg ref={svgRef} className="h-full w-full cursor-grab active:cursor-grabbing" role="group" aria-label="Route flow from Start to endings">
        <g ref={contentRef}>
          {(layout.links as LaidLink[]).map((link, i) => {
            const target = link.target as LaidNode;
            const noEnding = link.routes === 0;
            const tag = graph.branchOf.get(target.id);
            const label = `${link.label ? `${link.label} → ` : ''}${graph.nodes.get(target.id)?.label}: ${noEnding ? 'never reaches an ending' : `${fmt(link.routes)} ${link.routes === 1 ? 'route' : 'routes'}`}`;
            return (
              <path key={i} d={linkPath(link) ?? undefined} fill="none"
                stroke={noEnding ? 'oklch(var(--nt-ink-3) / 0.6)' : branchColor(tag)}
                strokeOpacity={noEnding ? 1 : 0.32} strokeWidth={Math.max(1.5, link.width ?? 1)}
                strokeDasharray={noEnding ? '5 4' : undefined}
                className="transition-[stroke-opacity] duration-150 hover:stroke-opacity-70"
                onMouseMove={(e) => show(e, <>
                  <div className="font-medium text-nt-ink">{label}</div>
                  {link.via.length > 0 && <div className="mt-1">via {truncate(link.via.map((id) => graph.nodes.get(id)?.label).join(' → '), 120)}</div>}
                </>)}
                onMouseLeave={hide}>
                <title>{label}</title>
              </path>
            );
          })}
          {(layout.nodes as LaidNode[]).map((n) => {
            const node = graph.nodes.get(n.id)!;
            const x0 = n.x0 ?? 0, x1 = n.x1 ?? 0, y0 = n.y0 ?? 0, y1 = n.y1 ?? 0;
            const isEnd = n.kind === 'ending' || n.kind === 'stop';
            const routes = n.kind === 'ending' ? graph.pathsFromStart.get(n.id) ?? 0 : null;
            const through = n.kind !== 'start' && !isEnd && bottleneck(n.id);
            const kindText = n.kind === 'ending' ? `Ending · ${fmt(routes ?? 0)} ${routes === 1 ? 'route' : 'routes'}` : n.kind === 'stop' ? 'Stops (loop or dead end)' : n.kind === 'fork' ? 'Choice' : n.kind === 'merge' ? 'Paths merge' : 'Start';
            return (
              <g key={n.id} {...itemProps(`${node.label}, ${kindText}${through ? ', every route passes here' : ''}. Open on canvas`, () => onFocusNode(n.id))}
                onMouseMove={(e) => show(e, <NodeTooltip node={node} extra={<>{kindText}{through ? ' · every route passes here' : ''}</>} />)}
                onMouseLeave={hide}>
                <rect className="nt-focus-ring" x={x0 - 4} y={y0 - 4} width={x1 - x0 + 8} height={Math.max(8, y1 - y0) + 8} rx={4} fill="none" stroke="oklch(var(--nt-focus))" strokeWidth={2} />
                <rect x={x0} y={y0} width={x1 - x0} height={Math.max(4, y1 - y0)} rx={2}
                  fill={n.kind === 'start' ? 'oklch(var(--nt-accent))' : isEnd ? 'oklch(var(--nt-ink))' : 'oklch(var(--nt-ink-3))'} />
                <text x={isEnd ? x0 - 8 : x1 + 8} y={(y0 + y1) / 2 - (isEnd ? 2 : 0)} textAnchor={isEnd ? 'end' : 'start'} dominantBaseline="middle" fontSize="12" fontWeight={isEnd || n.kind === 'start' ? 600 : 500} fill="oklch(var(--nt-ink))">
                  {truncate(node.label, 26)}
                </text>
                {isEnd && (
                  <text x={x0 - 8} y={(y0 + y1) / 2 + 13} textAnchor="end" dominantBaseline="middle" fontSize="10.5" className="font-mono" fill="oklch(var(--nt-ink-3))">
                    {n.kind === 'ending' ? `${fmt(routes ?? 0)} ${routes === 1 ? 'route' : 'routes'}` : 'stops'}
                  </text>
                )}
                {through && <path transform={`translate(${x1 + 8 + Math.min(26, node.label.length) * 7 + 8},${(y0 + y1) / 2})`} d="M0 -6 L6 0 L0 6 L-6 0 Z" fill="oklch(var(--nt-accent))" />}
              </g>
            );
          })}
        </g>
      </svg>
      <Tooltip tooltip={tooltip} />
    </ViewFrame>
  );
}
