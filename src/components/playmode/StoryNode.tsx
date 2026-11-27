import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Play, Lock, Check } from "lucide-react";
import type { StoryOption } from "../../core/runtime/StoryRuntime";

interface StoryNodeProps {
  label: string;
  content: string;
  options: StoryOption[];
  onOptionClick: (id: string) => void;
  hasVisual: boolean;
}

// Paragraphs fade in one after another; the choices wait until the text is in.
const STEP_MS = 280;
const FADE_MS = 450;
const MAX_STAGGER = 10; // long scenes don't make the player wait forever

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const isTyping = (e: KeyboardEvent) =>
  e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));

// One scene. Mounted fresh per scene (keyed by node id), so the reveal restarts.
export const StoryNode: React.FC<StoryNodeProps> = ({ label, content, options, onOptionClick, hasVisual }) => {
  const textRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(prefersReducedMotion);

  useLayoutEffect(() => {
    if (revealed || !textRef.current) return;
    const blocks = Array.from(textRef.current.children) as HTMLElement[];
    blocks.forEach((el, i) => el.style.setProperty("--i", String(Math.min(i + 1, MAX_STAGGER))));
    const timer = setTimeout(() => setRevealed(true), Math.min(blocks.length + 1, MAX_STAGGER) * STEP_MS + FADE_MS);
    return () => clearTimeout(timer);
  }, [revealed, content]);

  const open = options.filter((o) => !o.locked);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
      const digit = /^[1-9]$/.test(e.key) ? Number(e.key) : 0;
      if (!digit && e.key !== "Enter" && e.key !== " ") return;
      // A focused choice button already handles Enter/Space itself.
      if (!digit && e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      if (!revealed) return setRevealed(true);
      if (digit) {
        const opt = options[digit - 1];
        if (opt && !opt.locked) onOptionClick(opt.edgeId);
      } else if (open.length === 1) {
        onOptionClick(open[0].edgeId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, options, open, onOptionClick]);

  return (
    <div
      className={`flex flex-col justify-center h-full p-8 md:p-16 overflow-y-auto ${hasVisual ? "w-full bg-black" : "w-full mx-auto"}`}
      onClick={() => !revealed && setRevealed(true)}
    >
      <div className="max-w-xl w-full mx-auto flex flex-col gap-8 animate-in fade-in duration-500">
        <div className="space-y-6">
          <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-200 font-serif tracking-tight">
            {label}
          </h1>
          <div
            ref={textRef}
            className={`play-content nt-prose nt-reveal ${revealed ? "is-revealed" : ""} text-lg md:text-xl text-zinc-300 leading-relaxed font-serif font-light whitespace-pre-wrap`}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>

        <div
          className={`flex flex-col gap-3 pt-4 transition-opacity duration-300 ${revealed ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          aria-hidden={!revealed}
        >
          {options.map((opt, idx) => {
            const key = idx < 9 ? <kbd className="shrink-0 w-6 text-center rounded border border-current/30 font-mono text-xs opacity-60" aria-hidden>{idx + 1}</kbd> : null;
            return opt.locked ? (
              <div
                key={opt.edgeId}
                aria-disabled="true"
                className="px-6 py-4 border border-zinc-900 bg-zinc-950/60 rounded-lg text-lg text-zinc-600 cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  {key}
                  <span className="flex-1">{opt.label}</span>
                  <Lock size={16} aria-hidden />
                </div>
                <div className="mt-1 pl-9 text-sm font-mono text-zinc-500">{opt.lockedReason}</div>
              </div>
            ) : (
              <button
                key={opt.edgeId}
                onClick={() => onOptionClick(opt.edgeId)}
                tabIndex={revealed ? 0 : -1}
                className="group relative px-6 py-4 bg-zinc-900/50 border border-zinc-800 hover:border-orange-500/50 hover:bg-zinc-800/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400 text-left rounded-lg transition-all duration-300 text-lg overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className={`relative flex items-center gap-3 ${opt.visited ? "text-zinc-500" : "text-zinc-200"}`}>
                  {key}
                  <span className="flex-1 group-hover:text-white transition-colors">{opt.label}</span>
                  {opt.visited && (
                    <span className="flex items-center gap-1 text-xs font-mono uppercase tracking-wider">
                      <Check size={12} aria-hidden /> seen
                    </span>
                  )}
                  <Play size={16} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-orange-500 fill-current" aria-hidden />
                </div>
              </button>
            );
          })}

          {options.length === 0 && (
            <div className="text-center p-8 border border-dashed border-zinc-800 rounded-lg">
              <span className="text-zinc-500 italic font-serif">End of story</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
