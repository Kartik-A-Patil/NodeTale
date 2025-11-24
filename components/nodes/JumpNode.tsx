import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { Forward, Link as LinkIcon } from 'lucide-react';
import { NodeData } from '../../types';

const JumpNode = ({ id, data, selected }: NodeProps<NodeData>) => {
  const { setNodes, getNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const primaryColor = data.color || '#a855f7'; // Default purple

  const handleTargetChange = (targetId: string) => {
      const allNodes = getNodes();
      const target = allNodes.find(n => n.id === targetId);
      
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              data: { 
                  ...node.data, 
                  jumpTargetId: targetId,
                  jumpTargetLabel: target?.data.label || 'Unknown'
              },
            };
          }
          return node;
        })
      );
      setIsEditing(false);
  };

  const availableTargets = isEditing ? getNodes().filter(n => n.id !== id && n.type !== 'jumpNode') : [];

  return (
    <div
      className={`px-3 py-2 bg-[#18181b] border-2 rounded-lg flex items-center gap-3 min-w-[160px] transition-all ${
        selected ? 'shadow-lg' : ''
      }`}
      style={{ 
        borderColor: selected ? primaryColor : data.color || '#581c87',
        boxShadow: selected ? `0 0 10px ${primaryColor}33` : 'none',
        backgroundColor: data.color ? `${data.color}05` : '#18181b'
      }}
      onDoubleClick={() => setIsEditing(true)}
    >
      <div 
          className="p-1.5 rounded-md"
          style={{ backgroundColor: `${primaryColor}22` }}
      >
        <Forward size={16} style={{ color: primaryColor }} />
      </div>
      
      <div className="flex flex-col flex-1 overflow-hidden">
          <span className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: primaryColor }}>Jump To</span>
          
          {isEditing ? (
              <select 
                  className="nodrag w-full bg-[#0f0f11] border border-zinc-700 rounded text-xs text-zinc-200 p-1 focus:outline-none focus:border-purple-500"
                  value={data.jumpTargetId || ''}
                  onChange={(e) => handleTargetChange(e.target.value)}
                  onBlur={() => setIsEditing(false)}
                  autoFocus
                  onMouseDown={(e) => e.stopPropagation()} 
              >
                  <option value="">Select Target...</option>
                  {availableTargets.map(n => (
                      <option key={n.id} value={n.id}>{n.data.label}</option>
                  ))}
              </select>
          ) : (
            <div className="flex items-center gap-1 text-zinc-200 text-xs font-medium cursor-pointer" title="Double click to change target">
                <LinkIcon size={10} className="text-zinc-500" />
                <span className="truncate max-w-[100px]">
                    {data.jumpTargetId ? (data.jumpTargetLabel || 'Target Set') : 'No Target'}
                </span>
            </div>
          )}
      </div>
      
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-zinc-900"
        style={{ backgroundColor: primaryColor }}
      />
    </div>
  );
};

export default memo(JumpNode);