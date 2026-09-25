import React, { memo, useCallback } from 'react';
import { Node, useReactFlow, useStore } from 'reactflow';
import { Link2 } from 'lucide-react';
import { JumpNodeData } from '../../types';

interface JumpTargetBadgeProps {
  nodeId: string;
  className?: string;
}

const JumpTargetBadge = ({ nodeId, className = '' }: JumpTargetBadgeProps) => {
  // Select primitives, not the node list: getNodes() returns a fresh array on
  // every store tick (drag/pan/zoom), which re-rendered every badge per frame.
  // ponytail: still an O(n) scan per tick per badge; index jump targets if boards get huge.
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
  const { fitView, setNodes } = useReactFlow();

  if (!jumpSourceId) return null;

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setNodes((nds) => nds.map((node) => ({ ...node, selected: node.id === jumpSourceId })));
    fitView({ nodes: [{ id: jumpSourceId }], duration: 450, padding: 0.6, maxZoom: 1.4 });
  };

  return (
    <button
      type="button"
      className={`nodrag  h-6 w-6 rounded-full border border-white/5 bg-black/20 text-white-400/70 hover:text-purple-200 hover:border-purple-500/30 hover:bg-purple-950/30 transition-colors duration-150 shadow-none backdrop-blur ${className}`}
      onClick={handleClick}
      title={`Linked from "${jumpLabel}"`}
    >
      <Link2 size={12} className="mx-auto" />
    </button>
  );
};

export default memo(JumpTargetBadge);
