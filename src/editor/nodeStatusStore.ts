import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Edge } from 'reactflow';
import type { CanvasNode } from '../adapters/reactFlow';
import type { Project } from '../models/story';
import { buildStoryGraph } from '../core/graph/storyGraph';
import { NodeStatus, nodeStatuses } from '../core/graph/nodeStatus';
import { useEditor } from './EditorContext';

// Statuses live outside React state so a node re-renders only when its own
// status changes, not whenever any node's does.
function createNodeStatusStore() {
  let statuses = new Map<string, NodeStatus>();
  const listeners = new Set<() => void>();
  return {
    get: (id: string) => statuses.get(id),
    set: (next: Map<string, NodeStatus>) => {
      statuses = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

export type NodeStatusStore = ReturnType<typeof createNodeStatusStore>;

// What the story graph depends on. Positions change every drag frame; this doesn't.
const graphShape = (nodes: CanvasNode[], edges: Edge[]) =>
  nodes.map((n) => {
    const data = n.data as { label?: string; jumpTargetId?: string; branches?: { id: string }[] };
    return `${n.id}|${n.type}|${data.label}|${data.jumpTargetId ?? ''}|${data.branches?.map((b) => b.id).join(',') ?? ''}`;
  }).join('\n') + '\n' + edges.map((e) => `${e.source}>${e.target}:${e.sourceHandle ?? ''}`).join('\n');

/** Owns the store and keeps it in step with the live canvas. */
export function useNodeStatusStore(nodes: CanvasNode[], edges: Edge[], getLiveProject: () => Project, boards: Project['boards']) {
  const [store] = useState(createNodeStatusStore);
  const shape = useMemo(() => graphShape(nodes, edges), [nodes, edges]);
  useEffect(() => {
    store.set(nodeStatuses(buildStoryGraph(getLiveProject())));
  }, [store, shape, boards, getLiveProject]);
  return store;
}

export function useNodeStatus(id: string): NodeStatus | undefined {
  const { nodeStatus } = useEditor();
  return useSyncExternalStore(nodeStatus.subscribe, () => nodeStatus.get(id));
}
