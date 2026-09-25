import { NodeProps } from 'reactflow';

// ReactFlow passes node components xPos/yPos/dragging/zIndex too, which change
// every drag frame. None of our nodes render from them, so compare only what
// they use: without this the dragged node re-rendered its whole body per frame.
export const nodePropsEqual = (a: NodeProps, b: NodeProps) =>
  a.id === b.id && a.data === b.data && a.selected === b.selected;
