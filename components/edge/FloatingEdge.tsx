import { useCallback } from 'react';
import { useStore, getBezierPath, EdgeProps, Node, Position } from 'reactflow';
import { getEdgeParams } from '../../utils/EdgeUtils';

function FloatingEdge({ id, source, target, sourceHandleId, targetHandleId, markerEnd, style }: EdgeProps) {
  const sourceNode = useStore(useCallback((store) => store.nodeInternals.get(source), [source]));
  const targetNode = useStore(useCallback((store) => store.nodeInternals.get(target), [target]));

  if (!sourceNode || !targetNode) {
    return null;
  }

  // Helper to get handle position if node is not floating
  const getHandlePosition = (node: Node, handleId: string | null | undefined, type: 'source' | 'target') => {
      if (node.type === 'elementNode') return undefined; // Element nodes always float

      // Try to get exact handle bounds first
      const handleBounds = node[Symbol.for('__reactFlowHandleBounds') as any] || (node as any).handleBounds;
      
      if (handleBounds) {
          const handles = type === 'source' ? handleBounds.source : handleBounds.target;
          if (handles && handles.length > 0) {
              const handle = handleId ? handles.find((h: any) => h.id === handleId) : handles[0];
              if (handle) {
                  return {
                      x: (node.positionAbsolute?.x ?? 0) + handle.x + handle.width / 2,
                      y: (node.positionAbsolute?.y ?? 0) + handle.y + handle.height / 2,
                      position: handle.position
                  };
              }
          }
      }

      // Fallback: Enforce sides for specific node types if handleBounds is missing
      if (node.type === 'conditionNode') {
          if (type === 'target') {
               return {
                   x: (node.positionAbsolute?.x ?? 0),
                   y: (node.positionAbsolute?.y ?? 0) + 24, // Approx header center
                   position: Position.Left
               };
          }
          if (type === 'source') {
               // Try to calculate position based on branch index
               if (node.data && node.data.branches && Array.isArray(node.data.branches)) {
                   const branchIndex = node.data.branches.findIndex((b: any) => b.id === handleId);
                   if (branchIndex !== -1) {
                       const rowHeight = 40; // h-10 is 40px
                       const yOffset = (branchIndex * rowHeight) + (rowHeight / 2);
                       return {
                           x: (node.positionAbsolute?.x ?? 0) + ((node.width && node.width > 0) ? node.width : 240),
                           y: (node.positionAbsolute?.y ?? 0) + yOffset,
                           position: Position.Right
                       };
                   }
               }

               // Fallback if branch not found
               return {
                   x: (node.positionAbsolute?.x ?? 0) + ((node.width && node.width > 0) ? node.width : 240),
                   y: (node.positionAbsolute?.y ?? 0) + ((node.height && node.height > 0) ? node.height : 100) / 2,
                   position: Position.Right
               };
          }
      }

      if (node.type === 'jumpNode' && type === 'target') {
           return {
               x: (node.positionAbsolute?.x ?? 0),
               y: (node.positionAbsolute?.y ?? 0) + ((node.height && node.height > 0) ? node.height : 42) / 2,
               position: Position.Left
           };
      }

      return undefined;
  };

  const sourceHandlePos = getHandlePosition(sourceNode as unknown as Node, sourceHandleId, 'source');
  const targetHandlePos = getHandlePosition(targetNode as unknown as Node, targetHandleId, 'target');

  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(
      sourceNode as unknown as Node, 
      targetNode as unknown as Node,
      sourceHandlePos,
      targetHandlePos
  );

  const [edgePath] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos,
    targetX: tx,
    targetY: ty,
    targetPosition: targetPos,
  });

  return (
    <path
      id={id}
      className="react-flow__edge-path"
      d={edgePath}
      markerEnd={markerEnd}
      style={style}
    />
  );
}

export default FloatingEdge;
