import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project } from '../types';
import { 
  Layout, 
  Database, 
  FolderOpen,
  Settings,
  HelpCircle,
  ArrowLeft,
  Download,
  Edit2
} from 'lucide-react';
import { BoardsList } from './sidebar/BoardsList';
import { VariablesList } from './sidebar/VariablesList';
import { AssetsList } from './sidebar/AssetsList';
import { HelpModal } from './sidebar/HelpModal';
import { exportProject } from '../utils/projectUtils';
interface SidebarLeftProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

const SidebarLeft: React.FC<SidebarLeftProps> = ({ project, setProject }) => {
  const [activeTab, setActiveTab] = useState<'boards' | 'vars' | 'assets'>('boards');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const navigate = useNavigate();

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  };

  return (
    <div className="w-64 bg-[#18181b] border-r border-zinc-800 flex flex-col h-full select-none relative">
      {/* Project Header */}
      <div className="h-14 border-b border-zinc-800 flex items-center px-3 gap-2">
        <button 
            onClick={() => navigate('/')}
            className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-100 transition-colors"
            title="Back to Dashboard"
        >
            <ArrowLeft size={18} />
        </button>
        <div className="w-10 h-8 bg-zinc-700 border border-zinc-600 rounded-md flex items-center justify-center font-medium text-zinc-100 overflow-hidden shrink-0">
          {project.coverImage ? (
              <img src={project.coverImage} alt="Cover" className="w-full h-full object-cover" />
          ) : (
              <span>{getInitials(project.name)}</span>
          )}
        </div>
        <div className="flex flex-col overflow-hidden">
             <span className="font-semibold text-sm truncate text-zinc-200">{project.name}</span>        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        <button 
          onClick={() => setActiveTab('boards')}
          className={`flex-1 py-3 flex justify-center relative text-zinc-500 hover:text-zinc-300 transition-colors ${activeTab === 'boards' ? 'text-orange-500' : ''}`}
          title="Boards"
        >
          <Layout size={18} />
          {activeTab === 'boards' && <div className="absolute bottom-0 w-full h-[2px] bg-orange-500" />}
        </button>
        <button 
          onClick={() => setActiveTab('vars')}
          className={`flex-1 py-3 flex justify-center relative text-zinc-500 hover:text-zinc-300 transition-colors ${activeTab === 'vars' ? 'text-orange-500' : ''}`}
          title="Variables"
        >
          <Database size={18} />
          {activeTab === 'vars' && <div className="absolute bottom-0 w-full h-[2px] bg-orange-500" />}
        </button>
        <button 
          onClick={() => setActiveTab('assets')}
          className={`flex-1 py-3 flex justify-center relative text-zinc-500 hover:text-zinc-300 transition-colors ${activeTab === 'assets' ? 'text-orange-500' : ''}`}
          title="Assets"
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

      {/* Footer / Settings */}
      <div className="border-t border-zinc-800 p-2 relative">
          {showSettingsMenu && (
              <div className="absolute bottom-full left-2 right-2 mb-2 bg-zinc-800 border border-zinc-700 rounded-md shadow-xl z-50 py-1">
                  <button 
                      onClick={() => { exportProject(project); setShowSettingsMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white flex items-center gap-2"
                  >
                      <Download size={14} /> Export Project
                  </button>
                  {/* Placeholder for Rename - would need a modal */}
                  <button 
                      className="w-full text-left px-4 py-2 text-sm text-zinc-500 cursor-not-allowed flex items-center gap-2"
                      title="Coming soon"
                  >
                      <Edit2 size={14} /> Rename Project
                  </button>
              </div>
          )}

          <button 
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition-colors ${showSettingsMenu ? 'bg-zinc-800 text-zinc-100' : ''}`}
          >
              <Settings size={18} />
              <span className="text-sm">Project Settings</span>
          </button>
          <button 
              onClick={() => setShowHelpModal(true)}
              className="w-full flex items-center gap-3 px-3 py-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition-colors"
          >
              <HelpCircle size={18} />
              <span className="text-sm">Help & Shortcuts</span>
          </button>
      </div>

      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </div>
  );
};

export default SidebarLeft;
