import { Edge } from 'reactflow';
import { AppNode } from '../../types';

export interface Command {
  execute(): void;
  undo(): void;
}

// Wraps the existing ReactFlow state setters. Nodes/edges stay plain
// useNodesState/useEdgesState state — only the undo/redo mechanism is
// command-based, not the state itself.
//
// getNodes/getEdges are ref-backed synchronous reads (see useFlowLogic.ts's
// nodesRef/edgesRef) — commands must use these instead of reading a value back
// out of a setNodes/setEdges updater's closure within the same execute() call.
// React's state setter never invokes the updater synchronously, so a command that
// calls setNodes(...) and then immediately depends on something the updater
// computed would read stale/uninitialized data.
export interface CommandContext {
  setNodes: (nodes: AppNode[] | ((nds: AppNode[]) => AppNode[])) => void;
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
  getNodes: () => AppNode[];
  getEdges: () => Edge[];
}
