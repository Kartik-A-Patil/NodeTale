import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { 
  useNodesState, 
  useEdgesState, 
  addEdge, 
  reconnectEdge, 
  MarkerType, 
  Connection, 
  Edge, 
  Node 
} from 'reactflow';
import { AppNode } from '../types';
import { useProjectState } from './useProjectState';

export function useFlowLogic() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // Undo/Redo State
  const [past, setPast] = useState<{ nodes: AppNode[], edges: Edge[] }[]>([]);
  const [future, setFuture] = useState<{ nodes: AppNode[], edges: Edge[] }[]>([]);
  const [jumpClipboard, setJumpClipboard] = useState<{ id: string; label: string } | null>(null);

  const takeSnapshot = useCallback(() => {
      setPast(past => {
          const newPast = [...past, { nodes, edges }];
          if (newPast.length > 50) newPast.shift();
          return newPast;
      });
      setFuture([]);
  }, [nodes, edges]);

  const undo = useCallback(() => {
      if (past.length === 0) return;
      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);
      
      setFuture(future => [{ nodes, edges }, ...future]);
      setPast(newPast);
      
      setNodes(previous.nodes);
      setEdges(previous.edges);
  }, [past, nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
      if (future.length === 0) return;
      const next = future[0];
      const newFuture = future.slice(1);
      
      setPast(past => [...past, { nodes, edges }]);
      setFuture(newFuture);
      
      setNodes(next.nodes);
      setEdges(next.edges);
  }, [future, nodes, edges, setNodes, setEdges]);

  const { project, setProject, isInitializing, lastSaved } = useProjectState(nodes, edges, setNodes, setEdges);

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
          variables: project.variables
        }
      };
      nodeWrapperCache.current.set(node as AppNode, newNode as AppNode);
      return newNode;
    });
  }, [nodes, project.variables]);

  const updateNodeData = useCallback((id: string, data: any) => {
    takeSnapshot();
    setNodes(nds => nds.map(node => {
      if (node.id === id) {
        return { ...node, data: { ...node.data, ...data } };
      }
      return node;
    }));
  }, [setNodes, takeSnapshot]);

  const updateEdgeData = useCallback((id: string, data: any) => {
      takeSnapshot();
      setEdges(eds => eds.map(e => {
          if (e.id === id) {
              return { ...e, data: { ...e.data, ...data } };
          }
          return e;
      }));
  }, [setEdges, takeSnapshot]);

  const updateEdgeColor = useCallback((id: string, color: string) => {
      takeSnapshot();
      setEdges(eds => eds.map(e => {
          if (e.id === id) {
              return { ...e, style: { ...e.style, stroke: color } };
          }
          return e;
      }));
  }, [setEdges, takeSnapshot]);

  const updateEdgeLabel = useCallback((id: string, label: string) => {
      takeSnapshot();
      setEdges(eds => eds.map(e => {
          if (e.id === id) {
              return { ...e, label };
          }
          return e;
      }));
  }, [setEdges, takeSnapshot]);

  const onConnect = useCallback((params: Connection) => {
    if (params.source === params.target) return;

    const isDuplicate = edges.some(edge => 
      (edge.source === params.source && edge.target === params.target) ||
      (edge.source === params.target && edge.target === params.source)
    );

    if (isDuplicate) return;

    takeSnapshot();

    const sourceNode = nodes.find(n => n.id === params.source);
    let currentEdges = edges;

    if (sourceNode?.type === 'conditionNode') {
        const existingBranchEdge = currentEdges.find(e => 
            e.source === params.source && 
            e.sourceHandle === params.sourceHandle
        );
        
        if (existingBranchEdge) {
            currentEdges = currentEdges.filter(e => e.id !== existingBranchEdge.id);
        }
    }

    const edge: Edge = { 
        ...params, 
        type: 'floating',
        id: `e-${params.source}-${params.target}-${Date.now()}`,
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 },
        style: { stroke: '#71717a'}
    };
    setEdges(eds => addEdge(edge, currentEdges));
  }, [edges, nodes, setEdges, takeSnapshot]);

  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    takeSnapshot();
    setEdges(eds => reconnectEdge(oldEdge, newConnection, eds));
  }, [setEdges, takeSnapshot]);

  const addNode = useCallback((type: 'elementNode' | 'conditionNode' | 'jumpNode' | 'commentNode' | 'sectionNode' | 'annotationNode', position?: { x: number, y: number }, extraData?: any) => {
    takeSnapshot();
    const id = `node-${Date.now()}`;
    const newNode: AppNode = {
      id,
      type,
      position: position || { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: { 
          label: type === 'elementNode' ? 'New Element' : type === 'conditionNode' ? 'Logic Check' : type === 'sectionNode' ? 'New Section' : type === 'annotationNode' ? 'Annotation' : 'Jump', 
          content: type === 'annotationNode' ? 'This is an annotation describing a part of the flow.' : '',
          condition: type === 'conditionNode' ? 'var == true' : undefined,
          text: '',
          ...extraData
      },
      zIndex: type === 'sectionNode' ? -1 : undefined,
      style: type === 'sectionNode' ? { width: 400, height: 300 } : undefined,
    };
    setNodes(nds => [...nds, newNode]);
  }, [setNodes, takeSnapshot]);

  const deleteNode = useCallback((id: string, deleteChildren: boolean = false) => {
    takeSnapshot();
    
    // We need to identify which nodes to delete.
    // If we are deleting a section with children, we need to find those children.
    // We use the functional update to ensure we are working with the latest state,
    // but we also need to update edges based on what we delete.
    
    setNodes(nds => {
        const nodeToDelete = nds.find(n => n.id === id);
        if (!nodeToDelete) return nds;

        let idsToDelete = [id];
        
        if (nodeToDelete.type === 'sectionNode') {
             if (deleteChildren) {
                 const children = nds.filter(n => n.parentNode === id);
                 idsToDelete = [...idsToDelete, ...children.map(n => n.id)];
             } else {
                 // Ungroup: Remove parentNode from children
                 return nds.filter(n => n.id !== id).map(n => {
                     if (n.parentNode === id) {
                         return {
                             ...n,
                             parentNode: undefined,
                             position: n.positionAbsolute || n.position,
                             extent: undefined
                         };
                     }
                     return n;
                 });
             }
        }

        // Side effect: Delete edges connected to deleted nodes
        // Note: This is a bit of a hack to set edges from within setNodes, 
        // but it ensures we use the consistent set of deleted IDs.
        // Ideally we would calculate idsToDelete outside, but we need 'nds' state.
        // To avoid the side effect warning/issue, we can schedule the edge update.
        setTimeout(() => {
            setEdges(eds => eds.filter(e => !idsToDelete.includes(e.source) && !idsToDelete.includes(e.target)));
        }, 0);
        
        return nds.filter(n => !idsToDelete.includes(n.id));
    });
  }, [setNodes, setEdges, takeSnapshot]);

  const deleteEdge = useCallback((id: string) => {
      takeSnapshot();
      setEdges(eds => eds.filter(e => e.id !== id));
  }, [setEdges, takeSnapshot]);

  const onNodeDragStart = useCallback(() => {
      takeSnapshot();
  }, [takeSnapshot]);

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
    updateEdgeData,
    updateEdgeColor,
    updateEdgeLabel,
    project,
    setProject,
    isInitializing,
    lastSaved,
    jumpClipboard,
    setJumpClipboard,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    onNodeDragStart,
    takeSnapshot
  };
}
