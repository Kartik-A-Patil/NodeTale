import React from 'react';
import { X } from 'lucide-react';

interface RenameProjectModalProps {
  isOpen: boolean;
  projectName: string;
  setProjectName: (name: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  error: string;
  setError: (error: string) => void;
}

export const RenameProjectModal: React.FC<RenameProjectModalProps> = ({
  isOpen,
  projectName,
  setProjectName,
  onClose,
  onSubmit,
  error,
  setError
}) => {
  if (!isOpen) return null;

  const handleClose = () => {
    setError('');
    setProjectName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" onClick={handleClose}>
      <div className="bg-zinc-900 p-6 rounded-xl w-96 border border-zinc-800 shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-zinc-100">Rename Project</h2>
            <button onClick={handleClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X size={20} />
            </button>
        </div>
        
        <form onSubmit={onSubmit}>
          <div className="space-y-2 mb-6">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">New Name</label>
            <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter a unique project name"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-all placeholder:text-zinc-600"
                autoFocus
            />
            {error && <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-red-400 inline-block" />
                {error}
            </p>}
          </div>

          <div className="flex justify-end gap-3">
            <button 
              type="button" 
              onClick={handleClose}
              className="px-4 py-2.5 text-zinc-400 hover:text-zinc-200 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 rounded-lg text-white text-sm font-medium shadow-lg shadow-orange-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Save Name
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
