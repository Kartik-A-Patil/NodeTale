import React, { useRef } from 'react';
import { MoreVertical, Image as ImageIcon, Copy, Trash2, FileText, Calendar, Layers } from 'lucide-react';
import { Project } from '../../types';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onDuplicate: (e: React.MouseEvent) => void;
  onCoverImageUpdate: (file: File) => void;
  isMenuOpen: boolean;
  onToggleMenu: (e: React.MouseEvent) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onClick,
  onDelete,
  onDuplicate,
  onCoverImageUpdate,
  isMenuOpen,
  onToggleMenu
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      onClick={onClick}
      className="group relative flex flex-col h-64 bg-zinc-900/50 border border-zinc-800/50 rounded-xl hover:border-orange-500/50 hover:bg-zinc-900 hover:shadow-xl hover:shadow-orange-900/5 cursor-pointer transition-all duration-300 overflow-hidden"
    >
      <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleImageUpload} 
      />

      {/* Cover Image Area */}
      <div className="h-36 bg-zinc-800/50 relative overflow-hidden group-hover:h-32 transition-all duration-300">
          {project.coverImage ? (
              <img 
                src={project.coverImage} 
                alt={project.name} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
              />
          ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-700 bg-zinc-800/30">
                  <FileText size={48} className="opacity-50" />
              </div>
          )}
          
          {/* Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent opacity-60" />
      </div>
          
      {/* Dropdown Menu Trigger */}
      <div className={`absolute top-3 right-3 transition-all duration-200 z-20 ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button 
              onClick={onToggleMenu}
              className={`p-1.5 rounded-lg text-zinc-200 backdrop-blur-md border border-white/10 shadow-lg transition-colors ${isMenuOpen ? 'bg-orange-600 border-orange-500' : 'bg-black/40 hover:bg-black/60'}`}
          >
              <MoreVertical size={16} />
          </button>
          
          {isMenuOpen && (
              <div className="absolute right-0 top-9 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-30 py-1.5 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                  <button 
                      onClick={triggerImageUpload}
                      className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2.5 transition-colors"
                  >
                      <ImageIcon size={14} className="text-zinc-500" /> Change Cover
                  </button>
                  <button 
                      onClick={onDuplicate}
                      className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2.5 transition-colors"
                  >
                      <Copy size={14} className="text-zinc-500" /> Duplicate
                  </button>
                  <div className="h-px bg-zinc-800 my-1.5 mx-2" />
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
            <h3 className="text-lg font-bold mb-1.5 truncate text-zinc-100 group-hover:text-orange-500 transition-colors">{project.name}</h3>
            <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date().toLocaleDateString()}
                </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-800/50">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-800/50 px-2 py-1 rounded-md">
                <Layers size={12} />
                <span>{project.boards.length} Board{project.boards.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-800/50 px-2 py-1 rounded-md">
                <FileText size={12} />
                <span>{project.assets.length} Asset{project.assets.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
      </div>
    </div>
  );
};
