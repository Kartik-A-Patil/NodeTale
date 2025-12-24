import React, { useState } from 'react';
import { Project } from '../types';
import { exportProjectAsZip } from '../utils/projectUtils';
import { X, Download, FileArchive } from 'lucide-react';

interface ExportProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

export const ExportProjectModal: React.FC<ExportProjectModalProps> = ({ isOpen, onClose, project }) => {
  const [includeAssets, setIncludeAssets] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportProjectAsZip(project, includeAssets);
      onClose();
    } catch (error) {
      console.error("Export failed:", error);
      // Maybe show error toast?
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Download size={20} /> Export Project
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <p className="text-zinc-400 text-sm">
            Export your project as a ZIP archive. You can choose to include all assets (images, audio, video) or export just the project structure.
          </p>
          
          <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-md border border-zinc-700/50 cursor-pointer" onClick={() => setIncludeAssets(!includeAssets)}>
            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${includeAssets ? 'bg-orange-500 border-orange-500' : 'border-zinc-600 bg-zinc-800'}`}>
              {includeAssets && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </div>
            <div className="flex-1">
              <span className="text-zinc-200 font-medium block">Include Assets</span>
              <span className="text-zinc-500 text-xs block">
                {includeAssets 
                  ? "All assets will be included in the ZIP (larger file size)." 
                  : "Assets will be excluded (smaller file size)."}
              </span>
            </div>
            <FileArchive size={20} className="text-zinc-500" />
          </div>
          
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3">
             <p className="text-blue-400 text-xs">
                The export will be a <strong>.zip</strong> file containing <code>Project.json</code> and an <code>assets</code> folder (if selected).
             </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-zinc-800 bg-zinc-900/50">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExporting ? 'Exporting...' : 'Export ZIP'}
          </button>
        </div>
      </div>
    </div>
  );
};
