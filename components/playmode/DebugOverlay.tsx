import React, { useState } from "react";
import { Variable, VariableType } from "../../types";
import { ChevronRight } from "lucide-react";

interface DebugOverlayProps {
  variables: Variable[];
}

export const DebugOverlay: React.FC<DebugOverlayProps> = ({ variables }) => {
  const [isHovered, setIsHovered] = useState(false);

  const VISIBLE_COUNT = 3;
  const visibleVars = variables.slice(0, VISIBLE_COUNT);
  const hiddenVars = variables.slice(VISIBLE_COUNT);

  if (variables.length === 0) return null;

  return (
    <div 
      className="absolute bottom-4 right-4 z-50 flex flex-col items-end"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main minimal display */}
      <div className="bg-black/40 backdrop-blur-sm border border-white/10 p-2 rounded-md text-xs font-mono text-zinc-400 transition-all hover:bg-black/60 hover:border-white/20 cursor-default">
        <div className="flex items-center justify-between gap-4 mb-1 opacity-50 uppercase text-[10px] tracking-wider font-bold">
          <span>Variables</span>
          {hiddenVars.length > 0 && (
             <span className="flex items-center">
               +{hiddenVars.length} <ChevronRight size={10} className={`transform transition-transform ${isHovered ? 'rotate-90' : ''}`}/>
             </span>
          )}
        </div>
        
        <div className="space-y-1 min-w-[120px]">
          {visibleVars.map((v) => (
            <VariableRow key={v.id} variable={v} />
          ))}
        </div>
      </div>

      {/* Expanded Overlay */}
      {isHovered && hiddenVars.length > 0 && (
        <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-md border border-zinc-800 p-3 rounded-md text-xs font-mono text-zinc-400 shadow-xl min-w-[160px] max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
           <div className="space-y-1">
            {hiddenVars.map((v) => (
                <VariableRow key={v.id} variable={v} />
            ))}
           </div>
        </div>
      )}
    </div>
  );
};

const VariableRow: React.FC<{ variable: Variable }> = ({ variable }) => (
  <div className="flex justify-between gap-4">
    <span className="opacity-70">{variable.name}</span>
    <span
      className={`font-bold ${
        variable.type === VariableType.BOOLEAN
          ? variable.value
            ? "text-emerald-400"
            : "text-rose-400"
          : variable.type === VariableType.NUMBER
          ? "text-violet-400"
          : "text-sky-400"
      }`}
    >
      {String(variable.value)}
    </span>
  </div>
);
