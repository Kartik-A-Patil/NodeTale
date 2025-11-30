import React, { useState } from 'react';
import { Project, Board } from '../../types';
import { Layout, Plus, Trash2 } from 'lucide-react';

interface BoardsListProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

export const BoardsList: React.FC<BoardsListProps> = ({ project, setProject }) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleRename = (id: string, newName: string) => {
    if (!newName.trim()) {
        setEditingId(null);
        return;
    }
    
    setProject(prev => ({
      ...prev,
      boards: prev.boards.map(b => b.id === id ? { ...b, name: newName } : b)
    }));
    setEditingId(null);
  };

  const addBoard = () => {
    const newBoard: Board = {
      id: `board-${Date.now()}`,
      name: 'New Board',
      nodes: [],
      edges: []
    };
    setProject(prev => ({
      ...prev,
      boards: [...prev.boards, newBoard],
      activeBoardId: newBoard.id
    }));
  };

  const deleteBoard = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (project.boards.length <= 1) return;
    setProject(prev => ({
        ...prev,
        boards: prev.boards.filter(b => b.id !== id),
        activeBoardId: prev.activeBoardId === id ? prev.boards.find(b => b.id !== id)?.id || '' : prev.activeBoardId
    }));
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-2 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-2">
        <span>Boards</span>
        <button onClick={addBoard} className="hover:text-orange-500 transition-colors"><Plus size={14} /></button>
      </div>
      {project.boards.map(board => (
        <div 
          key={board.id}
          onClick={() => setProject(p => ({ ...p, activeBoardId: board.id }))}
          onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingId(board.id);
          }}
          className={`group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-sm transition-all ${project.activeBoardId === board.id ? 'bg-zinc-800/50 text-white font-medium' : 'text-zinc-400 hover:bg-zinc-800/30 hover:text-zinc-300'}`}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
             <Layout size={14} className={project.activeBoardId === board.id ? 'text-orange-500' : 'text-zinc-600 shrink-0'} />
             {editingId === board.id ? (
                 <input 
                     autoFocus
                     className="bg-zinc-900 text-white px-1 py-0.5 rounded w-full border border-zinc-700 focus:border-orange-500 outline-none text-xs"
                     defaultValue={board.name}
                     onClick={(e) => e.stopPropagation()}
                     onBlur={(e) => handleRename(board.id, e.target.value)}
                     onKeyDown={(e) => {
                         if (e.key === 'Enter') handleRename(board.id, e.currentTarget.value);
                         if (e.key === 'Escape') setEditingId(null);
                     }}
                 />
             ) : (
                 <span className="truncate">{board.name}</span>
             )}
          </div>
          {project.boards.length > 1 && (
              <button onClick={(e) => deleteBoard(board.id, e)} className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity">
                  <Trash2 size={12} />
              </button>
          )}
        </div>
      ))}
    </div>
  );
};
