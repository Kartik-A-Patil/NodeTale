import React, { useState } from "react";
import { X, CornerUpLeft, Trash2 } from "lucide-react";
import type { LogEntry, PlaySnapshot } from "../../core/runtime/StoryRuntime";
import { formatRelativeTime } from "../../utils/localPrefs";

export interface SaveSlot {
  savedAt: number;
  sceneLabel: string;
  snapshot: PlaySnapshot;
}

export const SAVE_SLOTS = 3;

const panel = "absolute inset-y-0 right-0 z-[60] flex w-full max-w-sm flex-col border-l border-zinc-800 bg-zinc-950/95 backdrop-blur-md animate-in slide-in-from-right-8 fade-in duration-200";
const rowButton = "rounded-md border border-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-600 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400 disabled:opacity-40 disabled:pointer-events-none";

function PanelFrame({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <aside className={panel} aria-label={title}>
      <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
        <h2 className="font-serif text-lg text-zinc-100">{title}</h2>
        <button onClick={onClose} className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Close" autoFocus>
          <X size={16} />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </aside>
  );
}

// The path so far, oldest first. Any earlier scene can be returned to.
export function LogPanel({ entries, endings, onRewind, onClose }: {
  entries: LogEntry[];
  endings: { found: number; total: number };
  onRewind: (index: number) => void;
  onClose: () => void;
}) {
  return (
    <PanelFrame title="Story so far" onClose={onClose}>
      <ol className="space-y-1">
        {entries.map((e, i) => (
          <li key={`${e.index}-${i}`} className="group rounded-md px-3 py-2 hover:bg-zinc-900">
            <div className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-right font-mono text-xs text-zinc-600">{i + 1}</span>
              <span className={`flex-1 font-serif ${e.index === -1 ? "text-orange-300" : "text-zinc-200"}`}>{e.label}</span>
              {e.index === -1 ? (
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">now</span>
              ) : (
                <button onClick={() => onRewind(e.index)} className={`${rowButton} opacity-0 group-hover:opacity-100 focus-visible:opacity-100`} title="Go back to this scene">
                  <CornerUpLeft size={12} aria-hidden className="inline -mt-0.5 mr-1" />Return
                </button>
              )}
            </div>
            {e.choice && <div className="pl-8 text-sm text-zinc-500">→ {e.choice}</div>}
          </li>
        ))}
      </ol>
      {endings.total > 0 && (
        <p className="mt-6 border-t border-zinc-800 pt-4 font-mono text-sm text-zinc-400">
          {endings.found} of {endings.total} {endings.total === 1 ? "ending" : "endings"} found
        </p>
      )}
    </PanelFrame>
  );
}

// Three slots per story on this device.
export function SavesPanel({ slots, canSave, onSave, onLoad, onDelete, onClose }: {
  slots: (SaveSlot | null)[];
  canSave: boolean;
  onSave: (slot: number) => void;
  onLoad: (slot: number) => boolean;
  onDelete: (slot: number) => void;
  onClose: () => void;
}) {
  const [problem, setProblem] = useState<number | null>(null);
  return (
    <PanelFrame title="Saves" onClose={onClose}>
      <ul className="space-y-3">
        {Array.from({ length: SAVE_SLOTS }, (_, i) => {
          const slot = slots[i];
          return (
            <li key={i} className="rounded-lg border border-zinc-800 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-zinc-500">Slot {i + 1}</span>
                {slot && <span className="text-xs text-zinc-500">{formatRelativeTime(slot.savedAt)}</span>}
              </div>
              <div className={`mt-1 font-serif ${slot ? "text-zinc-200" : "italic text-zinc-600"}`}>{slot ? slot.sceneLabel : "Empty"}</div>
              {problem === i && (
                <p className="mt-2 text-sm text-rose-300">The story has changed since this save: a scene it needs is gone.</p>
              )}
              <div className="mt-3 flex gap-2">
                <button className={rowButton} disabled={!canSave} onClick={() => { setProblem(null); onSave(i); }}>
                  {slot ? "Overwrite" : "Save here"}
                </button>
                <button className={rowButton} disabled={!slot} onClick={() => setProblem(onLoad(i) ? null : i)}>Load</button>
                {slot && (
                  <button className={`${rowButton} ml-auto`} onClick={() => onDelete(i)} aria-label={`Delete slot ${i + 1}`} title="Delete">
                    <Trash2 size={12} aria-hidden />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-zinc-500">Saves stay in this browser, on this device.</p>
    </PanelFrame>
  );
}
