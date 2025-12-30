import React,{ useCallback } from 'react';
import { ReactFlowInstance, Node } from 'reactflow';
import { AppNode } from '../types';

export function useDragAndDrop(
    nodes: AppNode[],
    setNodes: (nodes: AppNode[] | ((nds: AppNode[]) => AppNode[])) => void,
    reactFlowInstance: ReactFlowInstance | null,
    reactFlowWrapper: React.RefObject<HTMLDivElement>,
    takeSnapshot: () => void
) {
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onNodeDragStop = useCallback((event: React.MouseEvent, node: Node) => {
      // Check intersection with section nodes to handle grouping
      if (!reactFlowInstance) return;

      // If node is already a child, check if it's moved out
      // Or if it's a standalone node, check if it's moved in
      
      // Get all section nodes
      const sectionNodes = nodes.filter(n => n.type === 'sectionNode' && n.id !== node.id);
      
      // Simple intersection check
      const nodeRect = {
          x: node.positionAbsolute?.x || node.position.x,
          y: node.positionAbsolute?.y || node.position.y,
          width: node.width || 150,
          height: node.height || 100
      };

      let parentSection = null;

      for (const section of sectionNodes) {
          const sectionRect = {
              x: section.positionAbsolute?.x || section.position.x,
              y: section.positionAbsolute?.y || section.position.y,
              width: section.width || 400,
              height: section.height || 300
          };

          if (
              nodeRect.x > sectionRect.x &&
              nodeRect.x + nodeRect.width < sectionRect.x + sectionRect.width &&
              nodeRect.y > sectionRect.y &&
              nodeRect.y + nodeRect.height < sectionRect.y + sectionRect.height
          ) {
              parentSection = section;
              break;
          }
      }

      if (parentSection && node.parentNode !== parentSection.id) {
          takeSnapshot();
          // Move into section
          setNodes(nds => nds.map(n => {
              if (n.id === node.id) {
                  const relativeX = nodeRect.x - (parentSection!.positionAbsolute?.x || parentSection!.position.x);
                  const relativeY = nodeRect.y - (parentSection!.positionAbsolute?.y || parentSection!.position.y);
                  
                  return {
                      ...n,
                      parentNode: parentSection!.id,
                      // extent: 'parent', // Removed to allow dragging out
                      position: { x: relativeX, y: relativeY }
                  };
              }
              return n;
          }));
      } else if (!parentSection && node.parentNode) {
          takeSnapshot();
          // Move out of section
          setNodes(nds => nds.map(n => {
              if (n.id === node.id) {
                  return {
                      ...n,
                      parentNode: undefined,
                      extent: undefined,
                      position: { x: nodeRect.x, y: nodeRect.y }
                  };
              }
              return n;
          }));
      }
  }, [nodes, reactFlowInstance, setNodes, takeSnapshot]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const type = event.dataTransfer.getData('application/reactflow/type');
      const payloadStr = event.dataTransfer.getData('application/reactflow/payload');
      
      if (!type) return;

      takeSnapshot();

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const payload = payloadStr ? JSON.parse(payloadStr) : {};
      
      const newNode: AppNode = {
        id: `node-${Date.now()}`,
        type,
        position,
        data: { 
            label: payload.label || 'New Node',
            ...payload
        },
      };

      setNodes(nds => [...nds, newNode]);
    },
    [reactFlowInstance, reactFlowWrapper, setNodes, takeSnapshot]
  );

  return {
      onDragOver,
      onNodeDragStop,
      onDrop
  };
}
