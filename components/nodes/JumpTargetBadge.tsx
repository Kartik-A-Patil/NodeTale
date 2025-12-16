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
      className={`nodrag absolute top-1 right-1 p-1 rounded-full border border-purple-400/50 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:text-white transition-colors shadow-sm ${className}`}
      onClick={handleClick}
      title={`Linked from "${jumpLabel}"`}
    >
      <Link2 size={14} />
    </button>
  );
};

export default memo(JumpTargetBadge);
