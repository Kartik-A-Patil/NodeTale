import React, {
  memo,
  useState,
  useMemo,
  useDeferredValue
} from "react";
import { Handle, Position, NodeProps, useReactFlow } from "reactflow";
import { Clapperboard, ImagePlus, Maximize2 } from "lucide-react";
import { ElementNodeData, Asset } from "../../models/story";
import clsx from "clsx";
import { DatePicker } from "@/components/DatePicker";
import { LazyRichTextEditor } from "../editor/LazyRichTextEditor";
import { EditStart, StoryText } from "../editor/StoryText";
import JumpTargetBadge from "./JumpTargetBadge";
import { NodeAudioList, NodeVisualAsset } from "./NodeAssets";
import { ExpandedEditor } from "../editor/ExpandedEditor";
import { draggedAssetId, hasDraggedJson, isVisualAsset, withAttachedAsset } from "../../utils/nodeAssets";
import { AudioSettingsModal } from "../modals/AudioSettingsModal";
import {
  validateCodeSyntax,
  validateTypeAssignments
} from "../../services/logicService";
import { extractScriptCode } from "../../utils/html";
import { nodePropsEqual } from "./nodePropsEqual";
import { useEditor } from "../../editor/EditorContext";
import { useNodeStatus } from "../../editor/nodeStatusStore";
import { EditableTitle, NodeFrame, NodeHeader, NodeResizeGrip, StatusBadge, nodeIconButton, useNodeEditRequest } from "./nodeChrome";

const SceneNode = ({ id, data, selected }: NodeProps<ElementNodeData>) => {
  const { getNode } = useReactFlow();
  const { variables, assets: projectAssets, updateNodeData, updateNode } = useEditor();
  const status = useNodeStatus(id);
  const [editingField, setEditingField] = useState<"content" | null>(null);
  useNodeEditRequest(id, "content", () => { setEditStart(undefined); setEditingField("content"); });
  const [selectedAudioForConfig, setSelectedAudioForConfig] = useState<Asset | null>(
    null
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [editStart, setEditStart] = useState<EditStart>();
  const [isAssetOver, setIsAssetOver] = useState(false);

  const [hoveredSide, setHoveredSide] = useState<
    "top" | "right" | "bottom" | "left" | null
  >(null);
  const getBorderClass = (side: "top" | "right" | "bottom" | "left") => {
    const color = hoveredSide === side ? "bg-nt-line-strong" : "bg-transparent";
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
  // Typing in the label/content merges into one undo step per burst.
  const handleChange = (field: "label" | "content" | "date", value: unknown) => {
    updateNodeData(id, { [field]: value }, field === "date" ? undefined : `${id}:${field}`);
  };

  const nodeAssets = (data.assets || [])
    .map((assetId) => projectAssets.find((a) => a.id === assetId))
    .filter((a): a is Asset => a !== undefined);
  const visualAsset = nodeAssets.find(isVisualAsset);
  const audioAssets = nodeAssets.filter((a) => a.type === "audio");

  const attachAsset = (assetId: string) => {
    const asset = projectAssets.find((a) => a.id === assetId);
    const current = data.assets || [];
    if (!asset) return;
    const next = withAttachedAsset(current, asset, projectAssets);
    if (next === current) return;
    // Height back to auto so the node grows to fit the new media.
    updateNode(id, {
      style: { ...getNode(id)?.style, height: undefined },
      data: { ...data, assets: next }
    });
  };

  const detachAsset = (assetId: string) => {
    updateNodeData(id, { assets: (data.assets || []).filter((a) => a !== assetId) });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAssetOver(false);
    const assetId = draggedAssetId(e.dataTransfer);
    if (assetId) attachAsset(assetId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!hasDraggedJson(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsAssetOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsAssetOver(false);
  };

  // Deferred: validation re-parses the content and runs the code checker, so
  // let React do it after the edit has painted instead of blocking it.
  const deferredContent = useDeferredValue(data.content);
  const hasError = useMemo(() => {
    // Only check for code syntax errors and type mismatches in <pre> blocks
    // Don't validate variable references in normal text (they're fine as {{var}})
    const code = extractScriptCode(deferredContent);
    return !!code && (!validateCodeSyntax(code).valid || !validateTypeAssignments(code, variables).valid);
  }, [deferredContent, variables]);

  return (
    <>
      {selected && <NodeResizeGrip minWidth={220} minHeight={72} />}
      <NodeFrame id={id} selected={selected} color={data.color} className="group/node h-full w-full min-w-[220px] flex-col">
        <NodeHeader
          icon={Clapperboard}
          title={<EditableTitle nodeId={id} value={data.label} placeholder="Untitled scene" onChange={(label) => handleChange("label", label)} />}
          status={
            <>
              {status && <StatusBadge status={status} />}
              {hasError && <StatusBadge status="error" hint="A logic block has a syntax error or a type mismatch" />}
            </>
          }
        >
          <JumpTargetBadge nodeId={id} />
          {/* Opening it blurs the inline editor first, which saves pending text. */}
          {(selected || editingField === "content") && (
            <button type="button" onClick={() => setIsExpanded(true)} title="Open in a larger editor" aria-label="Open in a larger editor" className={nodeIconButton}>
              <Maximize2 size={14} />
            </button>
          )}
          {/* Only in the way until it's used: shown when set, or on hover/selection. */}
          <span className={clsx("flex", !data.date && !selected && "opacity-0 transition-opacity group-hover/node:opacity-100 focus-within:opacity-100")}>
            <DatePicker date={data.date || null} onChange={(date) => handleChange("date", date)} nodeId={id} />
          </span>
        </NodeHeader>

        {/* Body */}
        <div
          className={clsx(
            "relative flex min-h-[3rem] flex-1 flex-col rounded-b-[inherit] px-2.5 pb-2.5 pt-2 transition-shadow",
            isAssetOver && "ring-2 ring-inset ring-nt-accent/70"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {isAssetOver && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-b-[inherit] bg-nt-bg/70 text-xs font-medium text-nt-ink">
              <ImagePlus size={14} className="mr-1.5 text-nt-accent" /> Drop to attach
            </div>
          )}

          {visualAsset && <NodeVisualAsset asset={visualAsset} onDetach={() => detachAsset(visualAsset.id)} />}

          <div className="relative min-h-0 w-full flex-1 text-xs text-nt-ink-2">
            {editingField === "content" ? (
              <LazyRichTextEditor
                initialValue={data.content || ""}
                startAt={editStart}
                onChange={(val) => handleChange("content", val)}
                onBlur={() => setEditingField(null)}
                onAssetDrop={attachAsset}
              />
            ) : (
              <StoryText
                html={data.content || ""}
                placeholder="Double click to add content…"
                onStartEdit={(start) => {
                  setEditStart(start);
                  setEditingField("content");
                }}
              />
            )}
          </div>

          {audioAssets.length > 0 && (
            <NodeAudioList
              assets={audioAssets}
              settings={data.audioSettings}
              onConfigure={setSelectedAudioForConfig}
              onDetach={(asset) => detachAsset(asset.id)}
            />
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

        {/* Hover indicator for the source handle under the cursor */}
        {(["top", "right", "bottom", "left"] as const).map((side) => (
          <div key={side} className={clsx(getBorderClass(side), borderPositions[side])} />
        ))}

      </NodeFrame>

      {isExpanded && (
        <ExpandedEditor
          title={data.label}
          initialValue={data.content || ""}
          onChange={(val) => handleChange("content", val)}
          onClose={() => setIsExpanded(false)}
        />
      )}

      {selectedAudioForConfig && (
        <AudioSettingsModal
          asset={selectedAudioForConfig}
          settings={data.audioSettings?.[selectedAudioForConfig.id] || { loop: false, delay: 0 }}
          onSave={(settings) => {
            updateNodeData(id, {
              audioSettings: { ...(data.audioSettings || {}), [selectedAudioForConfig.id]: settings }
            });
          }}
          onClose={() => setSelectedAudioForConfig(null)}
        />
      )}
    </>
  );
};

export default memo(SceneNode, nodePropsEqual);
