import React, { useState } from "react";
import { Variable, VariableType, ArrayValue, ObjectValue } from "../../types";
import { ChevronRight, X } from "lucide-react";

interface DebugOverlayProps {
  variables: Variable[];
}

const isArrayValue = (value: any): value is ArrayValue => {
  return value !== null && typeof value === "object" && "elementType" in value && Array.isArray(value.elements);
};

const isObjectValue = (value: any): value is ObjectValue => {
  return value !== null && typeof value === "object" && "keys" in value && typeof value.keys === "object";
};

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

const VariableRow: React.FC<{ variable: Variable }> = ({ variable }) => {
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

  // Fallback for primitive types
  return (
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
};
