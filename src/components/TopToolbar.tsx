import React from 'react';
import { Play, Download, PlusCircle, GitFork, ArrowRightCircle, MessageSquare, Copy, X, LayoutGrid, Calendar, Undo, Redo, Layout, AlertTriangle } from 'lucide-react';

interface TopToolbarProps {
  onAddNode: (type: 'elementNode' | 'conditionNode' | 'jumpNode' | 'commentNode' | 'sectionNode') => void;
  onPlay: () => void;
  onExport: () => void;
  lastSaved: Date | null;
  jumpClipboard: { id: string; label: string } | null;
  setJumpClipboard: (val: { id: string; label: string } | null) => void;
  viewMode: 'flow' | 'timeline';
  onViewModeChange: (mode: 'flow' | 'timeline') => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canPlay: boolean;
    onSave?: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({ 
  onAddNode, 
  onPlay, 
  onExport, 
  lastSaved, 
  jumpClipboard, 
  setJumpClipboard,
  viewMode,
  onViewModeChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  canPlay,
  onSave
}) => {
  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow/type', nodeType);
    event.dataTransfer.setData('application/reactflow/payload', JSON.stringify({ label }));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="h-14 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between px-4 z-10 shrink-0">
      <div className="flex items-center gap-4">
          <div className="flex bg-zinc-900/50 rounded-lg p-1 border border-zinc-800">
            <button 
                onClick={() => onViewModeChange('flow')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'flow' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                title="Flow View"
            >
                <LayoutGrid size={16} />
            </button>
            <button 
                onClick={() => onViewModeChange('timeline')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'timeline' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                title="Timeline View"
            >
                <Calendar size={16} />
            </button>
          </div>

          <div className="flex bg-zinc-900/50 rounded-lg p-1 border border-zinc-800">
            <button 
                onClick={onUndo}
                disabled={!canUndo}
                className={`p-1.5 rounded-md transition-all ${canUndo ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-zinc-700 cursor-not-allowed'}`}
                title="Undo (Ctrl+Z)"
            >
                <Undo size={16} />
            </button>
            <button 
                onClick={onRedo}
                disabled={!canRedo}
                className={`p-1.5 rounded-md transition-all ${canRedo ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-zinc-700 cursor-not-allowed'}`}
                title="Redo (Ctrl+Y)"
            >
                <Redo size={16} />
            </button>
          </div>

          <div className="w-px h-6 bg-zinc-800 mx-2" />
          <div className="flex gap-2">
              <button 
                  draggable
                  onDragStart={(event) => onDragStart(event, 'elementNode', 'New Element')}
                  onClick={() => onAddNode('elementNode')} 
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-md text-xs font-medium transition-all border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white cursor-grab active:cursor-grabbing"
              >
                  <PlusCircle size={14} className="text-orange-500" /> Element
              </button>
              <button 
                  draggable
                  onDragStart={(event) => onDragStart(event, 'sectionNode', 'New Section')}
                  onClick={() => onAddNode('sectionNode')} 
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-md text-xs font-medium transition-all border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white cursor-grab active:cursor-grabbing"
              >
                  <Layout size={14} className="text-green-500" /> Section
              </button>
              <button 
                  draggable
                  onDragStart={(event) => onDragStart(event, 'conditionNode', 'Logic Check')}
                  onClick={() => onAddNode('conditionNode')} 
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-md text-xs font-medium transition-all border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white cursor-grab active:cursor-grabbing"
              >
                  <GitFork size={14} className="text-blue-500" /> Branch
              </button>
              <button 
                  draggable
                  onDragStart={(event) => onDragStart(event, 'jumpNode', 'Jump')}
                  onClick={() => onAddNode('jumpNode')} 
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-md text-xs font-medium transition-all border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white cursor-grab active:cursor-grabbing"
              >
                  <ArrowRightCircle size={14} className="text-purple-500" /> Jump
              </button>
              <button 
                  draggable
                  onDragStart={(event) => onDragStart(event, 'commentNode', '')}
                  onClick={() => onAddNode('commentNode')} 
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-md text-xs font-medium transition-all border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white cursor-grab active:cursor-grabbing"
              >
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
          <button onClick={onPlay} className={`flex items-center gap-2 px-4 py-1.5 rounded text-sm font-semibold transition-colors shadow-lg ${canPlay ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-900/20' : 'bg-zinc-600 text-zinc-400 cursor-not-allowed'}`} disabled={!canPlay} title={canPlay ? undefined : "Add an element titled 'Start' for playing"}>
              <Play size={14} fill="currentColor" /> Play
          </button>
          {!canPlay && <AlertTriangle size={14} className="text-red-500" title="No 'Start' node found" />}
         <button onClick={onExport} className="p-2 text-zinc-400 hover:text-white transition-colors">
              <Download size={18} />
          </button>
         <button onClick={onSave} className="p-2 text-zinc-400 hover:text-white transition-colors" title="Save (Ctrl+S)">
              Save
          </button>
      </div>
    </div>
  );
};