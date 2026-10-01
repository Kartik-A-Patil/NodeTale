import React, { memo, useCallback } from 'react';
import { Node, useStore } from 'reactflow';
import { Link2 } from 'lucide-react';
import { JumpNodeData } from '../../models/story';
import { nodeIconButton, useFocusCanvasNode } from './nodeChrome';

interface JumpTargetBadgeProps {
  nodeId: string;
  className?: string;
}

/** Shown on nodes a Jump points at; click to go to that jump. */
const JumpTargetBadge = ({ nodeId, className = '' }: JumpTargetBadgeProps) => {
  // Select primitives, not the node list: getNodes() returns a fresh array on
  // every store tick (drag/pan/zoom), which re-rendered every badge per frame.
  const findSource = useCallback(
    (nodes: Iterable<Node>) => {
      for (const n of nodes) {
        if (n.type === 'jumpNode' && (n.data as JumpNodeData).jumpTargetId === nodeId) return n;
      }
      return undefined;
    },
    [nodeId]
  );
  const jumpSourceId = useStore(useCallback((s) => findSource(s.nodeInternals.values())?.id ?? null, [findSource]));
  const jumpLabel = useStore(
    useCallback((s) => (findSource(s.nodeInternals.values())?.data as JumpNodeData | undefined)?.label || 'Jump', [findSource])
  );
  const focusNode = useFocusCanvasNode();

  if (!jumpSourceId) return null;

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    focusNode(jumpSourceId);
  };

  return (
    <button
      type="button"
      className={`${nodeIconButton} ${className}`}
      onClick={handleClick}
      title={`Linked from "${jumpLabel}"`}
      aria-label={`Go to the jump "${jumpLabel}"`}
    >
      <Link2 size={14} />
    </button>
  );
};

export default memo(JumpTargetBadge);
