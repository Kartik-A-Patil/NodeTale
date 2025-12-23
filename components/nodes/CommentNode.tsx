import React, { memo, useState } from 'react';
import { NodeProps, useReactFlow, NodeResizeControl } from 'reactflow';
import { NodeData } from '../../types';
import { RichTextEditor } from '../RichTextEditor';
import JumpTargetBadge from './JumpTargetBadge';

const CommentNode = ({ id, data, selected }: NodeProps<NodeData>) => {
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);

  // Ensure CommentNode is always at the bottom (z-index -10)
  React.useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id && node.zIndex !== -10) {
          return { ...node, zIndex: -10 };
        }
        return node;
      })
    );
  }, [id, setNodes]);

  const handleChange = (val: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: { ...node.data, text: val },
          };
        }
        return node;
      })
    );
  };

  // Default to dark gray (#27272a) if no color is set
  const baseColor = data.color || '#27272a';

  return (
    <>
      <div
        className={`h-full w-full min-w-[250px] min-h-[200px] rounded-md shadow-sm transition-all flex flex-col group relative backdrop-blur-sm`}
        style={{
          // Append 80 for approx 50% opacity hex code
          backgroundColor: `${baseColor}40`, 
      
        }}
        onDoubleClick={() => setIsEditing(true)}
      >
        <JumpTargetBadge nodeId={id} />
        <div className="flex-1 relative min-h-0 p-4">
          {isEditing ? (
              <div className="nodrag h-full w-full cursor-text">
                  <RichTextEditor
                    initialValue={data.text || ''}
                    onChange={handleChange}
                    onBlur={() => setIsEditing(false)}
                  />
              </div>
          ) : (
              <div
                className="text-sm text-zinc-200 whitespace-pre-wrap markdown-content h-full overflow-y-auto"
                dangerouslySetInnerHTML={{
                  __html:
                    data.text ||
                    '<span class="italic opacity-50 select-none">Double click to add comment...</span>'
                }}
              />
          )}
        </div>

        <style>{`
          .markdown-content blockquote { 
              border-left: 3px solid #52525b; 
              padding-left: 8px; 
              font-style: italic; 
              color: #a1a1aa; 
              margin: 4px 0; 
          }
          .markdown-content pre { 
              background: #18181b; 
              padding: 8px; 
              border-radius: 4px; 
              font-family: 'JetBrains Mono', monospace; 
              border: 1px solid #27272a; 
              color: #a1a1aa; 
              margin: 6px 0; 
              white-space: pre-wrap; 
          }
          .markdown-content ul { 
              list-style-type: disc; 
              padding-left: 20px; 
              margin: 4px 0; 
          }
          /* Editor Highlight Colors */
          .markdown-content .text-blue-400 { color: #60a5fa; }
          .markdown-content .text-white { color: #ffffff; }
          .markdown-content .text-zinc-400 { color: #a1a1aa; }
          .markdown-content .text-purple-400 { color: #a78bfa; }
        `}</style>
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
            minWidth={250} 
            minHeight={200}
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

export default memo(CommentNode);
