import { useMemo, useRef } from 'react';
import { Edge, Node } from 'reactflow';
import { Project } from '../models/story';
import { computeResolvedEdgeLabels, EdgeLabelCache } from '../core/sim/resolvedEdgeLabels';
import { sameNodeContent } from '../adapters/reactFlow';

// Labels depend on what nodes say, never where they sit (see sameNodeContent):
// on a 2,000-node board recomputing per drag frame was longer than a frame.

/** See computeResolvedEdgeLabels — this holds its cache across renders. */
export function useResolvedEdgeLabels(nodes: Node[], edges: Edge[], project: Project): Edge[] {
  const cache = useRef<EdgeLabelCache>(new Map());
  const last = useRef<{ nodes: Node[]; edges: Edge[]; project: Project; result: Edge[] } | null>(null);
  return useMemo(() => {
    const prev = last.current;
    if (prev && prev.edges === edges && prev.project === project && sameNodeContent(prev.nodes, nodes)) {
      prev.nodes = nodes;
      return prev.result;
    }
    const result = computeResolvedEdgeLabels(nodes, edges, project, cache.current);
    last.current = { nodes, edges, project, result };
    return result;
  }, [nodes, edges, project]);
}
