import FloatingEdge from './edge/FloatingEdge';
import { nodeRegistry } from '../core/nodes/nodeRegistry';

export const nodeTypes = Object.fromEntries(
  Object.entries(nodeRegistry).map(([type, entry]) => [type, entry.component])
);

export const edgeTypes = {
  floating: FloatingEdge,
};
