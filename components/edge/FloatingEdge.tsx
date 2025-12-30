import { useCallback, useMemo } from 'react';
import { useStore, getBezierPath, getStraightPath, getSmoothStepPath, EdgeProps, Node, Position, EdgeLabelRenderer, useReactFlow } from 'reactflow';
import { X } from 'lucide-react';
import { getEdgeParams } from '../../utils/EdgeUtils';

function FloatingEdge({ id, source, target, sourceHandleId, targetHandleId, markerEnd, style, selected, data, label, labelStyle }: EdgeProps) {
  const sourceNode = useStore(useCallback((store) => store.nodeInternals.get(source), [source]));
  const targetNode = useStore(useCallback((store) => store.nodeInternals.get(target), [target]));
  const { setEdges } = useReactFlow();

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
                       const headerHeight = 5; // Header (~33px) + py-1 (4px) + border (1px)
                       const rowHeight = 47; // h-10 is 40px
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

  // Ensure label used in textarea is a string to satisfy its value prop typing
  const labelText = typeof label === 'string' ? label : '';

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

  const updateLabel = (newLabel: string) => {
    setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, label: newLabel } : e)));
  };

  const removeLabel = () => {
    setEdges((eds) => eds.map((e) => (
      e.id === id
        ? { ...e, label: '', data: { ...(e.data || {}), labelEnabled: false } }
        : e
    )));
  };

  const measuredWidth = useMemo(() => {
    const text = (labelText || 'Type label..').toString();
    const lines = text.split(/\r?\n/);
    const longest = Math.max(...lines.map((l) => l.length), 0);
    const charPx = 7; // approximate width per character at text-xs
    const paddingPx = 16; // horizontal padding inside the container
    const minPx = 80; // roughly placeholder size
    const maxPx = 400; // cap to avoid overly wide labels
    const width = Math.max(minPx, Math.min(maxPx, longest * charPx + paddingPx));
    return width;
  }, [labelText]);

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={20}
        className="react-flow__edge-interaction"
        style={{ transition: 'd 0.02s ease-out' }}
      />
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: 2,
          stroke: selected ? '#F97316' : (style?.stroke || '#94a3b8'),
          transition: 'stroke 0.1s ease, stroke-width 0.1s ease, d 0.05s ease-out',
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
      {data?.labelEnabled && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: '#18181b',
              borderRadius: 4,
              fontSize: 12,
              color: '#a1a1aa',
              pointerEvents: 'all',
              border: '1px solid #27272a',
              zIndex: 10,
              width: measuredWidth,
              ...labelStyle,
            }}
            className="nodrag nopan relative"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <input
              className="nodrag bg-transparent border-none outline-none px-2 py-1.5 w-full text-xs text-zinc-300 placeholder-zinc-500"
              value={labelText}
              onChange={(e) => updateLabel(e.target.value.slice(0, 100))}
              placeholder="Type label.."
              onMouseDown={(e) => e.stopPropagation()}
            />
            {selected && (
              <button
                title="Clear label"
                onClick={(e) => { e.stopPropagation(); removeLabel(); }}
                className="absolute -top-2 -right-2 p-0.5 rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
              >
                <X size={10} />
              </button>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default FloatingEdge;
