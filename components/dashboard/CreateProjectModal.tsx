import React, { useRef } from 'react';
import { Image as ImageIcon, X } from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  projectName: string;
  setProjectName: (name: string) => void;
  projectImage: string | null;
  setProjectImage: (image: string | null) => void;
  error: string;
  setError: (error: string) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  projectName,
  setProjectName,
  projectImage,
  setProjectImage,
  error,
  setError
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setProjectImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleClose = () => {
    setError('');
    setProjectName('');
    setProjectImage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" onClick={handleClose}>
      <div className="bg-zinc-900 p-6 rounded-xl w-96 border border-zinc-800 shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-zinc-100">Create New Project</h2>
            <button onClick={handleClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X size={20} />
            </button>
        </div>
        
        <form onSubmit={onSubmit}>
          <div className="mb-5 flex justify-center">
              <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-40 bg-zinc-800/50 border-2 border-dashed border-zinc-700 rounded-xl flex items-center justify-center cursor-pointer hover:border-orange-500 hover:bg-zinc-800 transition-all overflow-hidden relative group"
              >
                  {projectImage ? (
                      <>
                          <img src={projectImage} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-white text-sm font-medium">Change Cover</span>
                          </div>
                      </>
                  ) : (
                      <div className="flex flex-col items-center text-zinc-500 group-hover:text-zinc-400 transition-colors">
                          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3 group-hover:bg-zinc-700 transition-colors">
                            <ImageIcon size={24} />
                          </div>
                          <span className="text-sm font-medium">Add Cover Image</span>
                      </div>
                  )}
                  <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                  />
              </div>
          </div>
          
          <div className="space-y-2 mb-6">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Project Name</label>
            <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My Awesome Story"
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
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
