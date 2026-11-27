import { useMemo, useRef } from 'react';
import { Edge, Node } from 'reactflow';
import { Project } from '../models/story';
import { computeResolvedEdgeLabels, EdgeLabelCache } from '../core/sim/resolvedEdgeLabels';

/** See computeResolvedEdgeLabels — this just holds its cache across renders. */
export function useResolvedEdgeLabels(nodes: Node[], edges: Edge[], project: Project): Edge[] {
  const cache = useRef<EdgeLabelCache>(new Map());
  return useMemo(() => computeResolvedEdgeLabels(nodes, edges, project, cache.current), [nodes, edges, project]);
}
