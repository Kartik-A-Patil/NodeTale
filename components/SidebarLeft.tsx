import React, { useState, useEffect, useRef } from 'react';
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
  Edit2,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { BoardsList } from './sidebar/BoardsList';
import { VariablesList } from './sidebar/VariablesList';
import { AssetsList } from './sidebar/AssetsList';
import { HelpModal } from './sidebar/HelpModal';
import { ExportProjectModal } from './ExportProjectModal';

interface SidebarLeftProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

const SidebarLeft: React.FC<SidebarLeftProps> = ({ project, setProject }) => {
  const [activeTab, setActiveTab] = useState<'boards' | 'vars' | 'assets'>('boards');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [width, setWidth] = useState(260);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const navigate = useNavigate();
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      // If we are resizing, we are dragging the right edge.
      // If the mouse is close to the left edge, collapse.
      if (e.clientX < 100) {
        setIsCollapsed(true);
        setIsResizing(false);
      } else {
        setIsCollapsed(false);
        setWidth(Math.min(Math.max(e.clientX, 200), 600));
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleTabClick = (tab: 'boards' | 'vars' | 'assets') => {
    setActiveTab(tab);
    if (isCollapsed) {
      setIsCollapsed(false);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  };

  return (
    <div 
      ref={sidebarRef}
      className="bg-[#18181b] border-r border-zinc-800 flex flex-col h-full select-none relative group"
      style={{ width: isCollapsed ? 60 : width, transition: isResizing ? 'none' : 'width 0.2s ease-in-out' }}
    >
      {/* Resize Handle */}
      <div 
        className="absolute right-[-4px] top-0 bottom-0 w-3 cursor-col-resize hover:bg-orange-500/0 z-50 flex justify-center"
        onMouseDown={startResizing}
      >
         <div className="w-[1px] h-full bg-transparent group-hover:bg-orange-500/50 transition-colors" />
      </div>

      {/* Project Header */}
      <div className={`h-14 border-b border-zinc-800 flex items-center ${isCollapsed ? 'justify-center flex-col gap-1' : 'px-3 gap-2'} transition-all overflow-hidden`}>
        {isCollapsed ? (
             <button 
                onClick={() => navigate('/')}
                className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-100 transition-colors"
                title="Back to Dashboard"
            >
                <ArrowLeft size={18} />
            </button>
        ) : (
            <>
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
                <div className="flex flex-col overflow-hidden flex-1 min-w-0">
                    <span className="font-semibold text-sm truncate text-zinc-200">{project.name}</span>
                </div>
                <button onClick={toggleCollapse} className="p-1 text-zinc-500 hover:text-zinc-300">
                    <PanelLeftClose size={16} />
                </button>
            </>
        )}
      </div>

      {/* Tabs & Content */}
      {isCollapsed ? (
        <div className="flex flex-col items-center py-2 gap-2 flex-1">
             <button 
                onClick={() => handleTabClick('boards')}
                className={`p-2 rounded-md transition-colors ${activeTab === 'boards' ? 'text-orange-500 bg-zinc-800' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
                title="Boards"
            >
                <Layout size={20} />
            </button>
            <button 
                onClick={() => handleTabClick('vars')}
                className={`p-2 rounded-md transition-colors ${activeTab === 'vars' ? 'text-orange-500 bg-zinc-800' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
                title="Variables"
            >
                <Database size={20} />
            </button>
            <button 
                onClick={() => handleTabClick('assets')}
                className={`p-2 rounded-md transition-colors ${activeTab === 'assets' ? 'text-orange-500 bg-zinc-800' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
                title="Assets"
            >
                <FolderOpen size={20} />
            </button>
            
            <div className="flex-1" />
            
             <button 
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                className={`p-2 rounded-md transition-colors ${showSettingsMenu ? 'text-zinc-100 bg-zinc-800' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
                title="Settings"
            >
                <Settings size={20} />
            </button>
             <button 
                onClick={() => setShowHelpModal(true)}
                className="p-2 rounded-md transition-colors text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                title="Help"
            >
                <HelpCircle size={20} />
            </button>
             <button 
                onClick={toggleCollapse}
                className="p-2 mt-2 rounded-md transition-colors text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                title="Expand"
            >
                <PanelLeftOpen size={20} />
            </button>
        </div>
      ) : (
        <>
            {/* Tabs */}
            <div className="flex border-b border-zinc-800 shrink-0">
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
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 min-w-0">
                
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
            <div className="border-t border-zinc-800 p-2 relative shrink-0">
                {showSettingsMenu && (
                    <div className="absolute bottom-full left-2 right-2 mb-2 bg-zinc-800 border border-zinc-700 rounded-md shadow-xl z-50 py-1">
                        <button 
                            onClick={() => { setShowExportModal(true); setShowSettingsMenu(false); }}
                            className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white flex items-center gap-2"
                        >
                            <Download size={14} /> Export Project
                        </button>
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
                    <span className="text-sm truncate">Project Settings</span>
                </button>
                <button 
                    onClick={() => setShowHelpModal(true)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition-colors"
                >
                    <HelpCircle size={18} />
                    <span className="text-sm truncate">Help & Shortcuts</span>
                </button>
            </div>
        </>
      )}

      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
      <ExportProjectModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} project={project} />
    </div>
  );
};

export default SidebarLeft;
