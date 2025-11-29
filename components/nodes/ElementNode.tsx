import React, { memo, useState, useRef, useEffect, useCallback } from "react";
import { Handle, Position, NodeProps, useReactFlow, useStore, NodeResizeControl } from "reactflow";
import {
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { NodeData, Variable } from "../../types";
import clsx from "clsx";
import { DatePicker } from "@/components/DatePicker";
import { RichTextEditor } from "../RichTextEditor";


const ElementNode = ({ id, data, selected }: NodeProps<NodeData>) => {
  const { setNodes } = useReactFlow();
  const connectionNodeId = useStore((state) => state.connectionNodeId);
  const isTarget = connectionNodeId && connectionNodeId !== id;

  const [editingField, setEditingField] = useState<"label" | "content" | null>(
    null
  );
  const primaryColor = data.color || "#f97316";

  const [hoveredSide, setHoveredSide] = useState<
    "top" | "right" | "bottom" | "left" | null
  >(null);

  const getBorderClass = (
    side: "top" | "right" | "bottom" | "left",
    isConnected: boolean
  ) => {
    const isHovered = hoveredSide === side;
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

  const borderPositions = {
    top: "-top-[8px] left-[4px] right-[4px] h-[8px] rounded-t-lg",
    right: "top-[4px] -right-2 bottom-[4px] w-[8px] rounded-r-lg",
    bottom: "-bottom-[8px] left-[4px] right-[4px] h-[8px] rounded-b-lg",
    left: "top-[4px] -left-2 bottom-[4px] w-[8px] rounded-l-lg"
  };
  const handleChange = (field: string, value: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: { ...node.data, [field]: value }
          };
        }
        return node;
      })
    );
  };

  return (
    <>
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
            minHeight={150}
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
    <div
      className="w-full h-full min-w-[250px] min-h-[150px] bg-zinc-800 rounded-md transition-all flex flex-col relative"
    >
      {/* Border Overlay */}
      <div
        className={clsx(
            "absolute inset-0 rounded-md pointer-events-none transition-colors z-10",
            selected ? "" : "border-transparent",
            isTarget ? "hover:!border-blue-500" : ""
        )}
        // style={{
        //     borderColor: selected ? '#f97316' : undefined,
        // }}
      />
      {/* Global Target Handle - Covers entire node */}
      <Handle
        type="target"
        position={Position.Left}
        id="target"
        className="!w-full !h-full !absolute !inset-0 !transform-none !border-0 !rounded-md z-[100] !opacity-0"
        style={{ 
            borderRadius: "inherit",
            pointerEvents: isTarget ? 'all' : 'none'
        }}
      />
      <div
        className="p-2 rounded-t-md flex items-center justify-between"
        style={{
          backgroundColor: data.color ? `${data.color}60` : "#18181b",
        }}
      >
        <div className="flex items-center gap-2 flex-1 overflow-hidden">
         
          <div
            className="flex-1 min-w-0 ml-2"
            onDoubleClick={() => setEditingField("label")}
          >
            {editingField === "label" ? (
              <input
                className="nodrag w-full bg-transparent border-none outline-none p-0 text-sm font-semibold text-white placeholder-zinc-500"
                value={data.label}
                onChange={(e) => handleChange("label", e.target.value)}
                autoFocus
                onBlur={() => setEditingField(null)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setEditingField(null);
                }}
              />
            ) : (
              <div
                className="font-semibold text-sm text-zinc-200 truncate cursor-text"
                title="Double click to edit"
              >
                {data.label}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 ml-2">
            <DatePicker 
                date={data.date || null} 
                onChange={(date) => handleChange('date', date)} 
            />
            {data.assets && data.assets.length > 0 && (
                <ImageIcon size={14} className="text-zinc-500 shrink-0" />
            )}
        </div>
      </div>

      {/* Body */}
      <div className="p-3 bg-zinc-800/50 flex-1 relative min-h-[6rem] flex flex-col">
        <div
          className="flex-1 w-full h-full"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditingField("content");
          }}
        >
          {editingField === "content" ? (
            <RichTextEditor
              initialValue={data.content || ""}
              onChange={(val) => handleChange("content", val)}
              onBlur={() => setEditingField(null)}
              variables={data.variables}
            />
          ) : (
            <div
              className="text-xs text-zinc-300 whitespace-pre-wrap cursor-text markdown-content h-full"
              dangerouslySetInnerHTML={{
                __html:
                  data.content ||
                  '<span class="italic opacity-30 select-none">Double click to add content...</span>'
              }}
            />
          )}
        </div>
      </div>
      {/* Source Handles - Centered and smaller for dragging out */}
      <Handle
        type="source"
        position={Position.Top}
        id="source-top"
        className="!opacity-0 !w-5/6 !h-3 !left-1/2 !-translate-x-1/2 !-top-3 !border-0 !rounded-none z-50 cursor-crosshair"
        onMouseEnter={() => setHoveredSide("top")}
        onMouseLeave={() => setHoveredSide(null)}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className="!opacity-0 !w-3 !h-full !-right-3 !top-1/2 !-translate-y-1/2 !border-0 !rounded-none z-50 cursor-crosshair"
        onMouseEnter={() => setHoveredSide("right")}
        onMouseLeave={() => setHoveredSide(null)}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        className="!opacity-0 !w-full !h-3 !left-1/2 !-translate-x-1/2 !-bottom-3 !border-0 !rounded-none z-50 cursor-crosshair"
        onMouseEnter={() => setHoveredSide("bottom")}
        onMouseLeave={() => setHoveredSide(null)}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="source-left"
        className="!opacity-0 !w-3 !h-full !-left-3 !top-1/2 !-translate-y-1/2 !border-0 !rounded-none z-50 cursor-crosshair"
        onMouseEnter={() => setHoveredSide("left")}
        onMouseLeave={() => setHoveredSide(null)}
      />

      {/* Visual Border Indicators */}
      <div
        className={clsx(
          getBorderClass(
            "top",
            data.connectedHandles?.includes("target-top") ||
              data.connectedHandles?.includes("source-top") ||
              false
          ),
          borderPositions.top
        )}
      />
      <div
        className={clsx(
          getBorderClass(
            "right",
            data.connectedHandles?.includes("target-right") ||
              data.connectedHandles?.includes("source-right") ||
              false
          ),
          borderPositions.right
        )}
      />
      <div
        className={clsx(
          getBorderClass(
            "bottom",
            data.connectedHandles?.includes("target-bottom") ||
              data.connectedHandles?.includes("source-bottom") ||
              false
          ),
          borderPositions.bottom
        )}
      />
      <div
        className={clsx(
          getBorderClass(
            "left",
            data.connectedHandles?.includes("target-left") ||
              data.connectedHandles?.includes("source-left") ||
              false
          ),
          borderPositions.left
        )}
      />

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
    </>
  );
};

export default memo(ElementNode);
