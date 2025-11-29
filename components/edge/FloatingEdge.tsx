import { useCallback } from 'react';
import { useStore, getBezierPath, getStraightPath, getSmoothStepPath, EdgeProps, Node, Position, EdgeLabelRenderer } from 'reactflow';
import { getEdgeParams } from '../../utils/EdgeUtils';

function FloatingEdge({ id, source, target, sourceHandleId, targetHandleId, markerEnd, style, selected, data, label, labelStyle }: EdgeProps) {
  const sourceNode = useStore(useCallback((store) => store.nodeInternals.get(source), [source]));
  const targetNode = useStore(useCallback((store) => store.nodeInternals.get(target), [target]));

  if (!sourceNode || !targetNode) {
    return null;
  }

  // Helper to get handle position if node is not floating
  const getHandlePosition = (node: Node, handleId: string | null | undefined, type: 'source' | 'target') => {
      // Nodes should be floating for target to allow dynamic connection points (connect to any side)
      if (['elementNode', 'componentNode', 'conditionNode', 'jumpNode'].includes(node.type || '') && type === 'target') return undefined;

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

      if (node.type === 'conditionNode') {
          if (type === 'source') {
               // Try to calculate position based on branch index
               const branches = (node.data && node.data.branches) || [
                   { id: 'true', label: 'If', condition: 'true' },
                   { id: 'false', label: 'Else', condition: '' }
               ];

               if (Array.isArray(branches)) {
                   const branchIndex = branches.findIndex((b: any) => b.id === handleId);
                   if (branchIndex !== -1) {
                       const headerHeight = 38; // Header (~33px) + py-1 (4px) + border (1px)
                       const rowHeight = 40; // h-10 is 40px
                       const yOffset = headerHeight + (branchIndex * rowHeight) + (rowHeight / 2);
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

  const pathType = data?.pathType || 'bezier';

  let edgePath = '';
  let labelX = 0;
  let labelY = 0;

  const params = {
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos,
    targetX: tx,
    targetY: ty,
    targetPosition: targetPos,
  };

  if (pathType === 'straight') {
      [edgePath, labelX, labelY] = getStraightPath({ sourceX: sx, sourceY: sy, targetX: tx, targetY: ty });
  } else if (pathType === 'step') {
      [edgePath, labelX, labelY] = getSmoothStepPath({ ...params, borderRadius: 0 });
  } else if (pathType === 'smoothstep') {
      [edgePath, labelX, labelY] = getSmoothStepPath(params);
  } else {
      [edgePath, labelX, labelY] = getBezierPath(params);
  }

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={20}
        className="react-flow__edge-interaction"
      />
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: selected ? 2 : 1,
          stroke: style?.stroke || '#71717a'
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${sx}px,${sy}px)`,
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: style?.stroke || '#71717a',
            zIndex: 10,
            pointerEvents: 'none',
          }}
          className="nodrag nopan"
        />
      </EdgeLabelRenderer>
      {label && (
        <EdgeLabelRenderer>
            <div
                style={{
                    position: 'absolute',
                    transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                    background: '#18181b',
                    padding: '4px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#a1a1aa',
                    pointerEvents: 'all',
                    border: '1px solid #27272a',
                    zIndex: 10,
                    ...labelStyle,
                }}
                className="nodrag nopan"
            >
                {label}
            </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default FloatingEdge;
