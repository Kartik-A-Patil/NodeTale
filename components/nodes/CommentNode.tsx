import React, { memo } from 'react';
import { NodeProps, useReactFlow, NodeResizer } from 'reactflow';
import { NodeData } from '../../types';

const CommentNode = ({ id, data, selected }: NodeProps<NodeData>) => {
  const { setNodes } = useReactFlow();

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: { ...node.data, text: newVal },
          };
        }
        return node;
      })
    );
  };

  // Default to dark gray (#27272a) if no color is set
  const baseColor = data.color || '#27272a';

  return (
    <div
      className={`h-full w-full min-w-[150px] min-h-[100px] rounded-lg shadow-sm transition-all flex flex-col group backdrop-blur-sm ${
        selected ? 'ring-1 ring-white/50' : 'hover:shadow-md'
      }`}
      style={{
        // Append 80 for approx 50% opacity hex code
        backgroundColor: `${baseColor}80`, 
        borderColor: baseColor,
        borderWidth: '1px'
      }}
    >
      <NodeResizer 
        minWidth={150} 
        minHeight={100} 
        isVisible={selected} 
        lineClassName="border-zinc-500" 
        handleClassName="h-3 w-3 bg-zinc-600 border border-zinc-400 rounded"
      />
      
      {/* Header (Drag handle) - Solid color for clearer identification */}
      <div 
        className="h-6 w-full rounded-t-[7px] cursor-move flex items-center px-2 border-b border-white/5"
        style={{ backgroundColor: baseColor }}
      >
         <div className="w-2 h-2 rounded-full bg-white/20" />
      </div>

      <textarea
        className="nodrag w-full h-full resize-none bg-transparent border-none outline-none p-3 text-sm text-zinc-100 placeholder-zinc-400/50 font-sans leading-relaxed"
        value={data.text || ''}
        onChange={handleChange}
        placeholder="Add a comment..."
        spellCheck={false}
      />
    </div>
  );
};

export default memo(CommentNode);