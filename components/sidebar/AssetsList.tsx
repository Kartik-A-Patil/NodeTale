import React, { useState, useRef } from 'react';
import { saveAsset } from '../../services/storageService';
import { Project, Asset, Folder } from '../../types';
import { 
  Folder as FolderIcon,
  FolderOpen,
  Upload,
  FileVideo,
  FileAudio,
  Image as ImageIcon,
  ChevronRight,
  ChevronDown,
  Trash
} from 'lucide-react';

interface AssetsListProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

export const AssetsList: React.FC<AssetsListProps> = ({ project, setProject }) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [draggedItem, setDraggedItem] = useState<{type: 'asset' | 'folder', id: string} | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRename = (id: string, newName: string, type: 'folder' | 'asset') => {
    if (!newName.trim()) {
        setEditingId(null);
        return;
    }
    
    if (type === 'folder') {
      setProject(prev => ({
        ...prev,
        folders: prev.folders.map(f => f.id === id ? { ...f, name: newName } : f)
      }));
    } else if (type === 'asset') {
      setProject(prev => ({
        ...prev,
        assets: prev.assets.map(a => a.id === id ? { ...a, name: newName } : a)
      }));
    }
    setEditingId(null);
  };

  const handleDelete = (type: 'folder' | 'asset', id: string) => {
    if (type === 'asset') {
      setProject(prev => ({
        ...prev,
        assets: prev.assets.filter(a => a.id !== id)
      }));
    } else if (type === 'folder') {
      const getDescendants = (folderId: string): string[] => {
        const children = (project.folders || []).filter(f => f.parentId === folderId).map(f => f.id);
        const assets = project.assets.filter(a => a.parentId === folderId).map(a => a.id);
        let all = [...children, ...assets];
        children.forEach(child => all.push(...getDescendants(child)));
        return all;
      };
      const descendants = getDescendants(id);
      setProject(prev => ({
        ...prev,
        folders: (prev.folders || []).filter(f => f.id !== id && !descendants.includes(f.id)),
        assets: prev.assets.filter(a => !descendants.includes(a.id))
      }));
    }
    setEditingId(null); // Cancel editing if deleting
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const newAssets: Asset[] = [];

      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          
          try {
              const result = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = (event) => resolve(event.target?.result as string);
                  reader.onerror = (error) => reject(error);
                  reader.readAsDataURL(file);
              });

              let type: 'image' | 'audio' | 'video' = 'image';
              if (file.type.startsWith('audio/')) type = 'audio';
              if (file.type.startsWith('video/')) type = 'video';

              const newAsset: Asset = {
                  id: `asset-${Date.now()}-${i}`,
                  name: file.name,
                  type,
                  url: result,
                  parentId: null // Upload to root by default
              };
              
              await saveAsset(newAsset);
              newAssets.push(newAsset);
          } catch (error) {
              console.error(`Failed to process file ${file.name}`, error);
          }
      }

      if (newAssets.length > 0) {
          setProject(prev => ({
              ...prev,
              assets: [...prev.assets, ...newAssets]
          }));
      }
      
      // Reset input
      if (e.target) {
          e.target.value = '';
      }
  };

  const addFolder = () => {
      const newFolder: Folder = {
          id: `folder-${Date.now()}`,
          name: 'New Folder',
          parentId: null
      };
      setProject(prev => ({
          ...prev,
          folders: [...(prev.folders || []), newFolder]
      }));
  };

  const toggleFolder = (folderId: string) => {
      setExpandedFolders(prev => {
          const next = new Set(prev);
          if (next.has(folderId)) next.delete(folderId);
          else next.add(folderId);
          return next;
      });
  };

  const handleDragStart = (e: React.DragEvent, type: 'asset' | 'folder', id: string) => {
      e.stopPropagation();
      setDraggedItem({ type, id });
      e.dataTransfer.setData('application/json', JSON.stringify({ type, id }));
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetFolderId: string | null) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!draggedItem) return;

      const { type, id } = draggedItem;

      if (type === 'folder') {
          if (id === targetFolderId) return; // Can't drop into self
          // Check for cycles (targetFolderId cannot be a descendant of id)
          let current = targetFolderId;
          while (current) {
              if (current === id) return; // Cycle detected
              const parent = project.folders.find(f => f.id === current)?.parentId;
              current = parent || null;
          }

          setProject(prev => ({
              ...prev,
              folders: prev.folders.map(f => f.id === id ? { ...f, parentId: targetFolderId } : f)
          }));
      } else {
          setProject(prev => ({
              ...prev,
              assets: prev.assets.map(a => a.id === id ? { ...a, parentId: targetFolderId } : a)
          }));
      }
      setDraggedItem(null);
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
                              className={`group flex items-center gap-1 px-2 py-1.5 rounded hover:bg-zinc-800/50 cursor-pointer text-zinc-400 hover:text-zinc-200 ${draggedItem?.id === folder.id ? 'opacity-50' : ''}`}
                              style={{ paddingLeft: `${depth * 12 + 8}px` }}
                              onClick={() => toggleFolder(folder.id)}
                              onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setEditingId(folder.id);
                              }}
                              draggable
                              onDragStart={(e) => handleDragStart(e, 'folder', folder.id)}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, folder.id)}
                          >
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              {isExpanded ? <FolderOpen size={14} className="text-orange-500/80" /> : <FolderIcon size={14} className="text-orange-500/80" />}
                              
                              {editingId === folder.id ? (
                                   <input 
                                       autoFocus
                                       className="bg-zinc-900 text-white px-1 py-0.5 rounded flex-1 min-w-0 border border-zinc-700 focus:border-orange-500 outline-none text-xs"
                                       defaultValue={folder.name}
                                       onClick={(e) => e.stopPropagation()}
                                       onBlur={(e) => handleRename(folder.id, e.target.value, 'folder')}
                                       onKeyDown={(e) => {
                                           if (e.key === 'Enter') handleRename(folder.id, e.currentTarget.value, 'folder');
                                           if (e.key === 'Escape') setEditingId(null);
                                       }}
                                   />
                               ) : (
                                   <span className="text-xs truncate flex-1 font-medium">{folder.name}</span>
                               )}
                              <button className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-colors p-1" onClick={(e) => { e.stopPropagation(); handleDelete('folder', folder.id); }}><Trash size={12} /></button>
                          </div>
                          {isExpanded && renderTree(folder.id, depth + 1)}
                      </div>
                  );
              })}
              {assets.map(asset => (
                  <div 
                      key={asset.id} 
                      className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800/50 cursor-pointer text-zinc-400 hover:text-zinc-200 group ${draggedItem?.id === asset.id ? 'opacity-50' : ''}`}
                      style={{ paddingLeft: `${depth * 12 + 24}px` }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, 'asset', asset.id)}
                      onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingId(asset.id);
                      }}
                  >
                      {asset.type === 'video' && <FileVideo size={14} className="text-blue-400 shrink-0" />}
                      {asset.type === 'audio' && <FileAudio size={14} className="text-purple-400 shrink-0" />}
                      {asset.type === 'image' && <ImageIcon size={14} className="text-green-400 shrink-0" />}
                      
                      {editingId === asset.id ? (
                           <input 
                               autoFocus
                               className="bg-zinc-900 text-white px-1 py-0.5 rounded flex-1 min-w-0 border border-zinc-700 focus:border-orange-500 outline-none text-xs"
                               defaultValue={asset.name}
                               onClick={(e) => e.stopPropagation()}
                               onBlur={(e) => handleRename(asset.id, e.target.value, 'asset')}
                               onKeyDown={(e) => {
                                   if (e.key === 'Enter') handleRename(asset.id, e.currentTarget.value, 'asset');
                                   if (e.key === 'Escape') setEditingId(null);
                               }}
                           />
                       ) : (
                           <span className="text-xs truncate flex-1">{asset.name}</span>
                       )}
                      <button className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-colors p-1" onClick={(e) => { e.stopPropagation(); handleDelete('asset', asset.id); }}><Trash size={12} /></button>
                  </div>
              ))}
          </div>
      );
  };

  return (
    <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-2 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            <span>Assets</span>
            <div className="flex gap-1">
                <button onClick={addFolder} className="hover:text-orange-500 transition-colors p-1" title="New Folder">
                    <FolderIcon size={14} />
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="hover:text-orange-500 transition-colors p-1" title="Upload File">
                    <Upload size={14} />
                </button>
            </div>
        </div>
        
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          className="hidden" 
          accept="image/*,audio/*,video/*"
          multiple
        />

        <div 
            className="flex-1 overflow-y-auto min-h-[200px]"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, null)}
        >
            {renderTree(null)}
            
            {/* Empty State */}
            {project.assets.length === 0 && (!project.folders || project.folders.length === 0) && (
                <div className="flex flex-col items-center justify-center h-32 text-zinc-600">
                    <span className="text-xs">No assets yet</span>
                </div>
            )}
        </div>
    </div>
  );
};
