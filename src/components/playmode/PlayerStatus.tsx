import React, { useEffect, useState } from "react";
import { Variable, isArrayValue } from "../../models/story";
import type { VarChange } from "../../core/runtime/StoryRuntime";
import { formatValue } from "../../core/sim/simulate";

interface PlayerStatusProps {
  /** Every variable with its current value. */
  variables: Variable[];
  changes: VarChange[];
  turn: number;
}

const TOAST_MS = 2600;

// "+10 gold", "has_key: yes", "inventory: +rope"
function describe({ name, before, after }: VarChange): string {
  if (typeof before === "number" && typeof after === "number") {
    const d = Math.round((after - before) * 100) / 100;
    return `${d > 0 ? "+" : "−"}${Math.abs(d)} ${name}`;
  }
  if (typeof after === "boolean") return `${name}: ${after ? "yes" : "no"}`;
  if (isArrayValue(before) && isArrayValue(after)) {
    const added = after.elements.filter((e) => !before.elements.includes(e));
    const removed = before.elements.filter((e) => !after.elements.includes(e));
    const parts = [...added.map((e) => `+${e}`), ...removed.map((e) => `−${e}`)];
    if (parts.length) return `${name}: ${parts.join(", ")}`;
  }
  return `${name}: ${formatValue(after)}`;
}

// What the player sees of the story's numbers: a bar of the variables the
// author chose to show, and a short note whenever a choice changes one. With
// none chosen, every change is announced so authors still get feedback.
export const PlayerStatus: React.FC<PlayerStatusProps> = ({ variables, changes, turn }) => {
  const shown = variables.filter((v) => v.showInPlay);
  const announce = shown.length ? new Set(shown.map((v) => v.name)) : null;
  const [toasts, setToasts] = useState<{ id: string; text: string; up: boolean }[]>([]);

  useEffect(() => {
    if (!turn) return;
    const fresh = changes
      .filter((c) => !announce || announce.has(c.name))
      .map((c, i) => ({
        id: `${turn}-${i}`,
        text: describe(c),
        up: typeof c.after === "number" && typeof c.before === "number" ? c.after > c.before : c.after !== false,
      }));
    if (!fresh.length) return;
    setToasts((t) => [...t, ...fresh].slice(-5));
    // Not cleared on the next turn: each note leaves on its own schedule.
    setTimeout(() => setToasts((t) => t.filter((x) => !fresh.includes(x))), TOAST_MS);
    // Only a new turn is news; `changes` arrives with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn]);

  return (
    <>
      {shown.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex max-w-[60vw] flex-wrap justify-center gap-2" aria-label="Status">
          {shown.map((v) => (
            <span key={v.id} className="rounded-full border border-white/10 bg-black/50 px-3 py-1 font-mono text-sm text-zinc-300 backdrop-blur-sm">
              <span className="text-zinc-500">{v.name}</span> {formatValue(v.value, 18)}
            </span>
          ))}
        </div>
      )}
      <div className="absolute top-16 right-4 z-40 flex flex-col items-end gap-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-in fade-in slide-in-from-right-4 duration-300 rounded-md border bg-black/70 px-3 py-1.5 font-mono text-sm backdrop-blur-sm ${t.up ? "border-emerald-500/30 text-emerald-300" : "border-rose-500/30 text-rose-300"}`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </>
  );
};
