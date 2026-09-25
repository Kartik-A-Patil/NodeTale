import React from 'react';
import { useReactFlow } from 'reactflow';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { Diagnostic } from '../../core/validation/types';

interface ProblemsListProps {
  // Computed once by the parent (SidebarLeft, already scoped to the active
  // board) so this and the sidebar's badge count don't each run their own
  // independent full validation pass.
  diagnostics: Diagnostic[];
}

export const ProblemsList: React.FC<ProblemsListProps> = ({ diagnostics }) => {
  const { setNodes, fitView } = useReactFlow();

  const focusNode = (nodeId?: string) => {
    if (!nodeId) return;
    setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === nodeId })));
    fitView({ nodes: [{ id: nodeId }], duration: 450, padding: 0.6, maxZoom: 1.4 });
  };

  if (diagnostics.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-zinc-600 text-xs">
        No problems found on this board.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="px-2 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-2">
        Problems ({diagnostics.length})
      </div>
      {diagnostics.map((d, i) => (
        <div
          key={`${d.code}-${d.nodeId}-${i}`}
          onClick={() => focusNode(d.nodeId)}
          className="group flex items-start gap-2 px-3 py-2 rounded-md cursor-pointer text-xs text-zinc-400 hover:bg-zinc-800/30 hover:text-zinc-300 transition-all"
        >
          {d.severity === 'error' ? (
            <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
          )}
          <span className="leading-snug">{d.message}</span>
        </div>
      ))}
    </div>
  );
};
