import React from "react";
import { Play } from "lucide-react";

interface StoryNodeProps {
  label: string;
  content: string;
  options: { label: string; targetId: string }[];
  onOptionClick: (id: string) => void;
  hasVisual: boolean;
}

export const StoryNode: React.FC<StoryNodeProps> = ({
  label,
  content,
  options,
  onOptionClick,
  hasVisual,
}) => {
  return (
    <div
      className={`
        flex flex-col justify-center h-full p-8 md:p-16 overflow-y-auto
        ${hasVisual ? "w-full bg-black" : "w-full mx-auto"}
      `}
    >
      <div className="max-w-xl w-full mx-auto flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Content Header */}
        <div className="space-y-6">
          <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-200 font-serif tracking-tight">
            {label}
          </h1>
          <div
            className="play-content text-lg md:text-xl text-zinc-300 leading-relaxed font-serif font-light whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>

        {/* Choices */}
        <div className="flex flex-col gap-3 pt-4">
          {options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => onOptionClick(opt.targetId)}
              className="group relative px-6 py-4 bg-zinc-900/50 border border-zinc-800 hover:border-orange-500/50 hover:bg-zinc-800/80 text-left rounded-lg transition-all duration-300 text-lg overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative flex items-center justify-between">
                <span className="text-zinc-200 group-hover:text-white transition-colors">
                  {opt.label}
                </span>
                <Play
                  size={16}
                  className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-orange-500 fill-current"
                />
              </div>
            </button>
          ))}

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
