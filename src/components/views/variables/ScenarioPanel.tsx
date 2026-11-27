import { useEffect, useState } from 'react';
import { Eye, EyeOff, RotateCcw, Save, Trash2 } from 'lucide-react';
import { SimulationPreset, Variable } from '../../../models/story';
import { Values, formatValue, valuesEqual } from '../../../core/sim/simulate';
import { focusRing } from '../../ui/styles';

interface ScenarioPanelProps {
  variables: Variable[];
  overrides: Values;
  onOverrides: (next: Values) => void;
  presets: SimulationPreset[];
  activePresetId: string | null;
  onSelectPreset: (id: string | null) => void;
  onSavePreset: (name: string) => void;
  onDeletePreset: (id: string) => void;
  watch: string[];
  onToggleWatch: (name: string) => void;
  /** Variables the Start scene's own script assigns: a starting value for these is overwritten immediately. */
  setByStart: Set<string>;
}

const field = `h-8 w-full rounded-md border border-nt-line-strong bg-nt-bg px-2 font-mono text-xs text-nt-ink hover:border-nt-ink-3 ${focusRing} focus-visible:outline-offset-0`;
const iconButton = `inline-flex h-7 w-7 items-center justify-center rounded-md text-nt-ink-3 hover:bg-nt-raised hover:text-nt-ink ${focusRing}`;

// Starting values the simulation runs with. Presets are saved on the project,
// so they travel with exports.
export function ScenarioPanel({
  variables, overrides, onOverrides, presets, activePresetId, onSelectPreset, onSavePreset, onDeletePreset, watch, onToggleWatch, setByStart,
}: ScenarioPanelProps) {
  const [naming, setNaming] = useState<string | null>(null);
  const changedCount = variables.filter((v) => v.name in overrides && !valuesEqual(overrides[v.name], v.value)).length;

  const setValue = (name: string, value: unknown) => onOverrides({ ...overrides, [name]: value });
  const resetValue = (name: string) => {
    const next = { ...overrides };
    delete next[name];
    onOverrides(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-nt-ink">Starting values</h3>
        {changedCount > 0 && (
          <button type="button" onClick={() => onOverrides({})} className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-nt-ink-3 hover:text-nt-ink ${focusRing}`}>
            <RotateCcw size={12} aria-hidden /> Reset
          </button>
        )}
      </div>
      <p className="mt-1 text-nt-ink-3">Try the story with different values. Every tab re-simulates as you change them.</p>

      <label className="mt-3 block">
        <span className="mb-1 block text-nt-ink-2">Scenario</span>
        <div className="flex gap-1">
          <select value={activePresetId ?? ''} onChange={(e) => onSelectPreset(e.target.value || null)}
            className={`h-8 min-w-0 flex-1 rounded-md border border-nt-line-strong bg-nt-bg px-2 text-xs text-nt-ink-2 ${focusRing}`}>
            <option value="">Declared values{changedCount && !activePresetId ? ' (edited)' : ''}</option>
            {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button type="button" className={iconButton} title="Save these values as a scenario" aria-label="Save these values as a scenario" onClick={() => setNaming('')}>
            <Save size={14} />
          </button>
          {activePresetId && (
            <button type="button" className={iconButton} title="Delete this scenario" aria-label="Delete this scenario" onClick={() => onDeletePreset(activePresetId)}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </label>
      {naming !== null && (
        <form className="mt-2 flex gap-1" onSubmit={(e) => { e.preventDefault(); if (naming.trim()) { onSavePreset(naming.trim()); setNaming(null); } }}>
          <input autoFocus value={naming} onChange={(e) => setNaming(e.target.value)} placeholder="e.g. Low health run" aria-label="Scenario name"
            onKeyDown={(e) => { if (e.key === 'Escape') setNaming(null); }} className={`${field} font-sans`} />
          <button type="submit" className={`h-8 shrink-0 rounded-md bg-nt-accent px-2.5 text-xs font-semibold text-nt-accent-ink ${focusRing}`}>Save</button>
        </form>
      )}

      <ul className="mt-4 space-y-2.5">
        {variables.map((v) => {
          const value = v.name in overrides ? overrides[v.name] : v.value;
          const edited = v.name in overrides && !valuesEqual(overrides[v.name], v.value);
          const watched = watch.includes(v.name);
          const id = `sim-var-${v.id}`;
          return (
            <li key={v.id}>
              <div className="mb-1 flex items-center gap-1">
                <label htmlFor={id} className="min-w-0 flex-1 truncate font-mono text-nt-ink-2">
                  {v.name}
                  {edited && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-nt-accent align-middle" aria-label="changed from declared value" />}
                </label>
                {edited && (
                  <button type="button" className={iconButton} onClick={() => resetValue(v.name)} title={`Back to ${formatValue(v.value)}`} aria-label={`Reset ${v.name}`}>
                    <RotateCcw size={12} />
                  </button>
                )}
                <button type="button" className={`${iconButton} ${watched ? 'text-nt-ink' : ''}`} onClick={() => onToggleWatch(v.name)}
                  aria-pressed={watched} title={watched ? 'Shown on every tree node' : 'Show on every tree node'} aria-label={`Show ${v.name} in the tree`}>
                  {watched ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </div>
              {setByStart.has(v.name) && (
                <p className="mb-1 text-nt-ink-3">Start sets this in its script, so the story overwrites the value below right away.</p>
              )}
              {v.type === 'boolean' ? (
                <select id={id} value={String(value)} onChange={(e) => setValue(v.name, e.target.value === 'true')} className={field}>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : v.type === 'number' ? (
                <NumberField id={id} value={Number(value)} onChange={(n) => setValue(v.name, n)} />
              ) : v.type === 'string' ? (
                <input id={id} type="text" value={String(value)} className={field} onChange={(e) => setValue(v.name, e.target.value)} />
              ) : (
                <p id={id} className="truncate rounded-md border border-nt-line px-2 py-1.5 font-mono text-nt-ink-3" title="Lists and objects are edited in the Variables sidebar">
                  {formatValue(value, 34)}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Keeps the typed text (so "", "-" or "1." are allowed mid-edit) and only
// reports complete numbers.
function NumberField({ id, value, onChange }: { id: string; value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText((t) => (Number(t) === value && t !== '' ? t : String(value)));
  }, [value]);
  return (
    <input id={id} type="text" inputMode="decimal" value={text} className={field}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== '' && Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => setText(String(value))} />
  );
}
