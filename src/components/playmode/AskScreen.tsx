import React, { useState } from "react";
import type { PlayQuestion } from "../../core/runtime/StoryRuntime";

interface AskScreenProps {
  title: string;
  questions: PlayQuestion[];
  onAnswer: (answers: Record<string, unknown>) => void;
  paused?: boolean;
}

const field = "w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-lg text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-orange-500/60";

// The story asks the player for values: one input per question, of the
// variable's type, then Continue. Styled like a scene so it reads as part of the story.
export const AskScreen: React.FC<AskScreenProps> = ({ title, questions, onAnswer, paused }) => {
  const [answers, setAnswers] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(questions.filter((q) => q.type === "boolean").map((q) => [q.id, true])));
  const set = (id: string, value: string | boolean) => setAnswers((a) => ({ ...a, [id]: value }));
  const missing = questions.filter((q) => {
    const a = answers[q.id];
    if (q.type === "boolean") return typeof a !== "boolean";
    if (q.type === "number") return typeof a !== "string" || a.trim() === "" || !Number.isFinite(Number(a));
    return typeof a !== "string" || a.trim() === "";
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (paused || missing.length) return;
    onAnswer(Object.fromEntries(questions.map((q) => [q.id, q.type === "number" ? Number(answers[q.id]) : answers[q.id]])));
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto p-8 md:p-16">
      <form onSubmit={submit} className="m-auto flex w-full max-w-xl flex-col gap-8 animate-in fade-in duration-500">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-orange-300 md:text-4xl">{title}</h1>
        {questions.map((q, i) => (
          <label key={q.id} className="flex flex-col gap-3">
            <span className="font-serif text-xl text-zinc-300">{q.question}</span>
            {q.type === "boolean" ? (
              <span className="flex gap-3" role="radiogroup" aria-label={q.question}>
                {[true, false].map((b) => (
                  <button
                    key={String(b)}
                    type="button"
                    role="radio"
                    aria-checked={answers[q.id] === b}
                    onClick={() => set(q.id, b)}
                    className={`rounded-lg border px-6 py-3 text-lg transition-colors ${answers[q.id] === b ? "border-orange-500/60 bg-zinc-800 text-white" : "border-zinc-800 text-zinc-400 hover:border-zinc-600"}`}
                  >
                    {b ? "Yes" : "No"}
                  </button>
                ))}
              </span>
            ) : (
              <input
                autoFocus={i === 0}
                type={q.type === "number" ? "number" : "text"}
                inputMode={q.type === "number" ? "decimal" : undefined}
                value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""}
                onChange={(e) => set(q.id, e.target.value)}
                placeholder={q.type === "number" ? "A number" : "Type your answer"}
                className={field}
              />
            )}
          </label>
        ))}
        <button
          type="submit"
          disabled={missing.length > 0}
          className="self-start rounded-lg border border-orange-500/50 bg-orange-500/10 px-6 py-3 text-lg text-orange-200 transition-colors hover:bg-orange-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400 disabled:border-zinc-800 disabled:bg-transparent disabled:text-zinc-600"
        >
          Continue <span className="ml-1 text-sm opacity-60" aria-hidden>↵</span>
        </button>
      </form>
    </div>
  );
};
