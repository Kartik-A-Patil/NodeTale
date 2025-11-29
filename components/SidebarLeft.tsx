import React, { useState, useRef } from 'react';
import { Project, Variable, VariableType, Board, Asset, Folder } from '../types';
import { 
  Layout, 
  Database, 
  Plus, 
  Trash2,
  X,
  Folder as FolderIcon,
  FolderOpen,
  Upload,
  FileVideo,
  FileAudio,
  Image as ImageIcon,
  ChevronRight,
  ChevronDown
} from 'lucide-react';

interface SidebarLeftProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

const SidebarLeft: React.FC<SidebarLeftProps> = ({ project, setProject }) => {
  const [activeTab, setActiveTab] = useState<'boards' | 'vars' | 'assets'>('boards');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [draggedItem, setDraggedItem] = useState<{type: 'asset' | 'folder', id: string} | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRename = (id: string, newName: string, type: 'board' | 'folder' | 'asset') => {
    if (!newName.trim()) {
        setEditingId(null);
        return;
    }
    
    if (type === 'board') {
      setProject(prev => ({
        ...prev,
        boards: prev.boards.map(b => b.id === id ? { ...b, name: newName } : b)
      }));
    } else if (type === 'folder') {
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

  const addVariable = () => {
    const newVar: Variable = {
      id: `var-${Date.now()}`,
      name: 'new_variable',
      type: VariableType.BOOLEAN,
      value: false
    };
    setProject(prev => ({
      ...prev,
      variables: [...prev.variables, newVar]
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          if (event.target?.result) {
              let type: 'image' | 'audio' | 'video' = 'image';
              if (file.type.startsWith('audio/')) type = 'audio';
              if (file.type.startsWith('video/')) type = 'video';

              const newAsset: Asset = {
                  id: `asset-${Date.now()}`,
                  name: file.name,
                  type,
                  url: event.target.result as string,
                  parentId: null // Upload to root by default
              };
              setProject(prev => ({
                  ...prev,
                  assets: [...prev.assets, newAsset]
              }));
          }
      };
      reader.readAsDataURL(file);
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
                              className={`flex items-center gap-1 px-2 py-1.5 rounded hover:bg-zinc-800/50 cursor-pointer text-zinc-400 hover:text-zinc-200 ${draggedItem?.id === folder.id ? 'opacity-50' : ''}`}
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
                  </div>
              ))}
          </div>
      );
  };

  return (
    <div className="w-64 bg-[#18181b] border-r border-zinc-800 flex flex-col h-full select-none">
      {/* Project Header */}
      <div className="h-14 border-b border-zinc-800 flex items-center px-4 gap-3">
        <div className="w-8 h-8 bg-orange-600 rounded-md flex items-center justify-center font-bold text-white">
          A
        </div>
        <div className="flex flex-col overflow-hidden">
             <span className="font-semibold text-sm truncate text-zinc-200">{project.name}</span>
             <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Single Project</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        <button 
          onClick={() => setActiveTab('boards')}
          className={`flex-1 py-3 flex justify-center relative text-zinc-500 hover:text-zinc-300 transition-colors ${activeTab === 'boards' ? 'text-orange-500' : ''}`}
        >
          <Layout size={18} />
          {activeTab === 'boards' && <div className="absolute bottom-0 w-full h-[2px] bg-orange-500" />}
        </button>
        <button 
          onClick={() => setActiveTab('vars')}
          className={`flex-1 py-3 flex justify-center relative text-zinc-500 hover:text-zinc-300 transition-colors ${activeTab === 'vars' ? 'text-orange-500' : ''}`}
        >
          <Database size={18} />
          {activeTab === 'vars' && <div className="absolute bottom-0 w-full h-[2px] bg-orange-500" />}
        </button>
        <button 
          onClick={() => setActiveTab('assets')}
          className={`flex-1 py-3 flex justify-center relative text-zinc-500 hover:text-zinc-300 transition-colors ${activeTab === 'assets' ? 'text-orange-500' : ''}`}
        >
          <FolderOpen size={18} />
          {activeTab === 'assets' && <div className="absolute bottom-0 w-full h-[2px] bg-orange-500" />}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-2">
        
        {/* BOARDS LIST */}
        {activeTab === 'boards' && (
          <div className="space-y-1">
            
            {/* Boards Section */}
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
                           onBlur={(e) => handleRename(board.id, e.target.value, 'board')}
                           onKeyDown={(e) => {
                               if (e.key === 'Enter') handleRename(board.id, e.currentTarget.value, 'board');
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
        )}

        {/* VARIABLES LIST */}
        {activeTab === 'vars' && (
          <div className="space-y-0">
             <div className="flex items-center justify-between px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              <span>Global Variables</span>
              <button onClick={addVariable} className="hover:text-orange-500 transition-colors"><Plus size={14} /></button>
            </div>
            {project.variables.map((v, idx) => (
                <div key={v.id} className="group flex flex-col gap-2 px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                        <input 
                            className="bg-transparent border-none text-zinc-200 font-medium text-xs w-full focus:outline-none placeholder-zinc-600"
                            value={v.name}
                            placeholder="variable_name"
                            onChange={(e) => {
                                const newVars = [...project.variables];
                                newVars[idx].name = e.target.value;
                                setProject({...project, variables: newVars});
                            }}
                        />
                         <button onClick={() => {
                             const newVars = project.variables.filter(vari => vari.id !== v.id);
                             setProject({...project, variables: newVars});
                         }} className="text-zinc-600 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14}/></button>
                    </div>
                    <div className="flex items-center gap-2">
                         <div className="relative">
                             <select 
                                className="appearance-none bg-zinc-900 text-zinc-500 text-[10px] font-bold uppercase px-2 py-1 rounded border border-zinc-800 hover:border-zinc-700 hover:text-zinc-300 focus:outline-none cursor-pointer transition-colors"
                                value={v.type}
                                onChange={(e) => {
                                    const newVars = [...project.variables];
                                    newVars[idx].type = e.target.value as VariableType;
                                    if(e.target.value === VariableType.BOOLEAN) newVars[idx].value = false;
                                    if(e.target.value === VariableType.NUMBER) newVars[idx].value = 0;
                                    if(e.target.value === VariableType.STRING) newVars[idx].value = "";
                                    setProject({...project, variables: newVars});
                                }}
                             >
                                 <option value={VariableType.BOOLEAN}>Bool</option>
                                 <option value={VariableType.NUMBER}>Num</option>
                                 <option value={VariableType.STRING}>Str</option>
                             </select>
                         </div>
                         
                         {v.type === VariableType.BOOLEAN ? (
                             <button 
                                onClick={() => {
                                    const newVars = [...project.variables];
                                    newVars[idx].value = !newVars[idx].value;
                                    setProject({...project, variables: newVars});
                                }}
                                className={`flex-1 text-left text-xs font-mono px-2 py-1 rounded transition-colors ${v.value ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}
                             >
                                 {String(v.value)}
                             </button>
                         ) : (
                             <input 
                                className="flex-1 bg-zinc-900/50 text-zinc-300 text-xs font-mono px-2 py-1 rounded border border-transparent focus:border-zinc-700 focus:outline-none transition-colors placeholder-zinc-700"
                                value={String(v.value)}
                                placeholder="Value..."
                                type={v.type === VariableType.NUMBER ? 'number' : 'text'}
                                onChange={(e) => {
                                    const newVars = [...project.variables];
                                    newVars[idx].value = v.type === VariableType.NUMBER ? Number(e.target.value) : e.target.value;
                                    setProject({...project, variables: newVars});
                                }}
                             />
                         )}
                    </div>
                </div>
            ))}
          </div>
        )}

        {/* ASSETS LIST */}
        {activeTab === 'assets' && (
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
        )}

      </div>
    </div>
  );
};

export default SidebarLeft;