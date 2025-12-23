import React, { memo, useMemo } from 'react';
import { useReactFlow, useStore } from 'reactflow';
import { Link2 } from 'lucide-react';
import { NodeData } from '../../types';

interface JumpTargetBadgeProps {
  nodeId: string;
  className?: string;
}

const JumpTargetBadge = ({ nodeId, className = '' }: JumpTargetBadgeProps) => {
  const nodes = useStore((state) => state.getNodes());
  const { fitView, setNodes } = useReactFlow();

  const jumpSource = useMemo(
    () => nodes.find((n) => n.type === 'jumpNode' && (n.data as NodeData).jumpTargetId === nodeId),
    [nodes, nodeId]
  );

  if (!jumpSource) return null;

  const jumpLabel = (jumpSource.data as NodeData).label || 'Jump';

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setNodes((nds) => nds.map((node) => ({ ...node, selected: node.id === jumpSource.id })));
    fitView({ nodes: [{ id: jumpSource.id }], duration: 450, padding: 0.6, maxZoom: 1.4 });
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
