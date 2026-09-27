import React, { useState, useCallback, useRef } from 'react';
import { Node, Edge } from 'reactflow';

export type MenuState = { 
  x: number; 
  y: number; 
  type: 'node' | 'pane' | 'edge'; 
  id?: string; 
  label?: string;
  selectedNodeIds?: string[];
} | null;

export function useContextMenu(selectedNodes: Node[]) {
  const [menu, setMenu] = useState<MenuState>(null);
  // Read through a ref: ReactFlow passes onNodeContextMenu to every node, so a
  // callback that changed with the selection re-rendered every node on select.
  const selectedNodesRef = useRef(selectedNodes);
  selectedNodesRef.current = selectedNodes;

  const onPaneClick = useCallback(() => {
      setMenu(null);
  }, []);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      const selectedIds = selectedNodesRef.current.map(n => n.id);
      setMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'node',
        id: node.id,
        label: node.data?.label,
        selectedNodeIds: selectedIds.includes(node.id) ? selectedIds : [node.id]
      });
    },
    []
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      setMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'edge',
        id: edge.id
      });
    },
    []
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'pane'
      });
    },
    []
  );

  return {
    menu,
    setMenu,
    onNodeContextMenu,
    onEdgeContextMenu,
    onPaneContextMenu,
    onPaneClick
  };
}
