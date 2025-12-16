import React, { memo, useState } from 'react';
import { NodeProps, NodeResizeControl, useReactFlow } from 'reactflow';
import { NodeData } from '../../types';
import JumpTargetBadge from './JumpTargetBadge';

const SectionNode = ({ id, data, selected }: NodeProps<NodeData>) => {
  const { setNodes } = useReactFlow();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const primaryColor = data.color || '#71717a'; // Default zinc-500

  // Ensure SectionNode is always behind other nodes
  React.useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id && node.zIndex !== -1) {
          return { ...node, zIndex: -1 };
        }
        return node;
      })
    );
  }, [id, setNodes]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: { ...node.data, label: e.target.value },
          };
        }
        return node;
      })
    );
  };

  return (
    <>
      <div
        className={`group relative flex flex-col rounded-lg border-2 transition-all`}
        style={{
          minWidth: 400,
          minHeight: 300,
          height: '100%',
          width: '100%',
          borderColor: selected ? primaryColor : `${primaryColor}80`, // 50% opacity when not selected
          backgroundColor: `${primaryColor}10`, // 10% opacity background
          boxShadow: selected ? `0 0 20px ${primaryColor}20` : 'none'
        }}
      >
        <JumpTargetBadge nodeId={id} />
        {/* Title - Outside Top Left */}
        <div className="absolute -top-8 left-0 h-6 flex items-center">
            {isEditingTitle ? (
                <input
                    className="nodrag bg-transparent border-none outline-none text-lg font-bold text-zinc-200 w-64"
                    value={data.label}
                    onChange={handleTitleChange}
                    onBlur={() => setIsEditingTitle(false)}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                />
            ) : (
                <span 
                    className="text-lg font-bold text-zinc-200/80 hover:text-zinc-100 truncate cursor-text transition-colors"
                    onDoubleClick={() => setIsEditingTitle(true)}
                    style={{ color: primaryColor }}
                >
                    {data.label || 'Untitled Section'}
                </span>
            )}
        </div>

        {/* Content Area (Drop Zone Visual) */}
        <div className="flex-1 w-full h-full p-4 relative">
            {/* Optional: Subtle grid or pattern inside */}
        </div>
      </div>
      {selected && (
        <NodeResizeControl 
            style={{ 
                background: 'transparent', 
                border: 'none',
                position: 'absolute',
                bottom: 0,
                right: 0,
            }} 
            minWidth={400} 
            minHeight={300}
        >
            <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-zinc-500"
            >
                <path d="M11 1L1 11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                <path d="M11 5L5 11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                <path d="M11 9L9 11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
        </NodeResizeControl>
      )}
    </>
  );
};

export default memo(SectionNode);
