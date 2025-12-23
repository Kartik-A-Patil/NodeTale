import React, {
  memo,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo
} from "react";
import {
  Handle,
  Position,
  NodeProps,
  useReactFlow,
  useStore,
  NodeResizeControl
} from "reactflow";
import {
  FileText,
  Image as ImageIcon,
  FileAudio,
  FileVideo,
  AlertCircle
} from "lucide-react";
import { NodeData, Variable, Asset } from "../../types";
import clsx from "clsx";
import { DatePicker } from "@/components/DatePicker";
import { RichTextEditor } from "../RichTextEditor";
import JumpTargetBadge from "./JumpTargetBadge";
import {
  validateCodeSyntax,
  validateVariableReferences,
  validateTypeAssignments
} from "../../services/logicService";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";

const sanitizeContent = (html: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || "", "text/html");

  doc.querySelectorAll("script, style").forEach((el) => el.remove());
  doc.body.querySelectorAll("*").forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.toLowerCase().startsWith("on")) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return doc.body.innerHTML;
};

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
  const contentDisplayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentDisplayRef.current || editingField === "content") return;

    const target = contentDisplayRef.current;

    if (!data.content) {
      target.innerHTML = "";
      return;
    }

    const sanitized = sanitizeContent(data.content);
    target.innerHTML = sanitized;
    Prism.highlightAllUnder(target);
  }, [data.content, editingField]);

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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const json = e.dataTransfer.getData("application/json");
    if (!json) return;

    try {
      const { type, id: assetId } = JSON.parse(json);
      if (type === "asset") {
        const currentAssets = data.assets || [];
        const projectAssets = (data.projectAssets as Asset[]) || [];
        const nodeAssets = currentAssets
          .map((id) => projectAssets.find((a) => a.id === id))
          .filter(Boolean);

        // Check if asset already exists
        if (currentAssets.includes(assetId)) return;

        // Find the asset
        const asset = projectAssets.find((a) => a.id === assetId);
        if (!asset) return;

        // Check if adding a visual asset and there's already one
        const isVisual = asset.type === "image" || asset.type === "video";
        const hasVisual = nodeAssets.some(
          (a) => a.type === "image" || a.type === "video"
        );
        if (isVisual && hasVisual) return;

        // Update assets AND reset height to auto to fit new content
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === id) {
              return {
                ...n,
                style: { ...n.style, height: undefined },
                data: { ...n.data, assets: [...currentAssets, assetId] }
              };
            }
            return n;
          })
        );
      }
    } catch (err) {
      console.error("Failed to parse drop data", err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  // Only store asset IDs in node data
  const projectAssets = (data.projectAssets as Asset[]) || [];
  const nodeAssetIds = data.assets || [];
  const nodeAssets = nodeAssetIds
    .map((assetId) => projectAssets.find((a) => a.id === assetId))
    .filter(Boolean) as Asset[];
  const visualAssets = nodeAssets.filter(
    (a) => a.type === "image" || a.type === "video"
  );
  const audioAssets = nodeAssets.filter((a) => a.type === "audio");

  const hasError = useMemo(() => {
    // Only check for code syntax errors and type mismatches in <pre> blocks
    // Don't validate variable references in normal text (they're fine as {{var}})
    const parser = new DOMParser();
    try {
      const doc = parser.parseFromString(data.content || "", "text/html");
      const preBlocks = doc.querySelectorAll("pre");
      for (let block of preBlocks) {
        // Use textContent to get clean text without HTML tags
        const codeText = block.textContent || block.innerText || "";

        // Check syntax errors
        const syntaxResult = validateCodeSyntax(codeText);
        if (!syntaxResult.valid) {
          console.log("Syntax error:", syntaxResult.errors);
          return true;
        }

        // Check type assignments
        const typeResult = validateTypeAssignments(
          codeText,
          data.variables || []
        );
        if (!typeResult.valid) {
          console.log(
            "Type error:",
            typeResult.errors,
            "Variables:",
            data.variables
          );
          return true;
        }
      }
    } catch (err) {
      // Parser error - not critical for display
      console.error("Parser error:", err);
    }

    return false;
  }, [data.content, data.variables]);

  return (
    <>
      {selected && (
        <NodeResizeControl
          style={{
            background: "transparent",
            border: "none",
            position: "absolute",
            bottom: 0,
            right: 0
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
            <path
              d="M11 1L1 11"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
            <path
              d="M11 5L5 11"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
            <path
              d="M11 9L9 11"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
          </svg>
        </NodeResizeControl>
      )}
      <div className="w-full h-full min-w-[250px] min-h-[150px] bg-zinc-800 rounded-md transition-all flex flex-col relative">
        {/* Border Overlay */}
        <div
          className={clsx(
            "absolute inset-0 rounded-md pointer-events-none transition-colors z-10 border",
            selected ? "border-blue-500" : "border-transparent",
            isTarget ? "hover:!border-blue-500" : ""
          )}
        />
        {/* Global Target Handle - Covers entire node */}
        <Handle
          type="target"
          position={Position.Left}
          id="target"
          className="!w-full !h-full !absolute !inset-0 !transform-none !border-0 !rounded-md z-[100] !opacity-0"
          style={{
            borderRadius: "inherit",
            pointerEvents: isTarget ? "all" : "none"
          }}
        />
        <div
          className="p-2 pr-1 rounded-t-md flex items-center justify-between relative"
          style={{
            backgroundColor: data.color ? `${data.color}60` : "#18181b"
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
          <JumpTargetBadge nodeId={id} />
          <DatePicker
            date={data.date || null}
            onChange={(date) => handleChange("date", date)}
            nodeId={id}
          />
        </div>

        {/* Body */}
        <div
          className="p-3 bg-zinc-800/50 flex-1 relative min-h-[6rem] flex flex-col overflow-hidden"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {/* Visual Assets (Images/Videos) */}
          {visualAssets.length > 0 && (
            <div className="mb-2 flex flex-col gap-2">
              {visualAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="relative rounded overflow-hidden bg-black/20"
                >
                  {asset.type === "image" ? (
                    <img
                      src={asset.url}
                      alt={asset.name}
                      className="w-full h-auto max-h-48 object-contain"
                    />
                  ) : (
                    <div className="relative">
                      <video
                        src={asset.url}
                        className="w-full h-auto max-h-48 pointer-events-none"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <FileVideo size={24} className="text-white" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div
            className="flex-1 w-full h-full overflow-auto"
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
              <div className="relative w-full">
                {!data.content && (
                  <span className="absolute inset-0 text-xs text-zinc-500 italic opacity-60 select-none">
                    Double click to add content...
                  </span>
                )}
                <div
                  ref={contentDisplayRef}
                  className="text-xs text-zinc-300 whitespace-pre-wrap cursor-text markdown-content"
                />
              </div>
            )}
          </div>

          {/* Audio Assets */}
          {audioAssets.length > 0 && (
            <div className="mt-2 pt-2 border-t border-zinc-700/50 flex flex-col gap-1">
              {audioAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900/50 p-1.5 rounded"
                >
                  <FileAudio size={12} className="text-purple-400 shrink-0" />
                  <span className="truncate">{asset.name}</span>
                </div>
              ))}
            </div>
          )}
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
            padding: 4px; 
            border-radius: 4px; 
            font-family: 'JetBrains Mono', monospace; 
            border: 0px solid #27272a; 
            color: #a1a1aa; 
            margin: 6px 0; 
            white-space: pre-wrap; 
            min-height: 1rem; 
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
        pre[class*="language-"]{
            box-shadow: none;
        }
      `}</style>

        {/* Error Badge */}
        {hasError && (
          <div
            className="absolute -bottom-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-lg z-50"
            title="Missing variable in content"
          >
            <AlertCircle size={12} />
          </div>
        )}
      </div>
    </>
  );
};

export default memo(ElementNode);
