import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 p-6 rounded-xl w-96 border border-zinc-800 shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-zinc-100">
                <Keyboard size={24} className="text-orange-500" />
                Keyboard Shortcuts
            </h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X size={20} />
            </button>
        </div>
        
        <div className="space-y-3 text-sm text-zinc-300">
            <div className="flex justify-between items-center p-2 rounded-lg hover:bg-zinc-800/50 transition-colors">
                <span>Undo</span>
                <span className="bg-zinc-800 border border-zinc-700 px-2 py-1 rounded text-xs font-mono text-zinc-400">Ctrl+Z</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg hover:bg-zinc-800/50 transition-colors">
                <span>Redo</span>
                <span className="bg-zinc-800 border border-zinc-700 px-2 py-1 rounded text-xs font-mono text-zinc-400">Ctrl+Y</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg hover:bg-zinc-800/50 transition-colors">
                <span>Delete Node</span>
                <span className="bg-zinc-800 border border-zinc-700 px-2 py-1 rounded text-xs font-mono text-zinc-400">Delete</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg hover:bg-zinc-800/50 transition-colors">
                <span>Multi-Select</span>
                <span className="bg-zinc-800 border border-zinc-700 px-2 py-1 rounded text-xs font-mono text-zinc-400">Ctrl+Click</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg hover:bg-zinc-800/50 transition-colors">
                <span>Pan Canvas</span>
                <span className="bg-zinc-800 border border-zinc-700 px-2 py-1 rounded text-xs font-mono text-zinc-400">Space+Drag</span>
            </div>
        </div>
        
        <div className="mt-8 flex justify-end">
            <button 
                onClick={onClose}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white text-sm font-medium transition-colors"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
};
