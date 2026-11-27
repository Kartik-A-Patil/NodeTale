import { memo, useMemo, useCallback } from "react";
import { Handle, Position, NodeProps, useStore, ReactFlowState } from "reactflow";
import { ConditionNodeData, Branch, Variable } from "../../models/story";
import { AlertCircle, X } from "lucide-react";
import { nodePropsEqual } from "./nodePropsEqual";
import { useEditor } from "../../editor/EditorContext";
import { DEFAULT_BRANCHES } from "../../core/branch";
import { NodeFrame, accentStyle, nodeIconButton } from "./nodeChrome";

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
    if (!value) return <span className="text-nt-ink-3/70">{placeholder}</span>;

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
          <span key={i} className="text-nt-success">
            {token}
          </span>
        );
      }

      // Number
      if (/^\d+(\.\d+)?$/.test(token)) {
        return (
          <span key={i} className="text-nt-accent">
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

        let color: string;
        if (isKeyword) color = "text-purple-300";
        else if (isVar) color = "text-nt-focus";
        else color = "text-nt-danger underline decoration-wavy decoration-nt-danger/50"; // Unknown variable

        return (
          <span key={i} className={color}>
            {token}
          </span>
        );
      }

      // Operators/Other
      return (
        <span key={i} className="text-nt-ink-3">
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
        className="nodrag absolute inset-0 z-10 h-full w-full border-none bg-transparent px-1 font-mono text-xs text-transparent caret-nt-accent placeholder-transparent outline-none"
        placeholder={placeholder}
        spellCheck={false}
        autoFocus={autoFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
    </div>
  );
};

// Flags conditions that reference identifiers that aren't project variables.
const validateCondition = (condition: string, variables: Variable[]) => {
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

const ConditionNode = ({ id, data, selected }: NodeProps<ConditionNodeData>) => {
  const { variables, updateNodeData } = useEditor();
  // Only this node's connected branch handles matter; subscribing to the whole
  // edge list re-rendered every condition node on any edge change.
  const connectedHandles = useStore(
    useCallback(
      (state: ReactFlowState) =>
        state.edges.filter((e) => e.source === id).map((e) => e.sourceHandle).join('\u0000'),
      [id]
    )
  );

  const branches = data.branches || DEFAULT_BRANCHES;

  const hasError = useMemo(() => {
    return branches.some(
      (b) => b.label !== "Else" && !validateCondition(b.condition, variables)
    );
  }, [branches, variables]);

  const updateBranches = (newBranches: Branch[], mergeKey?: string) => {
    updateNodeData(id, { branches: newBranches }, mergeKey);
  };

  const removeBranch = (idx: number) => {
    const newBranches = [...branches];
    newBranches.splice(idx, 1);
    updateBranches(newBranches);
  };

  const editBranch = (idx: number, val: string) => {
    const newBranches = [...branches];
    newBranches[idx] = { ...newBranches[idx], condition: val };
    // Typing a condition undoes as one step.
    updateBranches(newBranches, `${id}:branch:${newBranches[idx].id}`);
  };

  return (
    <NodeFrame id={id} selected={selected} color={data.color} className="w-fit min-w-[180px]">
      {/* Colour strip: the node's colour, or a quiet neutral. */}
      <div className="w-5 shrink-0 rounded-l-[inherit]" style={{ background: accentStyle(data.color) ? "var(--node-accent)" : "oklch(var(--nt-raised))" }} />

      <div className="flex flex-1 flex-col py-1">
        {branches.map((branch, index) => {
          const isElse = branch.label === "Else";
          const isConnected = connectedHandles.split("\u0000").includes(branch.id);
          return (
            <div key={branch.id} className="group relative flex h-12 items-center border-b border-nt-line/60 pr-3 last:border-0">
              <span className="mr-3 shrink-0 pl-4 font-mono text-sm font-bold text-nt-ink">{branch.label.toLowerCase()}</span>
              <div className="mr-2 h-full min-w-[180px] flex-1">
                {isElse ? (
                  <span className="flex h-full select-none items-center text-xs italic text-nt-ink-3">fallback</span>
                ) : (
                  <ConditionInput
                    value={branch.condition}
                    onChange={(e: any) => editBranch(index, e.target.value)}
                    variables={variables}
                    placeholder="Enter condition here..."
                  />
                )}
              </div>
              {branch.label === "Else If" && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeBranch(index); }}
                  className={`${nodeIconButton} absolute right-2 opacity-0 focus-visible:opacity-100 group-hover:opacity-100`}
                  aria-label="Remove this case"
                  title="Remove this case"
                >
                  <X size={12} />
                </button>
              )}
              <Handle
                type="source"
                position={Position.Right}
                id={branch.id}
                // Connected cases keep a filled dot where their line starts.
                className={`!-right-[5px] !h-3 !w-3 !border-nt-line-strong transition-colors hover:!border-nt-accent ${isConnected ? "!bg-nt-line-strong" : "!bg-nt-bg"}`}
              />
            </div>
          );
        })}
      </div>

      {hasError && (
        <span className="absolute -bottom-2 -right-2 z-50 rounded-full bg-nt-danger p-0.5 text-nt-bg shadow-lg" title="A condition uses an unknown variable">
          <AlertCircle size={12} />
        </span>
      )}
    </NodeFrame>
  );
};

export default memo(ConditionNode, nodePropsEqual);
