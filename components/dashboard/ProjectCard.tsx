import React, { useRef } from 'react';
import { MoreVertical, Image as ImageIcon, Copy, Trash2, FileText, Calendar, Layers, Edit3 } from 'lucide-react';
import { Project } from '../../types';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onDuplicate: (e: React.MouseEvent) => void;
  onRename: (e: React.MouseEvent) => void;
  onCoverImageUpdate: (file: File) => void;
  isMenuOpen: boolean;
  onToggleMenu: (e: React.MouseEvent) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onClick,
  onDelete,
  onDuplicate,
  onRename,
  onCoverImageUpdate,
  isMenuOpen,
  onToggleMenu
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCardClick = () => {
    if (isMenuOpen) return;
    onClick();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onCoverImageUpdate(file);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerImageUpload = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
    // We don't close the menu here immediately because the file dialog opens
  };

  return (
    <div 
      onClick={handleCardClick}
      className="group relative flex flex-col h-60 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 hover:-translate-y-0.5 cursor-pointer transition-all duration-200 overflow-hidden backdrop-blur-sm"
    >
      <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleImageUpload}
          onClick={(e) => e.stopPropagation()}
      />

      {/* Cover Image Area */}
        <div className="h-32 bg-zinc-900/40 relative overflow-hidden transition-all duration-200">
          {project.coverImage ? (
              <img 
                src={project.coverImage} 
                alt={project.name} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
              />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-700 bg-zinc-900/40">
              <FileText size={40} className="opacity-50" />
              </div>
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>
          
      {/* Dropdown Menu Trigger */}
        <div className={`absolute top-3 right-3 transition-all duration-150 z-20 ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button 
              onClick={onToggleMenu}
            className={`p-1.5 rounded-lg text-zinc-200 backdrop-blur-md border border-white/10 shadow-lg transition-colors ${isMenuOpen ? 'bg-white/10 border-white/20' : 'bg-black/40 hover:bg-black/60'}`}
          >
              <MoreVertical size={16} />
          </button>
          
          {isMenuOpen && (
              <div className="absolute right-0 top-9 w-48 bg-[#0f0f13] border border-white/10 rounded-lg shadow-2xl z-30 py-1.5 animate-in fade-in zoom-in-95 duration-200 ease-out origin-top-right">
                  <button 
                      onClick={triggerImageUpload}
                      className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-white flex items-center gap-2.5 transition-colors"
                  >
                      <ImageIcon size={14} className="text-zinc-500" /> Change Cover
                  </button>
                    <button 
                      onClick={onRename}
                      className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-white flex items-center gap-2.5 transition-colors"
                    >
                      <Edit3 size={14} className="text-zinc-500" /> Rename
                    </button>
                  <button 
                      onClick={onDuplicate}
                      className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-white flex items-center gap-2.5 transition-colors"
                  >
                      <Copy size={14} className="text-zinc-500" /> Duplicate
                  </button>
                  <div className="h-px bg-white/10 my-1.5 mx-2" />
                  <button 
                      onClick={onDelete}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 flex items-center gap-2.5 transition-colors"
                  >
                      <Trash2 size={14} /> Delete
                  </button>
              </div>
          )}
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between relative">
          <div>
            <h3 className="text-lg font-semibold mb-1 truncate text-zinc-100 group-hover:text-white transition-colors">{project.name}</h3>
            <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date().toLocaleDateString()}
                </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center gap-1.5 text-xs text-zinc-300 bg-white/5 px-2 py-1 rounded-md">
                <Layers size={12} />
                <span>{project.boards.length} Board{project.boards.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-300 bg-white/5 px-2 py-1 rounded-md">
                <FileText size={12} />
                <span>{project.assets.length} Asset{project.assets.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
      </div>
    </div>
  );
};
