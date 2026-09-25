import { Edge } from 'reactflow';
import { AppNode } from '../../types';

export interface Command {
  execute(): void;
  undo(): void;
  // Consecutive commands with the same key (e.g. `${nodeId}:label` while typing)
  // collapse into one undo step. See mergeCommands.
  mergeKey?: string;
}

// One undo step spanning `first`..`last`: undo restores the state before
// `first`; redo re-applies `last`. Only valid for commands whose patch sets the
// same fields (what a shared mergeKey promises), since `last` alone reproduces
// the final state from the original one.
export function mergeCommands(first: Command, last: Command): Command {
  return { mergeKey: last.mergeKey, execute: () => last.execute(), undo: () => first.undo() };
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
