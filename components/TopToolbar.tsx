import React from 'react';
import { Play, Download, PlusCircle, GitFork, ArrowRightCircle, MessageSquare, Copy, X } from 'lucide-react';

interface TopToolbarProps {
  onAddNode: (type: 'elementNode' | 'conditionNode' | 'jumpNode' | 'commentNode') => void;
  onPlay: () => void;
  onExport: () => void;
  lastSaved: Date | null;
  jumpClipboard: { id: string; label: string } | null;
  setJumpClipboard: (val: { id: string; label: string } | null) => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({ 
  onAddNode, 
  onPlay, 
  onExport, 
  lastSaved, 
  jumpClipboard, 
  setJumpClipboard 
}) => {
  return (
    <div className="h-14 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between px-4 z-10 shrink-0">
      <div className="flex items-center gap-4">
          <div className="flex gap-1">
              <button onClick={() => onAddNode('elementNode')} className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition-colors border border-zinc-700">
                  <PlusCircle size={14} className="text-orange-500" /> Element
              </button>
              <button onClick={() => onAddNode('conditionNode')} className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition-colors border border-zinc-700">
                  <GitFork size={14} className="text-blue-500" /> Branch
              </button>
              <button onClick={() => onAddNode('jumpNode')} className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition-colors border border-zinc-700">
                  <ArrowRightCircle size={14} className="text-purple-500" /> Jump
              </button>
              <button onClick={() => onAddNode('commentNode')} className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition-colors border border-zinc-700">
                  <MessageSquare size={14} className="text-yellow-400" /> Comment
              </button>
          </div>
      </div>
      <div className="flex items-center gap-2">
         {lastSaved && (
            <span className="text-xs text-zinc-500 mr-2">
                Saved {lastSaved.toLocaleTimeString()}
            </span>
         )}
         {jumpClipboard && (
              <div className="flex items-center gap-2 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-400 animate-in fade-in">
                  <Copy size={10} />
                  <span className="max-w-[100px] truncate">Copied: {jumpClipboard.label}</span>
                  <button onClick={() => setJumpClipboard(null)} className="hover:text-white ml-1"><X size={10}/></button>
              </div>
          )}
          <button onClick={onPlay} className="flex items-center gap-2 px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-sm font-semibold transition-colors shadow-lg shadow-orange-900/20">
              <Play size={14} fill="currentColor" /> Play
          </button>
          <button onClick={onExport} className="p-2 text-zinc-400 hover:text-white transition-colors">
              <Download size={18} />
          </button>
      </div>
    </div>
  );
};