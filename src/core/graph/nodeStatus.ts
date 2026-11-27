import type { StoryGraph } from './storyGraph';

export type NodeStatus = 'start' | 'ending' | 'dead-end' | 'unreachable';

/**
 * One status per flow node for its canvas badge. When several apply the most
 * useful wins: start, then dead end, then unreachable, then ending.
 */
export function nodeStatuses(graph: Pick<StoryGraph, 'startId' | 'endings' | 'deadEnds' | 'unreachable'>): Map<string, NodeStatus> {
  const statuses = new Map<string, NodeStatus>();
  for (const id of graph.endings) statuses.set(id, 'ending');
  // Without a Start scene every node is "unreachable"; that says nothing useful.
  if (graph.startId) for (const id of graph.unreachable) statuses.set(id, 'unreachable');
  for (const { nodeId } of graph.deadEnds) statuses.set(nodeId, 'dead-end');
  if (graph.startId) statuses.set(graph.startId, 'start');
  return statuses;
}
