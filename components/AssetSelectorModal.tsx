import React, { useState } from 'react';
import { Project, Asset } from '../types';
import { 
  Folder as FolderIcon,
  FolderOpen,
  FileVideo,
  FileAudio,
  Image as ImageIcon,
  ChevronRight,
  ChevronDown,
  X
} from 'lucide-react';

interface AssetSelectorModalProps {
  project: Project;
  currentAssets: string[];
  onSelect: (asset: Asset) => void;
  onClose: () => void;
}

export const AssetSelectorModal: React.FC<AssetSelectorModalProps> = ({ project, currentAssets, onSelect, onClose }) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const renderTree = (parentId: string | null, depth: number = 0) => {
    const folders = (project.folders || []).filter(f => f.parentId === parentId);
    const assets = project.assets.filter(a => a.parentId === parentId);

    return (
      <div className="flex flex-col gap-0.5">
        {folders.map(folder => {
          const isExpanded = expandedFolders.has(folder.id);
          return (
            <div key={folder.id} className="select-none">
              <div 
                className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-zinc-800/50 cursor-pointer text-zinc-400 hover:text-zinc-200"
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={() => toggleFolder(folder.id)}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {isExpanded ? <FolderOpen size={14} className="text-orange-500/80" /> : <FolderIcon size={14} className="text-orange-500/80" />}
                <span className="text-xs truncate flex-1 font-medium">{folder.name}</span>
              </div>
              {isExpanded && renderTree(folder.id, depth + 1)}
            </div>
          );
        })}
        {assets.map(asset => {
          const isAlreadyAdded = currentAssets.includes(asset.id);
          const isVisual = asset.type === 'image' || asset.type === 'video';
          const hasVisual = currentAssets.some(id => {
            const a = project.assets.find(pa => pa.id === id);
            return a && (a.type === 'image' || a.type === 'video');
          });
          const isDisabled = isAlreadyAdded || (isVisual && hasVisual);
          
          return (
            <div 
              key={asset.id} 
              className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-zinc-400 ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-800/50 hover:text-zinc-200'}`}
              style={{ paddingLeft: `${depth * 12 + 24}px` }}
              onClick={() => {
                if (!isDisabled) {
                  onSelect(asset);
                  onClose();
                }
              }}
            >
              {asset.type === 'video' && <FileVideo size={14} className="text-blue-400 shrink-0" />}
              {asset.type === 'audio' && <FileAudio size={14} className="text-purple-400 shrink-0" />}
              {asset.type === 'image' && <ImageIcon size={14} className="text-green-400 shrink-0" />}
              <span className="text-xs truncate flex-1">{asset.name}</span>
              {isAlreadyAdded && <span className="text-xs text-zinc-500">(Added)</span>}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#18181b] border border-zinc-800 rounded-lg w-96 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200">Select Asset</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {renderTree(null)}
          {project.assets.length === 0 && (!project.folders || project.folders.length === 0) && (
            <div className="flex flex-col items-center justify-center h-32 text-zinc-600">
              <span className="text-xs">No assets available</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
