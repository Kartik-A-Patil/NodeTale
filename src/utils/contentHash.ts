import { Edge, Node } from 'reactflow';

export const hashString = (str: string): string => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
};

const objectHashCache = new WeakMap<object, string>();

// Excludes ReactFlow's transient fields (selected, dragging, positionAbsolute,
// resizing) so selecting/dragging a node doesn't look like a content change.
const pickNodeHashFields = (node: Node) =>
  JSON.stringify({ type: node.type, data: node.data, position: node.position, style: node.style, zIndex: node.zIndex, parentId: node.parentId });

const pickEdgeHashFields = (edge: Edge) =>
  JSON.stringify({ type: edge.type, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle, targetHandle: edge.targetHandle, animated: edge.animated, style: edge.style, label: edge.label, data: edge.data });

const hashObject = (obj: Node | Edge, pick: (obj: any) => string): string => {
  const cached = objectHashCache.get(obj);
  if (cached) return cached;
  const hash = hashString(pick(obj));
  objectHashCache.set(obj, hash);
  return hash;
};

export const computeBoardHash = (nodes: Node[], edges: Edge[]): string => {
  const nodePart = nodes.map(n => `${n.id}:${hashObject(n, pickNodeHashFields)}`).sort().join('|');
  const edgePart = edges.map(e => `${e.id}:${hashObject(e, pickEdgeHashFields)}`).sort().join('|');
  return hashString(`${nodePart}::${edgePart}`);
};
