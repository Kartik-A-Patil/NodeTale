import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Box } from 'lucide-react';
import { NodeData } from '../../types';

const ComponentNode = ({ data, selected }: NodeProps<NodeData>) => {
  return (
    <div
      className={`w-48 bg-zinc-800 border-2 rounded-md shadow-lg transition-all group ${
        selected ? 'border-purple-500 shadow-purple-500/20' : 'border-zinc-600 hover:border-zinc-500'
      }`}
    >
      <div className="bg-zinc-900/50 p-2 flex items-center gap-2 border-b border-zinc-700/50">
        <Box size={14} className="text-purple-400" />
        <span className="font-semibold text-xs text-zinc-200 truncate">{data.label}</span>
      </div>
      <div className="p-2 text-[10px] text-zinc-500 flex justify-between items-center">
          <span>Component</span>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-purple-400">Dbl Click to Edit</span>
      </div>

      <Handle type="target" position={Position.Left} className="!bg-purple-400 !w-3 !h-3 !border-zinc-900" />
      <Handle type="source" position={Position.Right} className="!bg-purple-400 !w-3 !h-3 !border-zinc-900" />
    </div>
  );
};

export default memo(ComponentNode);