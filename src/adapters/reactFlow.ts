import { Edge, Node } from 'reactflow';
import { NodeData, StoryEdge, StoryNode } from '../models/story';

export type CanvasNode = Node<NodeData>;

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
  ...(node.hidden ? { hidden: true } : {}),
  ...(node.draggable !== undefined ? { draggable: node.draggable } : {}),
  ...(node.selectable !== undefined ? { selectable: node.selectable } : {}),
  ...(node.connectable !== undefined ? { connectable: node.connectable } : {}),
  ...(node.deletable !== undefined ? { deletable: node.deletable } : {}),
  ...(node.focusable !== undefined ? { focusable: node.focusable } : {}),
  ...(node.dragHandle ? { dragHandle: node.dragHandle } : {}),
  ...(node.expandParent !== undefined ? { expandParent: node.expandParent } : {}),
  ...(node.className ? { className: node.className } : {}),
} as StoryNode);

export const toCanvasEdge = (edge: StoryEdge): Edge => ({ ...edge } as Edge);

export const toStoryEdge = (edge: Edge): StoryEdge => ({
  id: edge.id,
  source: edge.source,
  target: edge.target,
  ...(edge.sourceHandle !== undefined ? { sourceHandle: edge.sourceHandle } : {}),
  ...(edge.targetHandle !== undefined ? { targetHandle: edge.targetHandle } : {}),
  ...(edge.type ? { type: edge.type } : {}),
  ...(typeof edge.label === 'string' ? { label: edge.label } : {}),
  ...(edge.animated ? { animated: true } : {}),
  ...(edge.markerStart ? { markerStart: edge.markerStart as StoryEdge['markerStart'] } : {}),
  ...(edge.markerEnd ? { markerEnd: edge.markerEnd as StoryEdge['markerEnd'] } : {}),
  ...(edge.style ? { style: edge.style as StoryEdge['style'] } : {}),
  ...(edge.data ? { data: edge.data } : {}),
  ...(edge.hidden ? { hidden: true } : {}),
  ...(edge.deletable !== undefined ? { deletable: edge.deletable } : {}),
  ...(edge.focusable !== undefined ? { focusable: edge.focusable } : {}),
  ...(edge.reconnectable !== undefined ? { reconnectable: edge.reconnectable } : {}),
  ...(edge.interactionWidth !== undefined ? { interactionWidth: edge.interactionWidth } : {}),
  ...(edge.labelStyle ? { labelStyle: edge.labelStyle as StoryEdge['labelStyle'] } : {}),
  ...(edge.labelBgStyle ? { labelBgStyle: edge.labelBgStyle as StoryEdge['labelBgStyle'] } : {}),
  ...(edge.labelBgPadding ? { labelBgPadding: edge.labelBgPadding as [number, number] } : {}),
  ...(edge.labelBgBorderRadius !== undefined ? { labelBgBorderRadius: edge.labelBgBorderRadius } : {}),
  ...(edge.className ? { className: edge.className } : {}),
});
