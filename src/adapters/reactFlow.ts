import { Edge, MarkerType, Node } from 'reactflow';
import { NodeData, StoryEdge, StoryNode, DEFAULT_EDGE_STROKE } from '../models/story';

export type CanvasNode = Node<NodeData>;

/** What every connection looks like on the canvas unless the author changed it.
 *  Not stored per edge: filled in here on load, and by new connections. */
export const EDGE_DEFAULTS = {
  type: 'floating',
  animated: false,
  markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 },
  style: { stroke: DEFAULT_EDGE_STROKE },
} satisfies Partial<Edge>;

export const toCanvasNode = (node: StoryNode): CanvasNode => ({
  ...node,
  type: node.type,
  position: { ...node.position },
  data: { ...node.data },
  selected: false,
} as CanvasNode);

export const toStoryNode = (node: CanvasNode): StoryNode => ({
  id: node.id,
  type: node.type as StoryNode['type'],
  position: { ...node.position },
  data: { ...node.data },
  ...(node.parentNode ? { parentNode: node.parentNode } : {}),
  ...(node.extent ? { extent: node.extent } : {}),
  ...(typeof node.width === 'number' ? { width: node.width } : {}),
  ...(typeof node.height === 'number' ? { height: node.height } : {}),
  ...(typeof node.zIndex === 'number' ? { zIndex: node.zIndex } : {}),
  ...(node.style ? { style: node.style as StoryNode['style'] } : {}),
} as StoryNode);

export const toCanvasEdge = (edge: StoryEdge): Edge => ({
  ...EDGE_DEFAULTS,
  ...edge,
  type: edge.type || EDGE_DEFAULTS.type,
  // Saves from before this always had the arrow and an `animated` flag.
  animated: false,
  markerEnd: EDGE_DEFAULTS.markerEnd,
  style: edge.style ?? EDGE_DEFAULTS.style,
} as Edge);

export const toStoryEdge = (edge: Edge): StoryEdge => ({
  id: edge.id,
  source: edge.source,
  target: edge.target,
  ...(edge.sourceHandle != null ? { sourceHandle: edge.sourceHandle } : {}),
  ...(edge.targetHandle != null ? { targetHandle: edge.targetHandle } : {}),
  ...(edge.type ? { type: edge.type } : {}),
  ...(typeof edge.label === 'string' ? { label: edge.label } : {}),
  ...(edge.style ? { style: edge.style as StoryEdge['style'] } : {}),
  ...(edge.data ? { data: edge.data } : {}),
});

/** Same nodes saying the same things, wherever they sit. A drag or pan hands
 *  over new node objects every frame but keeps each node's `data`, so work that
 *  depends only on content can skip those frames. */
export const sameNodeContent = (a: Node[], b: Node[]) =>
  a === b || (a.length === b.length && a.every((n, i) => n.id === b[i].id && n.type === b[i].type && n.data === b[i].data));
