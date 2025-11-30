import React, { useState } from 'react';
import { Project } from '../types';
import { 
  Layout, 
  Database, 
  FolderOpen,
} from 'lucide-react';
import { BoardsList } from './sidebar/BoardsList';
import { VariablesList } from './sidebar/VariablesList';
import { AssetsList } from './sidebar/AssetsList';

interface SidebarLeftProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

const SidebarLeft: React.FC<SidebarLeftProps> = ({ project, setProject }) => {
  const [activeTab, setActiveTab] = useState<'boards' | 'vars' | 'assets'>('boards');

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
          <BoardsList project={project} setProject={setProject} />
        )}

        {/* VARIABLES LIST */}
        {activeTab === 'vars' && (
          <VariablesList project={project} setProject={setProject} />
        )}

        {/* ASSETS LIST */}
        {activeTab === 'assets' && (
          <AssetsList project={project} setProject={setProject} />
        )}

      </div>
    </div>
  );
};

export default SidebarLeft;
