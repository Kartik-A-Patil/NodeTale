import { useMemo, useRef } from 'react';
import { Edge, Node } from 'reactflow';
import { Project } from '../models/story';
import { computeResolvedEdgeLabels, EdgeLabelCache } from '../core/sim/resolvedEdgeLabels';

// Labels depend on what nodes say (data, type), never where they sit. A drag
// hands us new node objects every frame with the same `data`, so check that
// first and skip the work: on a 2,000-node board it was longer than a frame.
const sameContent = (a: Node[], b: Node[]) =>
  a.length === b.length && a.every((n, i) => n.id === b[i].id && n.type === b[i].type && n.data === b[i].data);

/** See computeResolvedEdgeLabels — this holds its cache across renders. */
export function useResolvedEdgeLabels(nodes: Node[], edges: Edge[], project: Project): Edge[] {
  const cache = useRef<EdgeLabelCache>(new Map());
  const last = useRef<{ nodes: Node[]; edges: Edge[]; project: Project; result: Edge[] } | null>(null);
  return useMemo(() => {
    const prev = last.current;
    if (prev && prev.edges === edges && prev.project === project && sameContent(prev.nodes, nodes)) {
      prev.nodes = nodes;
      return prev.result;
    }
    const result = computeResolvedEdgeLabels(nodes, edges, project, cache.current);
    last.current = { nodes, edges, project, result };
    return result;
  }, [nodes, edges, project]);
}
