import React, { useState } from "react";
import { Variable, VariableType, SimulationPreset, isArrayValue, isObjectValue } from "../../models/story";
import { AlertTriangle, LocateFixed } from "lucide-react";
import type { PlayError } from "../../core/runtime/StoryRuntime";
import type { TraceLine } from "../../core/runtime/scriptInterpreter";

interface DebugPanelProps {
  variables: Variable[];
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
  variables, errors, trace, currentLabel, labelOf, onSetValue, presets, onRestartWith, onShowInEditor,
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
            {variables.map((v) => <VariableRow key={v.id} variable={v} onChange={(value) => onSetValue(v.name, value)} />)}
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

const VariableRow: React.FC<{ variable: Variable; onChange: (value: unknown) => void }> = ({ variable, onChange }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Handle Array type
  if (variable.type === VariableType.ARRAY && isArrayValue(variable.value)) {
    const arr = variable.value;
    const count = arr.elements.length;
    const isExpanded = expandedId === variable.id;

    return (
      <div className="flex flex-col gap-1">
        <div className="flex justify-between gap-4">
          <span className="opacity-70">{variable.name}</span>
          <button
            onClick={() => setExpandedId(isExpanded ? null : variable.id)}
            className="font-bold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer hover:underline"
          >
            Array ({count})
          </button>
        </div>

        {/* Expanded Array Popup */}
        {isExpanded && (
          <div className="ml-2 bg-black/60 border border-zinc-700 rounded p-2 text-xs space-y-1 max-h-48 overflow-y-auto">
            {arr.elements.length === 0 ? (
              <div className="text-zinc-500 italic">Empty array</div>
            ) : (
              arr.elements.map((elem, idx) => (
                <div key={idx} className="flex gap-3 text-zinc-300">
                  <span className="text-zinc-600 min-w-[20px]">[{idx}]</span>
                  <span
                    className={
                      typeof elem === "boolean"
                        ? elem
                          ? "text-emerald-400"
                          : "text-rose-400"
                        : typeof elem === "number"
                        ? "text-violet-400"
                        : "text-sky-400"
                    }
                  >
                    {String(elem)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // Handle Object type
  if (variable.type === VariableType.OBJECT && isObjectValue(variable.value)) {
    const obj = variable.value;
    const keys = Object.keys(obj.keys);
    const isExpanded = expandedId === variable.id;

    return (
      <div className="flex flex-col gap-1">
        <div className="flex justify-between gap-4">
          <span className="opacity-70">{variable.name}</span>
          <button
            onClick={() => setExpandedId(isExpanded ? null : variable.id)}
            className="font-bold text-fuchsia-400 hover:text-fuchsia-300 transition-colors cursor-pointer hover:underline"
          >
            Object ({keys.length})
          </button>
        </div>

        {/* Expanded Object Popup */}
        {isExpanded && (
          <div className="ml-2 bg-black/60 border border-zinc-700 rounded p-2 text-xs space-y-1 max-h-48 overflow-y-auto">
            {keys.length === 0 ? (
              <div className="text-zinc-500 italic">Empty object</div>
            ) : (
              keys.map((key) => {
                const entry = obj.keys[key];
                return (
                  <div key={key} className="flex gap-3 text-zinc-300">
                    <span className="text-zinc-600 min-w-[80px] truncate">{key}:</span>
                    <span
                      className={
                        entry.type === VariableType.BOOLEAN
                          ? entry.value
                            ? "text-emerald-400"
                            : "text-rose-400"
                          : entry.type === VariableType.NUMBER
                          ? "text-violet-400"
                          : "text-sky-400"
                      }
                    >
                      {String(entry.value)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  }

  // Primitive values can be changed mid-play to try a path.
  const input = "w-24 rounded border border-transparent bg-transparent px-1 text-right font-bold hover:border-zinc-700 focus:border-orange-500 focus:outline-none";
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="opacity-70">{variable.name}</span>
      {variable.type === VariableType.BOOLEAN ? (
        <button
          onClick={() => onChange(!variable.value)}
          className={`font-bold ${variable.value ? "text-emerald-400" : "text-rose-400"} hover:underline`}
          title="Click to flip"
        >
          {String(variable.value)}
        </button>
      ) : (
        <input
          key={String(variable.value)}
          className={`${input} ${variable.type === VariableType.NUMBER ? "text-violet-400" : "text-sky-400"}`}
          type={variable.type === VariableType.NUMBER ? "number" : "text"}
          defaultValue={String(variable.value)}
          aria-label={`${variable.name} value`}
          // Committed on Enter or leaving the field, not per keystroke.
          onBlur={(e) => {
            const raw = e.target.value;
            const next = variable.type === VariableType.NUMBER ? Number(raw) : raw;
            if (next !== variable.value && !(typeof next === "number" && Number.isNaN(next))) onChange(next);
          }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        />
      )}
    </div>
  );
};
