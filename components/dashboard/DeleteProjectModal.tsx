import React from 'react';

interface DeleteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-zinc-900 p-6 rounded-lg w-96 border border-zinc-800 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 ease-out" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-2 text-zinc-100">Delete Project?</h2>
        <p className="text-zinc-400 mb-6 text-sm">
          Are you sure you want to delete this project? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-zinc-400 hover:text-zinc-200 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors shadow-lg shadow-red-900/20"
          >
            Delete Project
          </button>
        </div>
      </div>
    </div>
  );
};
