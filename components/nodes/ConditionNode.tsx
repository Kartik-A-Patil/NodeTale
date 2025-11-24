import React, { memo } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { NodeData, Branch } from '../../types';
import { X } from 'lucide-react';

const ConditionNode = ({ id, data, selected }: NodeProps<NodeData>) => {
  const { setNodes } = useReactFlow();

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

  return (
    <div
      className={`min-w-[240px] bg-[#09090b] rounded-md overflow-hidden border shadow-xl transition-all ${
        selected ? 'border-blue-500 shadow-blue-500/20' : 'border-zinc-800'
      }`}
    >
       {/* Main Input Handle */}
       <div className="absolute left-0 top-[18px]">
         <Handle
            type="target"
            position={Position.Left}
            className="!w-3 !h-3 !bg-blue-500 !border-zinc-900 !left-[-6px]"
        />
      </div>

      <div className="flex flex-col">
        {branches.map((branch, index) => {
          const isElse = branch.label === 'Else';
          const isIf = branch.label === 'If';
          const keywordColor = isIf ? 'text-purple-400' : isElse ? 'text-orange-400' : 'text-blue-400';
          
          return (
            <div 
                key={branch.id} 
                className="relative flex items-center h-10 px-3 border-b border-zinc-800/50 last:border-0 group hover:bg-zinc-900/30 transition-colors"
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
                    className={`!w-2.5 !h-2.5 !right-[-5px] transition-all !border-zinc-900 ${isElse ? '!bg-zinc-500' : '!bg-blue-500'}`}
                />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default memo(ConditionNode);