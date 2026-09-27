import { Edge, Node } from 'reactflow';
import { Project, AppNode } from '../../types';
import { createSimulator, resolveVisibleNode } from './simulate';

const LOGIC_NODE_TYPES = new Set(['conditionNode', 'jumpNode']);

interface CacheEntry {
  /** The exact edge object this was computed from, so an unrelated edit to
   *  this same edge (color, manual label, ...) is still picked up. */
  sourceEdge: Edge;
  label: string;
  wrapped: Edge;
}

/** Reused across calls (one instance held in a ref) so unaffected edges keep
 *  their exact object reference — see computeResolvedEdgeLabels. */
export type EdgeLabelCache = Map<string, CacheEntry>;

const buildFullProject = (project: Project, nodes: Node[], edges: Edge[]): Project => ({
  ...project,
  boards: project.boards.map((b) => (b.id === project.activeBoardId ? { ...b, nodes: nodes as AppNode[], edges } : b)),
});

/**
 * Wraps edges whose target is a logic node (condition/jump — invisible to
 * the player) with the title of the scene the player actually ends up at,
 * in `data.autoResolvedLabel`. A branch edge (source is itself a condition
 * node) is left untouched: it already shows its own branch text elsewhere,
 * regardless of what's downstream.
 *
 * `nodes`/`edges` are the active board's live canvas state, which is what a
 * choice's own edges live in; the full `project` is only needed because a
 * jump can target another board. Resolution is only actually attempted for
 * the edges that need it — a board with none pays just the one O(edges)
 * scan below.
 *
 * Reference-stable: an edge that doesn't need resolving, or whose resolved
 * label hasn't changed since the last call with this same `cache`, comes
 * back as the exact same object. A node-position drag changes `nodes` every
 * frame but not what anything resolves to, so this keeps those frames from
 * touching edge object identity — which is what lets FloatingEdge's memo
 * skip re-rendering edges that aren't actually different.
 *
 * ponytail: `cache` is never pruned of edges that no longer exist, so it
 * grows with every edge ever created in the session. Fine at realistic board
 * sizes (a few thousand entries at most); revisit if that ever matters.
 */
export function computeResolvedEdgeLabels(nodes: Node[], edges: Edge[], project: Project, cache: EdgeLabelCache): Edge[] {
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const resolvedTitleByNodeId = new Map<string, string>();
  let sim: ReturnType<typeof createSimulator> | null = null;

  return edges.map((edge) => {
    const target = nodesById.get(edge.target);
    const source = nodesById.get(edge.source);
    if (!target || !LOGIC_NODE_TYPES.has(target.type ?? '') || source?.type === 'conditionNode') {
      return edge;
    }

    let label = resolvedTitleByNodeId.get(edge.target);
    if (label === undefined) {
      sim ??= createSimulator(buildFullProject(project, nodes, edges));
      label = (resolveVisibleNode(sim, edge.target)?.data as { label?: string } | undefined)?.label || 'Untitled';
      resolvedTitleByNodeId.set(edge.target, label);
    }

    const cached = cache.get(edge.id);
    if (cached && cached.sourceEdge === edge && cached.label === label) return cached.wrapped;

    const wrapped: Edge = { ...edge, data: { ...edge.data, autoResolvedLabel: label } };
    cache.set(edge.id, { sourceEdge: edge, label, wrapped });
    return wrapped;
  });
}
