import { memo } from "react";
import type { ReactNode } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import { ChevronDown, MessageCircleQuestion, Plus, Variable as VariableIcon, X } from "lucide-react";
import { SetNodeData, ValueChange, Variable, VariableType } from "../../models/story";
import { OPS_BY_TYPE, keysOf, opInfo, opsFor, valueTypeOf } from "../../core/valueChanges";
import { variableTypeInfo } from "../variableTypes";
import { createId } from "../../utils/id";
import { cn } from "../../lib/utils";
import { useEditor } from "../../editor/EditorContext";
import { useNodeStatus } from "../../editor/nodeStatusStore";
import { nodePropsEqual } from "./nodePropsEqual";
import { EditableTitle, NodeFrame, NodeHeader, StatusBadge } from "./nodeChrome";

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

/** The ? that turns a value into a question for the player. Sits inside the
 *  value pill, so it never takes room of its own; shown on hover, or while asking. */
function AskToggle({ asking, onToggle }: { asking: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={asking}
      title={asking ? "Use a fixed value instead" : "Ask the player for this value"}
      aria-label={asking ? "Use a fixed value instead" : "Ask the player for this value"}
      className={cn(
        "nodrag absolute right-1 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded transition-opacity",
        asking ? "text-nt-accent hover:bg-nt-accent/15" : "bg-nt-raised text-nt-ink-3 opacity-0 hover:text-nt-ink group-hover:opacity-100 focus-visible:opacity-100",
      )}
    >
      <MessageCircleQuestion size={12} />
    </button>
  );
}

/** The value slot: a field of the right type (or the player's question), with the ? inside. */
function ValueSlot({ variable, change, onPatch }: {
  variable: Variable;
  change: ValueChange;
  onPatch: (patch: Partial<ValueChange>, mergeKey?: string) => void;
}) {
  const asking = change.ask !== undefined;
  const toggle = () => onPatch(asking ? { ask: undefined } : { ask: "", value: undefined });
  const type = valueTypeOf(variable, change.key);

  if (asking) {
    return (
      <span className="relative inline-flex">
        <input
          value={change.ask}
          onChange={(e) => onPatch({ ask: e.target.value }, `ask:${change.id}`)}
          placeholder="Question for the player…"
          aria-label={`Question asking for ${variable.name}`}
          className={cn(pill, "min-w-32 max-w-72 [field-sizing:content] bg-nt-accent/10 pr-7 text-nt-accent placeholder:text-nt-accent/60 hover:bg-nt-accent/15 focus-visible:bg-nt-accent/15")}
        />
        <AskToggle asking onToggle={toggle} />
      </span>
    );
  }

  if (type === VariableType.BOOLEAN) {
    return (
      <span className="relative inline-flex h-7 rounded-md bg-nt-bg/60 p-0.5 group-hover:pr-7 group-focus-within:pr-7" role="radiogroup" aria-label={`${variable.name} value`}>
        {[true, false].map((b) => (
          <button
            key={String(b)}
            type="button"
            role="radio"
            aria-checked={change.value === b}
            onClick={() => onPatch({ value: b })}
            className={`nodrag rounded px-2 font-mono text-xs transition-colors ${change.value === b ? "bg-nt-raised text-nt-ink" : "text-nt-ink-3 hover:text-nt-ink-2"}`}
          >
            {String(b)}
          </button>
        ))}
        <AskToggle asking={false} onToggle={toggle} />
      </span>
    );
  }

  return (
    <span className="relative inline-flex">
      <input
        type={type === VariableType.NUMBER ? "number" : "text"}
        value={change.value === undefined ? "" : String(change.value)}
        onChange={(e) => onPatch({ value: type === VariableType.NUMBER ? (e.target.value === "" ? undefined : Number(e.target.value)) : e.target.value }, `value:${change.id}`)}
        placeholder={type === VariableType.NUMBER ? "0" : "text"}
        aria-label={`${variable.name} value`}
        className={cn(pill, "min-w-0 placeholder:text-nt-ink-3 group-hover:pr-7 focus-visible:pr-7", type === VariableType.NUMBER ? "w-16 font-mono" : "w-28")}
      />
      <AskToggle asking={false} onToggle={toggle} />
    </span>
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
  const TypeIcon = variable ? variableTypeInfo(variable.type).icon : VariableIcon;
  const keys = keysOf(variable);
  const needsKey = change.op === "setKey";

  return (
    <div className="group flex h-7 items-center gap-1">
      {/* The type icon doubles as the remove button on hover: no extra column. */}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove this change"
        title="Remove"
        className="nodrag relative inline-flex h-5 w-4 shrink-0 items-center justify-center text-nt-ink-3 hover:text-nt-danger focus-visible:text-nt-danger"
      >
        <TypeIcon size={12} className="transition-opacity group-hover:opacity-0 group-focus-within:opacity-0" aria-hidden />
        <X size={12} className="absolute opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" aria-hidden />
      </button>

      <PillSelect
        label="Variable"
        value={variable ? variable.name : ""}
        invalid={!variable}
        onChange={(name) => {
          const next = variables.find((v) => v.name === name);
          // A different type has different actions and values: start that row over.
          onPatch({ variable: name, op: opsFor(next)[0]?.op ?? "set", key: keysOf(next)[0], value: undefined, ask: undefined });
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

      {variable && needsKey && (keys.length ? (
        <PillSelect
          label="Key"
          value={keys.includes(change.key ?? "") ? change.key! : ""}
          invalid={!keys.includes(change.key ?? "")}
          // Keys can differ in type: the value starts over.
          onChange={(key) => onPatch({ key, value: undefined })}
        >
          {!keys.includes(change.key ?? "") && <option value="">key…</option>}
          {keys.map((k) => <option key={k} value={k}>{k}</option>)}
        </PillSelect>
      ) : (
        <span className="px-1 text-xs text-nt-ink-3">no keys yet</span>
      ))}

      {variable && info?.needsValue && (!needsKey || keys.includes(change.key ?? "")) && (
        <ValueSlot variable={variable} change={change} onPatch={onPatch} />
      )}
    </div>
  );
}

// Changes variables on the way through: each row is variable · action · value,
// and any value can instead be asked of the player in Play Mode.
const SetNode = ({ id, data, selected }: NodeProps<SetNodeData>) => {
  const { variables, updateNodeData } = useEditor();
  const status = useNodeStatus(id);
  const changes = data.changes ?? [];
  const usable = variables.filter((v) => OPS_BY_TYPE[v.type]);

  const save = (next: ValueChange[], mergeKey?: string) => updateNodeData(id, { changes: next }, mergeKey && `${id}:${mergeKey}`);
  const patch = (changeId: string, p: Partial<ValueChange>, mergeKey?: string) =>
    save(changes.map((c) => (c.id === changeId ? { ...c, ...p } : c)), mergeKey);
  const add = () => {
    const first = usable[0];
    save([...changes, { id: createId("chg"), variable: first?.name ?? "", op: opsFor(first)[0]?.op ?? "set", key: keysOf(first)[0] }]);
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
