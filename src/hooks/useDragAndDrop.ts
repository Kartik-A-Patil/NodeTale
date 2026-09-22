import React,{ useCallback } from 'react';
import { ReactFlowInstance, Node } from 'reactflow';
import { AppNode } from '../types';
import { CommandContext, Command } from '../editor/commands/types';
import { addElementsCommand } from '../editor/commands/addElementsCommand';
import { moveNodesCommand, NodeMove, NodeTransform } from '../editor/commands/moveNodeCommand';

export function useDragAndDrop(
    nodes: AppNode[],
    ctx: CommandContext,
    reactFlowInstance: ReactFlowInstance | null,
    reactFlowWrapper: React.RefObject<HTMLDivElement | null>,
    executeCommand: (command: Command) => void,
    dragStartRef: React.MutableRefObject<(({ id: string } & NodeTransform)[]) | null>
) {
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onNodeDragStop = useCallback((event: React.MouseEvent, node: Node, draggedNodes: Node[]) => {
      // Check intersection with section nodes to handle grouping
      if (!reactFlowInstance) return;

      const dragStart = dragStartRef.current;
      dragStartRef.current = null;
      if (!dragStart) return;
      const primaryStart = dragStart.find(d => d.id === node.id);
      if (!primaryStart) return;

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

      let primaryTo: NodeTransform;

      if (parentSection && node.parentNode !== parentSection.id) {
          // Move into section
          const relativeX = nodeRect.x - (parentSection.positionAbsolute?.x || parentSection.position.x);
          const relativeY = nodeRect.y - (parentSection.positionAbsolute?.y || parentSection.position.y);
          primaryTo = { position: { x: relativeX, y: relativeY }, parentNode: parentSection.id, extent: undefined };
      } else if (!parentSection && node.parentNode) {
          // Move out of section
          primaryTo = { position: { x: nodeRect.x, y: nodeRect.y }, parentNode: undefined, extent: undefined };
      } else {
          // Plain move, no reparenting — commit the drag's final position as-is
          // (already applied live by onNodesChange during the drag).
          primaryTo = { position: node.position, parentNode: node.parentNode, extent: (node as any).extent };
      }

      // Section-reparenting only ever applies to the node under the cursor; every
      // other co-dragged node (multi-selection drag) just commits wherever it
      // ended up, same as the primary node's "plain move" branch above.
      const moves: NodeMove[] = draggedNodes
        .map((n): NodeMove | null => {
          const start = dragStart.find(d => d.id === n.id);
          if (!start) return null;
          const to = n.id === node.id ? primaryTo : { position: n.position, parentNode: n.parentNode, extent: (n as any).extent };
          return { id: n.id, from: { position: start.position, parentNode: start.parentNode, extent: start.extent }, to };
        })
        .filter((m): m is NodeMove => m !== null);

      if (moves.length === 0) return;
      executeCommand(moveNodesCommand(ctx, moves));
  }, [nodes, reactFlowInstance, ctx, executeCommand, dragStartRef]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const type = event.dataTransfer.getData('application/reactflow/type');
      const payloadStr = event.dataTransfer.getData('application/reactflow/payload');

      if (!type) return;

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
      } as AppNode;

      executeCommand(addElementsCommand(ctx, [newNode]));
    },
    [reactFlowInstance, reactFlowWrapper, ctx, executeCommand]
  );

  return {
      onDragOver,
      onNodeDragStop,
      onDrop
  };
}
