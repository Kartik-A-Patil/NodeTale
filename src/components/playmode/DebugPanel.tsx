import React, { useState } from "react";
import { Variable, VariableType, SimulationPreset, isArrayValue, isObjectValue, matchesType } from "../../models/story";
import { formatValue } from "../../core/sim/simulate";
import { AlertTriangle, LocateFixed } from "lucide-react";
import type { PlayError } from "../../core/runtime/StoryRuntime";
import type { TraceLine } from "../../core/runtime/scriptInterpreter";

interface DebugPanelProps {
  variables: Variable[];
  /** Each variable's starting value, for "reset" when a script broke its type. */
  startValues?: Record<string, Variable["value"]>;
  errors: PlayError[];
  trace: TraceLine[];
  currentLabel: string;
  labelOf: (nodeId: string) => string;
  onSetValue: (name: string, value: unknown) => void;
  presets: SimulationPreset[];
  onRestartWith: (values: Record<string, unknown>) => void;
  onShowInEditor?: () => void;
}

const section = "border-t border-zinc-800 px-3 py-2.5";
const heading = "mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500";

// Consecutive lines from the same node, so the trace reads scene by scene.
const groupByNode = (trace: TraceLine[]) =>
  trace.reduce<{ nodeId?: string; lines: TraceLine[] }[]>((groups, line) => {
    const last = groups[groups.length - 1];
    if (last && last.nodeId === line.nodeId) last.lines.push(line);
    else groups.push({ nodeId: line.nodeId, lines: [line] });
    return groups;
  }, []);

const SOURCE_LABEL: Record<TraceLine["source"], string> = { choice: "choice", script: "script", branch: "branch", jump: "jump" };

// For authors testing their story: what the engine just did and why, every
// variable (editable), and problems met. Off by default; players never see it.
export const DebugPanel: React.FC<DebugPanelProps> = ({
  variables, startValues = {}, errors, trace, currentLabel, labelOf, onSetValue, presets, onRestartWith, onShowInEditor,
}) => (
  <aside
    className="absolute bottom-4 right-4 z-50 flex max-h-[70vh] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-zinc-800 bg-black/85 font-mono text-xs text-zinc-400 shadow-xl backdrop-blur-md"
    aria-label="Debugger"
  >
    <header className="flex items-center gap-2 px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-zinc-200" title={currentLabel}>{currentLabel}</span>
      {presets.length > 0 && (
        <select
          className="max-w-[8rem] rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-zinc-300"
          value=""
          onChange={(e) => {
            const preset = presets.find((p) => p.id === e.target.value);
            if (preset) onRestartWith(preset.values);
          }}
          aria-label="Restart with a saved scenario"
        >
          <option value="">Restart with…</option>
          {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      {onShowInEditor && (
        <button onClick={onShowInEditor} className="flex items-center gap-1 rounded border border-zinc-700 px-1.5 py-0.5 text-zinc-300 hover:border-zinc-500 hover:text-white" title="Close Play Mode and select this node on the canvas">
          <LocateFixed size={12} aria-hidden /> Canvas
        </button>
      )}
    </header>

    <div className="overflow-y-auto">
      <div className={section}>
        <div className={heading}>What just happened</div>
        {trace.length === 0 ? (
          <div className="italic text-zinc-600">Nothing ran since the last choice.</div>
        ) : (
          groupByNode(trace).map((g, i) => (
            <div key={i} className="mb-1.5 last:mb-0">
              <div className="text-zinc-300">{g.nodeId ? labelOf(g.nodeId) : ""}</div>
              <ol>
                {g.lines.map((t, j) => (
                  <li key={j} className="grid grid-cols-[3.25rem_1fr] gap-x-2 py-0.5">
                    <span className="text-zinc-600">{t.line ? `${SOURCE_LABEL[t.source]} ${t.line}` : SOURCE_LABEL[t.source]}</span>
                    <span className="min-w-0">
                      <span className="break-words text-zinc-300">{t.text}</span>
                      <span className={`block ${t.error ? "text-rose-300" : t.note.startsWith("true") || t.note === "taken" ? "text-emerald-300" : "text-zinc-500"}`}>
                        {t.error && <AlertTriangle size={10} className="mr-1 inline" aria-hidden />}{t.note}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))
        )}
      </div>

      {variables.length > 0 && (
        <div className={section}>
          <div className={heading}>Variables</div>
          <div className="space-y-1">
            {variables.map((v) => <VariableRow key={v.id} variable={v} startValue={startValues[v.name]} onChange={(value) => onSetValue(v.name, value)} />)}
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className={section}>
          <div className={`${heading} text-rose-400`}>{errors.length} {errors.length === 1 ? "problem" : "problems"}</div>
          <ul className="space-y-1.5 text-rose-300">
            {errors.map((e, i) => <li key={i}><span className="text-zinc-400">{e.nodeLabel}:</span> {e.message}</li>)}
          </ul>
        </div>
      )}
    </div>
  </aside>
);

type Prim = VariableType.NUMBER | VariableType.STRING | VariableType.BOOLEAN;
const COLOR: Record<Prim, string> = { [VariableType.NUMBER]: "text-violet-400", [VariableType.STRING]: "text-sky-400", [VariableType.BOOLEAN]: "" };
const blank: Record<Prim, string | number | boolean> = { [VariableType.NUMBER]: 0, [VariableType.STRING]: "", [VariableType.BOOLEAN]: false };
const TYPE_NAME: Record<VariableType, string> = {
  [VariableType.NUMBER]: "number", [VariableType.STRING]: "text", [VariableType.BOOLEAN]: "true/false",
  [VariableType.ARRAY]: "list", [VariableType.OBJECT]: "object",
};

/** One value of one type: numbers only take numbers (anything else reverts),
 *  true/false is a toggle, text is text. Committed on Enter or leaving the field. */
function TypedInput({ type, value, label, onCommit }: { type: Prim; value: unknown; label: string; onCommit: (v: string | number | boolean) => void }) {
  if (type === VariableType.BOOLEAN) {
    return (
      <button onClick={() => onCommit(!value)} className={`font-bold hover:underline ${value ? "text-emerald-400" : "text-rose-400"}`} title="Click to flip" aria-label={`${label}: ${String(!!value)}`}>
        {String(!!value)}
      </button>
    );
  }
  const shown = typeof value === (type === VariableType.NUMBER ? "number" : "string") ? String(value) : "";
  return (
    <input
      key={shown}
      className={`w-24 min-w-0 rounded border border-transparent bg-transparent px-1 text-right font-bold hover:border-zinc-700 focus:border-orange-500 focus:outline-none ${COLOR[type]}`}
      type={type === VariableType.NUMBER ? "number" : "text"}
      defaultValue={shown}
      aria-label={label}
      onBlur={(e) => {
        const raw = e.target.value;
        if (type === VariableType.NUMBER) {
          const n = raw.trim() === "" ? NaN : Number(raw);
          if (!Number.isFinite(n)) { e.target.value = shown; return; } // not a number: put it back
          if (n !== value) onCommit(n);
        } else if (raw !== value) onCommit(raw);
      }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { e.currentTarget.value = shown; e.currentTarget.blur(); } }}
    />
  );
}

const VariableRow: React.FC<{ variable: Variable; startValue: Variable["value"] | undefined; onChange: (value: unknown) => void }> = ({ variable, startValue, onChange }) => {
  const [open, setOpen] = useState(false);
  const { type, value, name } = variable;

  // A script put the wrong kind of value here: say so, readably, and offer the starting value back.
  if (!matchesType(variable, value)) {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-3">
          <span className="opacity-70">{name}</span>
          {startValue !== undefined && (
            <button onClick={() => onChange(startValue)} className="text-zinc-400 hover:text-zinc-100 hover:underline" title="Set it back to its starting value">reset</button>
          )}
        </div>
        <div className="text-rose-300">
          <AlertTriangle size={10} className="mr-1 inline" aria-hidden />
          not a {TYPE_NAME[type]}: <span className="break-all">{formatValue(value, 40)}</span>
        </div>
      </div>
    );
  }

  if (type === VariableType.ARRAY && isArrayValue(value)) {
    const items = value.elements;
    const itemType = value.elementType as Prim;
    const setItems = (next: typeof items) => onChange({ ...value, elements: next });
    return (
      <div className="flex flex-col gap-1">
        <div className="flex justify-between gap-4">
          <span className="opacity-70">{name}</span>
          <button onClick={() => setOpen(!open)} className="font-bold text-cyan-400 hover:text-cyan-300 hover:underline" aria-expanded={open}>
            list ({items.length})
          </button>
        </div>
        {open && (
          <div className="ml-2 space-y-1 rounded border border-zinc-700 bg-black/60 p-2">
            {items.length === 0 && <div className="italic text-zinc-500">empty</div>}
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-zinc-300">
                <span className="min-w-[20px] text-zinc-600">{i}</span>
                <span className="flex-1" />
                <TypedInput type={itemType} value={item} label={`${name} item ${i}`} onCommit={(v) => setItems(items.map((x, j) => (j === i ? v : x)) as typeof items)} />
                <button onClick={() => setItems(items.filter((_, j) => j !== i) as typeof items)} className="text-zinc-500 hover:text-rose-400" aria-label={`Remove item ${i}`} title="Remove">×</button>
              </div>
            ))}
            <button onClick={() => setItems([...items, blank[itemType]] as typeof items)} className="text-zinc-400 hover:text-zinc-100">+ add {TYPE_NAME[itemType]}</button>
          </div>
        )}
      </div>
    );
  }

  if (type === VariableType.OBJECT && isObjectValue(value)) {
    const keys = Object.keys(value.keys);
    return (
      <div className="flex flex-col gap-1">
        <div className="flex justify-between gap-4">
          <span className="opacity-70">{name}</span>
          <button onClick={() => setOpen(!open)} className="font-bold text-fuchsia-400 hover:text-fuchsia-300 hover:underline" aria-expanded={open}>
            object ({keys.length})
          </button>
        </div>
        {open && (
          <div className="ml-2 space-y-1 rounded border border-zinc-700 bg-black/60 p-2">
            {keys.length === 0 && <div className="italic text-zinc-500">no keys</div>}
            {keys.map((key) => {
              const entry = value.keys[key];
              return (
                <div key={key} className="flex items-center gap-2 text-zinc-300">
                  <span className="min-w-0 flex-1 truncate text-zinc-500">{key}</span>
                  <TypedInput type={entry.type as Prim} value={entry.value} label={`${name}.${key}`}
                    onCommit={(v) => onChange({ keys: { ...value.keys, [key]: { ...entry, value: v } } })} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="opacity-70">{name}</span>
      <TypedInput type={type as Prim} value={value} label={`${name} value`} onCommit={onChange} />
    </div>
  );
};
