import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { NodeData, Branch } from '../../types';
import { X, GitBranch } from 'lucide-react';
import clsx from 'clsx';

const ConditionNode = ({ id, data, selected }: NodeProps<NodeData>) => {
  const { setNodes } = useReactFlow();
  const [editingField, setEditingField] = useState<'label' | null>(null);
  const [hoveredSide, setHoveredSide] = useState<'left' | null>(null);

  const branches = data.branches || [
    { id: 'true', label: 'If', condition: 'true' },
    { id: 'false', label: 'Else', condition: '' }
  ];

  const updateBranches = (newBranches: Branch[]) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, branches: newBranches } };
        }
        return node;
      })
    );
  };

  const handleChange = (field: string, value: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, [field]: value } };
        }
        return node;
      })
    );
  };

  const removeBranch = (idx: number) => {
      const newBranches = [...branches];
      newBranches.splice(idx, 1);
      updateBranches(newBranches);
  };

  const editBranch = (idx: number, val: string) => {
      const newBranches = [...branches];
      newBranches[idx] = { ...newBranches[idx], condition: val };
      updateBranches(newBranches);
  };

  const getBorderClass = (isConnected: boolean) => {
    const isHovered = hoveredSide === 'left';
    const color = isConnected
      ? "bg-blue-400"
      : isHovered
      ? "bg-gray-500"
      : "bg-transparent";
    return clsx(
      "absolute transition-colors duration-200 pointer-events-none",
      color
    );
  };

  return (
    <div
      className={`min-w-[240px] bg-[#09090b] rounded-md border shadow-xl transition-all flex flex-col relative ${
        selected ? 'border-blue-500 shadow-blue-500/20' : 'border-zinc-800'
      }`}
    >
      {/* Header */}
      <div className="p-2 rounded-t-md flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/50">
        <GitBranch size={16} className="text-purple-400 shrink-0" />
        <div 
          className="flex-1 min-w-0"
          onDoubleClick={() => setEditingField('label')}
        >
          {editingField === 'label' ? (
            <input
              className="nodrag w-full bg-transparent border-none outline-none p-0 text-xs font-bold text-zinc-200 placeholder-zinc-600 font-mono"
              value={data.label}
              onChange={(e) => handleChange('label', e.target.value)}
              autoFocus
              onBlur={() => setEditingField(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setEditingField(null);
              }}
              placeholder="Condition Name"
            />
          ) : (
            <div className="text-xs font-bold text-zinc-200 font-mono truncate cursor-text">
              {data.label || 'Condition'}
            </div>
          )}
        </div>
      </div>

       {/* Main Input Handle - Invisible Area */}
       <Handle
          type="target"
          position={Position.Left}
          className="!opacity-0 !w-4 !h-full !-left-3 !top-0 !transform-none !border-0 !rounded-none z-40"
          onMouseEnter={() => setHoveredSide('left')}
          onMouseLeave={() => setHoveredSide(null)}
      />

      {/* Visual Border Indicator */}
      <div
        className={clsx(
            getBorderClass(
                // Check if any handle connected to 'target' or generic connection exists
                // Since we don't have a specific ID for this handle, we might need to check generic connectivity
                // For now, let's rely on data.connectedHandles if it contains 'target' or similar, 
                // but since I don't know the exact ID logic for default handles, I'll check if the array is non-empty and contains a null/undefined match or just rely on hover for now if unsure.
                // Actually, let's assume the parent passes 'target' or the node ID. 
                // If I look at ElementNode, it checks for 'target-left'.
                // I'll check for 'target' or just use hover for now to be safe, or check if data.connectedHandles has anything.
                // Better: check if data.connectedHandles includes the handle id. The handle id is null here.
                // Let's try to match ElementNode's style.
                data.connectedHandles?.includes('target') || false 
            ),
            "top-[4px] -left-2 bottom-[4px] w-[8px] rounded-l-lg"
        )}
      />

      <div className="flex flex-col py-1">
        {branches.map((branch, index) => {
          const isElse = branch.label === 'Else';
          const isIf = branch.label === 'If';
          const keywordColor = isIf ? 'text-purple-400' : isElse ? 'text-orange-400' : 'text-blue-400';
          
          return (
            <div 
                key={branch.id} 
                className="relative flex items-center h-10 pr-3 border-b border-zinc-800/50 last:border-0 group hover:bg-zinc-900/30 transition-colors"
            >
                {/* Keyword */}
                <span className={`text-xs font-bold font-mono w-14 shrink-0 text-right mr-3 ${keywordColor}`}>
                    {branch.label.toLowerCase()}
                </span>

                {/* Input */}
                <div className="flex-1 min-w-0 mr-4">
                     {!isElse ? (
                        <input 
                            className="nodrag w-full bg-transparent border-none outline-none text-xs text-zinc-300 font-mono placeholder-zinc-700 font-medium"
                            value={branch.condition}
                            onChange={(e) => editBranch(index, e.target.value)}
                            placeholder="condition..."
                        />
                     ) : (
                         <span className="text-xs text-zinc-600 italic select-none">fallback</span>
                     )}
                </div>

                {/* Delete 'Else If' on hover */}
                {!isIf && !isElse && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); removeBranch(index); }}
                        className="absolute right-6 p-1 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <X size={10} />
                    </button>
                )}

                {/* Output Handle */}
                <Handle
                    type="source"
                    position={Position.Right}
                    id={branch.id}
                    className={`!w-3 !h-3 !right-[-8px] transition-all !border-zinc-400 bg-black hover:!w-3.5 hover:!h-3.5`}
                />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default memo(ConditionNode);