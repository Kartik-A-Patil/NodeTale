import { memo, useState, useMemo } from "react";
import { Handle, Position, NodeProps, useReactFlow, useStore } from "reactflow";
import { NodeData, Branch, Variable } from "../../types";
import { X, AlertCircle } from "lucide-react";
import clsx from "clsx";

const ConditionInput = ({
  value,
  onChange,
  variables,
  placeholder,
  autoFocus,
  onBlur,
  onKeyDown
}: any) => {
  const renderHighlight = () => {
    if (!value) return <span className="text-zinc-600">{placeholder}</span>;

    // Regex to match:
    // 1. String literals ("..." or '...')
    // 2. Numbers
    // 3. Identifiers (variables/keywords)
    // 4. Operators/Punctuation
    const regex =
      /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b\d+(?:\.\d+)?\b|[a-zA-Z_$][a-zA-Z0-9_$]*|[^a-zA-Z0-9_$"' \t\n\r]+)/g;

    const tokens = value.split(regex).filter((t: string) => t);

    return tokens.map((token: string, i: number) => {
      // String literal
      if (/^["'].*["']$/.test(token)) {
        return (
          <span key={i} className="text-green-400">
            {token}
          </span>
        );
      }

      // Number
      if (/^\d+(\.\d+)?$/.test(token)) {
        return (
          <span key={i} className="text-orange-400">
            {token}
          </span>
        );
      }

      // Identifier
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(token)) {
        const isKeyword = ["true", "false", "null", "undefined"].includes(
          token
        );
        const isVar = variables.some((v: Variable) => v.name === token);

        let color = "text-zinc-300";
        if (isKeyword) color = "text-purple-400";
        else if (isVar) color = "text-blue-400";
        else
          color =
            "text-red-400 underline decoration-wavy decoration-red-400/50"; // Error for unknown

        return (
          <span key={i} className={color}>
            {token}
          </span>
        );
      }

      // Operators/Other
      return (
        <span key={i} className="text-zinc-400">
          {token}
        </span>
      );
    });
  };

  return (
    <div className="relative h-full flex items-center group min-w-[100px]">
      {/* Ghost element for width */}
      <div className="opacity-0 whitespace-pre font-mono text-xs pointer-events-none px-1 h-0 overflow-hidden">
        {value || placeholder}
      </div>

      {/* Highlighter */}
      <div className="absolute inset-0 pointer-events-none whitespace-pre font-mono text-xs flex items-center overflow-hidden px-1">
        {renderHighlight()}
      </div>

      {/* Input */}
      <input
        value={value}
        onChange={onChange}
        maxLength={100}
        className="absolute inset-0 w-full h-full bg-transparent border-none outline-none text-xs font-mono text-transparent caret-white z-10 placeholder-transparent px-1"
        placeholder={placeholder}
        spellCheck={false}
        autoFocus={autoFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
    </div>
  );
};

const ConditionNode = ({ id, data, selected }: NodeProps<NodeData>) => {
  const { setNodes } = useReactFlow();
  const connectionNodeId = useStore((state) => state.connectionNodeId);
  const edges = useStore((state) => state.edges);
  const isTarget = connectionNodeId && connectionNodeId !== id;

  const [hoveredSide, setHoveredSide] = useState<"left" | null>(null);

  const branches = data.branches || [
    { id: "true", label: "If", condition: "true" },
    { id: "false", label: "Else", condition: "" }
  ];

  const variables = data.variables || [];

  const validateCondition = (condition: string) => {
    if (!condition || condition === "true") return true;

    const regex =
      /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b\d+(?:\.\d+)?\b|[a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    const tokens = condition.match(regex) || [];

    const keywords = ["true", "false", "null", "undefined", "NaN", "Infinity"];

    for (const token of tokens) {
      // Skip strings
      if (/^["'].*["']$/.test(token)) continue;
      // Skip numbers
      if (/^\d+(\.\d+)?$/.test(token)) continue;

      // Check identifiers
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(token)) {
        if (keywords.includes(token)) continue;
        if (variables.some((v) => v.name === token)) continue;
        return false; // Unknown variable
      }
    }
    return true;
  };

  const hasError = useMemo(() => {
    return branches.some(
      (b) => b.label !== "Else" && !validateCondition(b.condition)
    );
  }, [branches, variables]);

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

  const getBorderClass = (isConnected: boolean) => {
    const isHovered = hoveredSide === "left";
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
      className={`min-w-[180px] w-fit bg-zinc-800 rounded-md transition-all flex flex-col relative `}
    >
      {/* Border Overlay */}
      <div
        className={clsx(
          "absolute inset-0 rounded-md pointer-events-none transition-colors z-10 border",
          selected ? "border-blue-500" : "border-transparent",
          isTarget ? "hover:!border-blue-500" : ""
        )}
      />

      {/* Global Target Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-full !h-full !absolute !inset-0 !transform-none !border-0 !rounded-md z-[100] !opacity-0"
        style={{
          borderRadius: "inherit",
          pointerEvents: isTarget ? "all" : "none"
        }}
      />

      {/* Visual Border Indicator */}
      <div
        className={clsx(
          getBorderClass(data.connectedHandles?.includes("target") || false),
          "top-[4px] -left-2 bottom-[4px] w-[8px] rounded-l-lg"
        )}
      />

      <div className="relative flex bg-zinc-800/60 rounded-md">
        <div
          className="w-5 rounded-l-md"
          style={{
            backgroundColor: data.color ? `${data.color}60` : "#18181b"
          }}
        />

        <div className="flex-1 flex flex-col py-1">
          {branches.map((branch, index) => {
            const isElse = branch.label === "Else";
            const isIf = branch.label === "If";

            const isConnected = edges.some(
              (edge) => edge.source === id && edge.sourceHandle === branch.id
            );
            return (
              <div
                key={branch.id}
                className="relative flex items-center h-12 pr-4 border-b border-zinc-700/50 last:border-0 group transition-colors"
              >
                {/* Keyword */}
                <span
                  className={`text-sm font-bold font-mono w-auto shrink-0 text-center mr-3 pl-4 text-white`}
                >
                  {branch.label.toLowerCase()}
                </span>

                {/* Input */}
                <div className="flex-1 min-w-[180px] mr-4 h-full">
                  {!isElse ? (
                    <ConditionInput
                      value={branch.condition}
                      onChange={(e: any) => editBranch(index, e.target.value)}
                      variables={variables}
                      placeholder="Enter condition here..."
                    />
                  ) : (
                    <span className="text-xs text-zinc-500 italic select-none flex items-center h-full">
                      fallback
                    </span>
                  )}
                </div>

                {/* Delete 'Else If' on hover */}
                {!isIf && !isElse && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBranch(index);
                    }}
                    className="absolute right-2 w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center border border-white/10 shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-slate-600 hover:scale-105"
                    aria-label="Remove branch"
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                )}

                {/* Output Handle */}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={branch.id}
                  className={`!w-3 !h-3 !right-[-5px] z-100 transition-all hover:!w-3.5 hover:!h-3.5 ${
                    isConnected ? "opacity-0" : "!border-zinc-400 bg-black "
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Error Badge */}
      {hasError && (
        <div
          className="absolute -bottom-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-lg z-50"
          title="Invalid condition"
        >
          <AlertCircle size={12} />
        </div>
      )}
    </div>
  );
};

export default memo(ConditionNode);
