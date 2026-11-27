import { createContext, useContext } from 'react';
import { Edge } from 'reactflow';
import { Asset, Variable } from '../models/story';
import { CanvasNode } from '../adapters/reactFlow';
import type { NodeStatusStore } from './nodeStatusStore';

// Project-level data and undoable edit actions for canvas node/edge components.
// Previously variables/assets were copied into every node's `data` (so every
// node re-rendered, and the copies leaked into saves) and nodes edited
// themselves through ReactFlow's setNodes, bypassing undo.
export interface EditorContextValue {
  variables: Variable[];
  assets: Asset[];
  updateNodeData: (id: string, data: Record<string, unknown>, mergeKey?: string) => void;
  updateNode: (id: string, patch: Partial<CanvasNode>, mergeKey?: string) => void;
  updateEdge: (id: string, applyPatch: (edge: Edge) => Edge, mergeKey?: string) => void;
  /** Start / ending / dead-end badges; read per node with useNodeStatus. */
  nodeStatus: NodeStatusStore;
}

export const EditorContext = createContext<EditorContextValue | null>(null);

export const useEditor = (): EditorContextValue => {
  const value = useContext(EditorContext);
  if (!value) throw new Error('useEditor must be used inside <EditorContext.Provider>');
  return value;
};
