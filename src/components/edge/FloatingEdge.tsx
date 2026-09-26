import { memo, useCallback, useMemo } from 'react';
import { useStore, getBezierPath, getStraightPath, getSmoothStepPath, EdgeProps, Node, Position, EdgeLabelRenderer, ReactFlowState } from 'reactflow';
import { X } from 'lucide-react';
import { getEdgeParams, HandlePoint, NodeGeometry } from '../../utils/EdgeUtils';
import { Branch } from '../../types';
import { useEditor } from '../../editor/EditorContext';

type EndpointGeometry = NodeGeometry & { type?: string; branches?: Branch[] };

const toGeometry = (node: Node | undefined): EndpointGeometry | null =>
  node
    ? {
        type: node.type,
        x: node.positionAbsolute?.x ?? 0,
        y: node.positionAbsolute?.y ?? 0,
        width: node.width ?? 0,
        height: node.height ?? 0,
        // Only condition sources route by branch (see getBranchHandle)
        branches: node.type === 'conditionNode' ? node.data?.branches : undefined,
      }
    : null;

const sameGeometry = (a: EndpointGeometry | null, b: EndpointGeometry | null) =>
  a === b ||
  (!!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height &&
    a.type === b.type && a.branches === b.branches);

const DEFAULT_BRANCHES: Branch[] = [
  { id: 'true', label: 'If', condition: 'true' },
  { id: 'false', label: 'Else', condition: '' },
];

// Condition nodes are the one source with fixed handles: one per branch row on
// the right edge. Every other endpoint floats to whichever side faces the other node.
const getBranchHandle = (node: EndpointGeometry, handleId: string | null | undefined): HandlePoint | undefined => {
  if (node.type !== 'conditionNode') return undefined;
  const width = node.width > 0 ? node.width : 240;
  const branches = node.branches || DEFAULT_BRANCHES;
  const branchIndex = branches.findIndex((b) => b.id === handleId);
  if (branchIndex !== -1) {
    const headerHeight = 5;
    const rowHeight = 47;
    return { x: node.x + width, y: node.y + headerHeight + branchIndex * rowHeight + rowHeight / 2, position: Position.Right };
  }
  // Fallback if branch not found
  return { x: node.x + width, y: node.y + (node.height > 0 ? node.height : 100) / 2, position: Position.Right };
};

function FloatingEdge({ id, source, target, sourceHandleId, markerEnd, style, selected, data, label, labelStyle }: EdgeProps) {
  // ReactFlow rebuilds every node's internals object on each nodes update, so
  // selecting the node itself re-rendered every edge on every drag frame.
  // Selecting just the geometry (compared field-by-field) limits re-renders
  // to edges whose own endpoints changed.
  const sourceNode = useStore(useCallback((s: ReactFlowState) => toGeometry(s.nodeInternals.get(source)), [source]), sameGeometry);
  const targetNode = useStore(useCallback((s: ReactFlowState) => toGeometry(s.nodeInternals.get(target)), [target]), sameGeometry);
  const { updateEdge } = useEditor();

  // Ensure label used in textarea is a string to satisfy its value prop typing
  const labelText = typeof label === 'string' ? label : '';

  // Must stay above the early return below (Rules of Hooks).
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

  if (!sourceNode || !targetNode) {
    return null;
  }

  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(
      sourceNode,
      targetNode,
      getBranchHandle(sourceNode, sourceHandleId),
  );

  const pathType = data?.pathType || 'bezier';

  let edgePath: string;
  let labelX: number;
  let labelY: number;

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
    updateEdge(id, (e) => ({ ...e, label: newLabel }), `${id}:label`);
  };

  const removeLabel = () => {
    updateEdge(id, (e) => ({ ...e, label: '', data: { ...(e.data || {}), labelEnabled: false } }));
  };

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
          strokeWidth: 2,
          stroke: selected ? '#F97316' : (style?.stroke || '#94a3b8'),
          // No `d` transition: animating the path made edges trail behind a dragged
          // node (and split from the endpoint dot, which moves instantly).
          transition: 'stroke 0.1s ease, stroke-width 0.1s ease',
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

// ReactFlow also passes its own computed sourceX/targetX/... and handler props,
// which this edge ignores (it computes floating geometry itself). Compare only
// the props actually used, so unrelated changes don't re-render it.
const USED_PROPS = ['id', 'source', 'target', 'sourceHandleId', 'markerEnd', 'style', 'selected', 'data', 'label', 'labelStyle'] as const;

export default memo(FloatingEdge, (a, b) => USED_PROPS.every((k) => a[k] === b[k]));
