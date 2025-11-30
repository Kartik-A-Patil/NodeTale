import React,{ useState, useCallback } from 'react';
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

  const onPaneClick = useCallback(() => {
      setMenu(null);
  }, []);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'node',
        id: node.id,
        label: node.data.label,
        selectedNodeIds: selectedNodes.map(n => n.id)
      });
    },
    [selectedNodes]
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      if (!edge.selected) return;
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
