import React, { useState, useRef } from 'react';
import { Project, Variable, VariableType, Board, Asset } from '../types';
import { 
  Layout, 
  Database, 
  Plus, 
  Trash2,
  FolderOpen,
  Upload
} from 'lucide-react';

interface SidebarLeftProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

const SidebarLeft: React.FC<SidebarLeftProps> = ({ project, setProject }) => {
  const [activeTab, setActiveTab] = useState<'boards' | 'vars' | 'assets'>('boards');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
              const newAsset: Asset = {
                  id: `asset-${Date.now()}`,
                  name: file.name,
                  type: file.type.startsWith('image/') ? 'image' : 'audio',
                  url: event.target.result as string
              };
              setProject(prev => ({
                  ...prev,
                  assets: [...prev.assets, newAsset]
              }));
          }
      };
      reader.readAsDataURL(file);
  };

  return (
    <div className="w-64 bg-[#18181b] border-r border-[#27272a] flex flex-col h-full select-none">
      {/* Project Header */}
      <div className="h-14 border-b border-[#27272a] flex items-center px-4 gap-2">
        <div className="w-8 h-8 bg-orange-600 rounded flex items-center justify-center font-bold text-white">
          A
        </div>
        <div className="flex flex-col overflow-hidden">
             <span className="font-semibold text-sm truncate">{project.name}</span>
             <span className="text-[10px] text-zinc-500 uppercase">Single Project</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#27272a]">
        <button 
          onClick={() => setActiveTab('boards')}
          className={`flex-1 py-3 flex justify-center text-zinc-400 hover:text-white transition-colors ${activeTab === 'boards' ? 'border-b-2 border-orange-500 text-orange-500' : ''}`}
        >
          <Layout size={18} />
        </button>
        <button 
          onClick={() => setActiveTab('vars')}
          className={`flex-1 py-3 flex justify-center text-zinc-400 hover:text-white transition-colors ${activeTab === 'vars' ? 'border-b-2 border-orange-500 text-orange-500' : ''}`}
        >
          <Database size={18} />
        </button>
        <button 
          onClick={() => setActiveTab('assets')}
          className={`flex-1 py-3 flex justify-center text-zinc-400 hover:text-white transition-colors ${activeTab === 'assets' ? 'border-b-2 border-orange-500 text-orange-500' : ''}`}
        >
          <FolderOpen size={18} />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-2">
        
        {/* BOARDS LIST */}
        {activeTab === 'boards' && (
          <div className="space-y-1">
            
            {/* Boards Section */}
            <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-zinc-500 uppercase mt-2">
              <span>Boards</span>
              <button onClick={addBoard} className="hover:text-orange-500"><Plus size={14} /></button>
            </div>
            {project.boards.map(board => (
              <div 
                key={board.id}
                onClick={() => setProject(p => ({ ...p, activeBoardId: board.id }))}
                className={`group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${project.activeBoardId === board.id ? 'bg-[#27272a] text-white' : 'text-zinc-400 hover:bg-[#27272a]/50'}`}
              >
                <div className="flex items-center gap-2">
                   <Layout size={14} />
                   <span className="truncate max-w-[120px]">{board.name}</span>
                </div>
                {project.boards.length > 1 && (
                    <button onClick={(e) => deleteBoard(board.id, e)} className="opacity-0 group-hover:opacity-100 hover:text-red-500">
                        <Trash2 size={12} />
                    </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* VARIABLES LIST */}
        {activeTab === 'vars' && (
          <div className="space-y-2">
             <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-zinc-500 uppercase">
              <span>Global Variables</span>
              <button onClick={addVariable} className="hover:text-orange-500"><Plus size={14} /></button>
            </div>
            {project.variables.map((v, idx) => (
                <div key={v.id} className="bg-[#27272a] p-2 rounded text-xs space-y-2 border border-zinc-700">
                    <div className="flex items-center gap-2">
                        <input 
                            className="bg-transparent border-none text-orange-400 font-mono w-full focus:outline-none"
                            value={v.name}
                            onChange={(e) => {
                                const newVars = [...project.variables];
                                newVars[idx].name = e.target.value;
                                setProject({...project, variables: newVars});
                            }}
                        />
                         <button onClick={() => {
                             const newVars = project.variables.filter(vari => vari.id !== v.id);
                             setProject({...project, variables: newVars});
                         }} className="text-zinc-500 hover:text-red-500"><Trash2 size={12}/></button>
                    </div>
                    <div className="flex items-center gap-2">
                         <select 
                            className="bg-zinc-900 text-zinc-400 p-1 rounded border border-zinc-700"
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
                         
                         {v.type === VariableType.BOOLEAN ? (
                             <button 
                                onClick={() => {
                                    const newVars = [...project.variables];
                                    newVars[idx].value = !newVars[idx].value;
                                    setProject({...project, variables: newVars});
                                }}
                                className={`flex-1 py-1 rounded ${v.value ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}
                             >
                                 {String(v.value)}
                             </button>
                         ) : (
                             <input 
                                className="flex-1 bg-zinc-900 p-1 rounded border border-zinc-700"
                                value={String(v.value)}
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
          <div className="grid grid-cols-2 gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept="image/*"
              />
              {project.assets.map(asset => (
                  <div key={asset.id} className="relative group rounded overflow-hidden aspect-square border border-zinc-700 bg-zinc-900">
                      <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <span className="text-[10px] text-white font-mono px-1 text-center truncate w-full">{asset.name}</span>
                      </div>
                  </div>
              ))}
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded border border-zinc-700 border-dashed flex flex-col items-center justify-center text-zinc-500 hover:text-orange-500 hover:border-orange-500 transition-colors"
              >
                  <Upload size={24} />
                  <span className="text-[10px] mt-1">Upload</span>
              </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default SidebarLeft;