import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  useNodesState,
  useEdgesState,
  MarkerType,
  Connection,
  Edge,
  Node
} from 'reactflow';
import { AppNode } from '../types';
import { useProjectState } from './useProjectState';
import { nodeRegistry, NodeTypeKey } from '../core/nodes/nodeRegistry';
import { useCommandHistory } from '../editor/history/useCommandHistory';
import { CommandContext } from '../editor/commands/types';
import { addElementsCommand } from '../editor/commands/addElementsCommand';
import { deleteNodeCommand } from '../editor/commands/deleteNodeCommand';
import { connectEdgeCommand } from '../editor/commands/connectEdgeCommand';
import { reconnectEdgeCommand } from '../editor/commands/reconnectEdgeCommand';
import { deleteEdgeCommand } from '../editor/commands/deleteEdgeCommand';
import { updateNodeCommand } from '../editor/commands/updateNodeCommand';
import { updateEdgeCommand } from '../editor/commands/updateEdgeCommand';
import { NodeTransform } from '../editor/commands/moveNodeCommand';

export function useFlowLogic(projectIdOrName?: string) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Synchronous reads for commands (e.g. deleteNodeCommand) that need current
  // state before deciding what to mutate — a setNodes/setEdges updater function is
  // never invoked synchronously by React, so commands must not depend on reading
  // a value back out of one within the same execute() call.
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const ctx: CommandContext = useMemo(
    () => ({ setNodes, setEdges, getNodes: () => nodesRef.current, getEdges: () => edgesRef.current }),
    [setNodes, setEdges]
  );
  const history = useCommandHistory();

  const [jumpClipboard, setJumpClipboard] = useState<{ id: string; label: string } | null>(null);

  // Records every dragged node's transform (position/parentNode/extent) at drag
  // start — ReactFlow reports all nodes actually being dragged (the whole
  // selection, not just the one under the cursor) as the drag handler's third
  // argument — so useDragAndDrop's onNodeDragStop can build one command that moves
  // (and can undo) the entire dragged set, not just the primary node.
  const dragStartRef = useRef<(({ id: string } & NodeTransform)[]) | null>(null);

  const onNodeDragStart = useCallback((_event: unknown, _node: Node, draggedNodes: Node[]) => {
    dragStartRef.current = draggedNodes.map(n => ({
      id: n.id,
      position: n.position,
      parentNode: n.parentNode,
      extent: (n as any).extent,
    }));
  }, []);

    const { project, setProject, isInitializing, lastSaved, saveNow } = useProjectState(nodes, edges, setNodes, setEdges, projectIdOrName);

    // Clipboard for copy/paste (stores nodes + edges snapshot)
    const clipboardRef = useRef<{ nodes: AppNode[]; edges: Edge[] } | null>(null);

    const copySelected = useCallback(() => {
        const selected = nodes.filter(n => n.selected) as AppNode[];
        if (selected.length === 0) return;

        const selectedIds = new Set(selected.map(n => n.id));
        const relatedEdges = edges.filter(e => selectedIds.has(e.source) && selectedIds.has(e.target));

        // Deep clone to avoid referencing original objects
        const clonedNodes = selected.map(n => ({ ...n, data: { ...n.data } }));
        const clonedEdges = relatedEdges.map(e => ({ ...e, data: { ...e.data } }));

        clipboardRef.current = { nodes: clonedNodes, edges: clonedEdges };
    }, [nodes, edges]);

    const pasteClipboard = useCallback(() => {
        if (!clipboardRef.current) return;
        const { nodes: copiedNodes, edges: copiedEdges } = clipboardRef.current;

        // Map old ids to new ids
        const idMap: Record<string, string> = {};
        const newNodes: AppNode[] = copiedNodes.map(n => {
            const newId = `node-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
            idMap[n.id] = newId;
            return {
                ...n,
                id: newId,
                position: { x: (n.position?.x || 0) + 20, y: (n.position?.y || 0) + 20 },
                selected: true
            } as AppNode;
        });

        const newEdges: Edge[] = copiedEdges.map(e => {
            const newId = `e-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
            return {
                ...e,
                id: newId,
                source: idMap[e.source] || e.source,
                target: idMap[e.target] || e.target
            } as Edge;
        });

        history.execute(addElementsCommand(ctx, newNodes, newEdges, true));
    }, [ctx, history]);

  // Migration for edge design
  useEffect(() => {
      if (!isInitializing && edges.length > 0) {
          const needsUpdate = edges.some(e => e.type === 'floating' && (e.animated || !e.markerEnd));
          if (needsUpdate) {
              setEdges(eds => eds.map(e => {
                  if (e.type === 'floating') {
                      return {
                          ...e,
                          animated: false,
                          markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 }
                      };
                  }
                  return e;
              }));
          }
      }
  }, [isInitializing, edges, setEdges]);

  // Cache for memoized nodes
  const nodeWrapperCache = useRef(new WeakMap<AppNode, AppNode>());

  // Inject variables into nodes for highlighting
  const nodesWithContext = useMemo(() => {
    return nodes.map(node => {
      const cached = nodeWrapperCache.current.get(node as AppNode);
      if (cached && cached.data.variables === project.variables) {
        return cached;
      }

      const newNode = {
        ...node,
        data: {
          ...node.data,
          variables: project.variables,
          projectAssets: project.assets
        }
      };
      nodeWrapperCache.current.set(node as AppNode, newNode as AppNode);
      return newNode;
    });
  }, [nodes, project.variables]);

  const updateNodeData = useCallback((id: string, data: any) => {
    history.execute(updateNodeCommand(ctx, id, (n) => ({ ...n, data: { ...n.data, ...data } })));
  }, [ctx, history]);

  const updateNode = useCallback((id: string, patch: Partial<AppNode>) => {
      history.execute(updateNodeCommand(ctx, id, (n) => ({ ...n, ...patch })));
  }, [ctx, history]);

  const updateEdgeData = useCallback((id: string, data: any) => {
      history.execute(updateEdgeCommand(ctx, id, (e) => ({ ...e, data: { ...e.data, ...data } })));
  }, [ctx, history]);

  const updateEdgeColor = useCallback((id: string, color: string) => {
      history.execute(updateEdgeCommand(ctx, id, (e) => ({ ...e, style: { ...e.style, stroke: color } })));
  }, [ctx, history]);

  const updateEdgeLabel = useCallback((id: string, label: string) => {
      history.execute(updateEdgeCommand(ctx, id, (e) => ({ ...e, label })));
  }, [ctx, history]);

  const onConnect = useCallback((params: Connection) => {
    // ReactFlow's Connection type allows null endpoints mid-drag; onConnect is
    // only ever called once both are resolved, but narrows for strict mode.
    if (!params.source || !params.target) return;
    if (params.source === params.target) return;

    const isDuplicate = edges.some(edge =>
      (edge.source === params.source && edge.target === params.target) ||
      (edge.source === params.target && edge.target === params.source)
    );

    if (isDuplicate) return;

    const sourceNode = nodes.find(n => n.id === params.source);
    let existingBranchEdge: Edge | undefined;

    if (sourceNode?.type === 'conditionNode') {
        existingBranchEdge = edges.find(e =>
            e.source === params.source &&
            e.sourceHandle === params.sourceHandle
        );
    }

    const edge: Edge = {
        // Not spreading `params` directly: TS's narrowing of params.source/
        // target above (both non-null) doesn't propagate through an object
        // spread, since spread reconstructs the object from params' original
        // declared (nullable) type rather than the narrowed one.
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
        type: 'floating',
        id: `e-${params.source}-${params.target}-${Date.now()}`,
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 },
        style: { stroke: '#71717a'}
    };
    history.execute(connectEdgeCommand(ctx, edge, existingBranchEdge));
  }, [edges, nodes, ctx, history]);

  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    history.execute(reconnectEdgeCommand(ctx, oldEdge, newConnection));
  }, [ctx, history]);

  const addNode = useCallback((type: NodeTypeKey, position?: { x: number, y: number }, extraData?: any) => {
    const id = `node-${Date.now()}`;
    const nodePosition = position || { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 };
    const { style: extraStyle, ...extraFields } = extraData || {};
    const entry = nodeRegistry[type];
    const zIndex = entry.defaultZIndex;
    const style = type === 'sectionNode' ? { width: 400, height: 300, ...extraStyle } : extraStyle;

    const newNode: AppNode = { id, type, position: nodePosition, data: entry.create(extraFields), zIndex, style };
    history.execute(addElementsCommand(ctx, [newNode]));
  }, [ctx, history]);

  const deleteNode = useCallback((id: string, deleteChildren: boolean = false) => {
    history.execute(deleteNodeCommand(ctx, id, deleteChildren));
  }, [ctx, history]);

  const deleteEdge = useCallback((id: string) => {
      history.execute(deleteEdgeCommand(ctx, id));
  }, [ctx, history]);

  return {
    nodes,
    edges,
    nodesWithContext,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onReconnect,
    addNode,
    deleteNode,
    deleteEdge,
    updateNodeData,
    updateNode,
    updateEdgeData,
    updateEdgeColor,
    updateEdgeLabel,
    project,
    setProject,
    isInitializing,
    lastSaved,
    saveNow,
    copySelected,
    pasteClipboard,
    jumpClipboard,
    setJumpClipboard,
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    onNodeDragStart,
    dragStartRef,
    ctx,
    executeCommand: history.execute,
  };
}
