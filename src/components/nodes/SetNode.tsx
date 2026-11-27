import { memo } from "react";
import type { ReactNode } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import { ChevronDown, MessageCircleQuestion, Plus, Variable as VariableIcon, X } from "lucide-react";
import { SetNodeData, ValueChange, Variable, VariableType } from "../../models/story";
import { OPS_BY_TYPE, opInfo, opsFor, valueTypeOf } from "../../core/valueChanges";
import { variableTypeInfo } from "../variableTypes";
import { createId } from "../../utils/id";
import { cn } from "../../lib/utils";
import { useEditor } from "../../editor/EditorContext";
import { useNodeStatus } from "../../editor/nodeStatusStore";
import { nodePropsEqual } from "./nodePropsEqual";
import { EditableTitle, NodeFrame, NodeHeader, StatusBadge, nodeIconButton } from "./nodeChrome";

// Quiet controls that read as part of a sentence: "gold · add · 10".
const pill = "nodrag h-7 rounded-md bg-nt-bg/60 px-1.5 text-xs text-nt-ink-2 outline-none transition-colors hover:bg-nt-raised focus-visible:bg-nt-raised focus-visible:ring-1 focus-visible:ring-nt-focus";

function PillSelect({ value, onChange, label, children, invalid }: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: ReactNode;
  invalid?: boolean;
}) {
  return (
    <span className="relative inline-flex">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={cn(pill, "cursor-pointer appearance-none pr-5", invalid && "text-nt-danger")}
      >
        {children}
      </select>
      <ChevronDown size={11} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-nt-ink-3" aria-hidden />
    </span>
  );
}

/** A value of the variable's type: number field, text field, or true/false. */
function ValueInput({ variable, value, onChange }: { variable: Variable; value: ValueChange["value"]; onChange: (value: ValueChange["value"]) => void }) {
  const type = valueTypeOf(variable);
  if (type === VariableType.BOOLEAN) {
    return (
      <span className="inline-flex h-7 rounded-md bg-nt-bg/60 p-0.5" role="radiogroup" aria-label={`${variable.name} value`}>
        {[true, false].map((b) => (
          <button
            key={String(b)}
            type="button"
            role="radio"
            aria-checked={value === b}
            onClick={() => onChange(b)}
            className={`nodrag rounded px-2 font-mono text-xs transition-colors ${value === b ? "bg-nt-raised text-nt-ink" : "text-nt-ink-3 hover:text-nt-ink-2"}`}
          >
            {String(b)}
          </button>
        ))}
      </span>
    );
  }
  return (
    <input
      type={type === VariableType.NUMBER ? "number" : "text"}
      value={value === undefined ? "" : String(value)}
      onChange={(e) => onChange(type === VariableType.NUMBER ? (e.target.value === "" ? undefined : Number(e.target.value)) : e.target.value)}
      placeholder={type === VariableType.NUMBER ? "0" : "text"}
      aria-label={`${variable.name} value`}
      className={cn(pill, "min-w-0 placeholder:text-nt-ink-3", type === VariableType.NUMBER ? "w-16 font-mono" : "w-28")}
    />
  );
}

function ChangeRow({ change, variables, onPatch, onRemove }: {
  change: ValueChange;
  variables: Variable[];
  onPatch: (patch: Partial<ValueChange>, mergeKey?: string) => void;
  onRemove: () => void;
}) {
  const variable = variables.find((v) => v.name === change.variable);
  const info = opInfo(variable, change.op);
  const asking = change.ask !== undefined;
  const TypeIcon = variable ? variableTypeInfo(variable.type).icon : VariableIcon;

  return (
    <div className="group flex h-7 items-center gap-1">
      <TypeIcon size={12} className="w-4 shrink-0 text-nt-ink-3" aria-hidden />

      <PillSelect
        label="Variable"
        value={variable ? variable.name : ""}
        invalid={!variable}
        onChange={(name) => {
          const next = variables.find((v) => v.name === name);
          // A different type has different operators and values: start that row over.
          onPatch({ variable: name, op: opsFor(next)[0]?.op ?? "set", value: undefined, ask: undefined });
        }}
      >
        {!variable && <option value="">{change.variable ? `${change.variable} (missing)` : "variable…"}</option>}
        {variables.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
      </PillSelect>

      {variable && (
        <PillSelect label="Action" value={change.op} onChange={(op) => onPatch({ op: op as ValueChange["op"] })}>
          {opsFor(variable).map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
        </PillSelect>
      )}

      {variable && info?.needsValue && (asking ? (
        <input
          value={change.ask}
          onChange={(e) => onPatch({ ask: e.target.value }, `ask:${change.id}`)}
          placeholder="Question for the player…"
          aria-label={`Question asking for ${variable.name}`}
          className={cn(pill, "w-52 min-w-0 bg-nt-accent/10 text-nt-accent placeholder:text-nt-accent/60 hover:bg-nt-accent/15 focus-visible:bg-nt-accent/15")}
        />
      ) : (
        <ValueInput variable={variable} value={change.value} onChange={(value) => onPatch({ value }, `value:${change.id}`)} />
      ))}

      {variable && info?.needsValue && (
        <button
          type="button"
          onClick={() => onPatch(asking ? { ask: undefined } : { ask: "", value: undefined })}
          aria-pressed={asking}
          title={asking ? "Use a fixed value instead" : "Ask the player for this value"}
          aria-label={asking ? "Use a fixed value instead" : "Ask the player for this value"}
          className={cn(nodeIconButton, asking ? "text-nt-accent hover:text-nt-accent" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100")}
        >
          <MessageCircleQuestion size={13} />
        </button>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove this change"
        title="Remove"
        className={cn(nodeIconButton, "ml-auto opacity-0 hover:text-nt-danger group-hover:opacity-100 focus-visible:opacity-100")}
      >
        <X size={12} />
      </button>
    </div>
  );
}

// Changes variables on the way through: each row is variable · action · value,
// and any value can instead be asked of the player in Play Mode.
const SetNode = ({ id, data, selected }: NodeProps<SetNodeData>) => {
  const { variables, updateNodeData } = useEditor();
  const status = useNodeStatus(id);
  const changes = data.changes ?? [];
  // Objects have no simple operators, so they aren't offered.
  const usable = variables.filter((v) => OPS_BY_TYPE[v.type]);

  const save = (next: ValueChange[], mergeKey?: string) => updateNodeData(id, { changes: next }, mergeKey && `${id}:${mergeKey}`);
  const patch = (changeId: string, p: Partial<ValueChange>, mergeKey?: string) =>
    save(changes.map((c) => (c.id === changeId ? { ...c, ...p } : c)), mergeKey);
  const add = () => {
    const first = usable[0];
    save([...changes, { id: createId("chg"), variable: first?.name ?? "", op: opsFor(first)[0]?.op ?? "set" }]);
  };

  return (
    <NodeFrame id={id} selected={selected} color={data.color} className="w-fit min-w-[260px] flex-col">
      <NodeHeader
        icon={VariableIcon}
        title={<EditableTitle nodeId={id} value={data.label} placeholder="Set values" onChange={(label) => updateNodeData(id, { label }, `${id}:label`)} />}
        status={status === "dead-end" || status === "unreachable" ? <StatusBadge status={status} /> : null}
      />
      <div className="flex flex-col gap-1 p-2">
        {changes.map((c) => (
          <ChangeRow
            key={c.id}
            change={c}
            variables={usable}
            onPatch={(p, mergeKey) => patch(c.id, p, mergeKey)}
            onRemove={() => save(changes.filter((x) => x.id !== c.id))}
          />
        ))}
        {usable.length === 0 ? (
          <p className="px-1 py-1 text-xs text-nt-ink-3">Add a variable in the Variables panel first.</p>
        ) : (
          <button
            type="button"
            onClick={add}
            className="nodrag flex h-7 items-center gap-1.5 self-start rounded-md px-1.5 text-xs text-nt-ink-3 transition-colors hover:bg-nt-raised hover:text-nt-ink"
          >
            <Plus size={12} aria-hidden /> Add a change
          </button>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="!-right-[5px] !h-3 !w-3 !border-nt-line-strong !bg-nt-bg transition-colors hover:!border-nt-accent"
      />
    </NodeFrame>
  );
};

export default memo(SetNode, nodePropsEqual);
