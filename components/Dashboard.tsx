import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, FolderOpen, Sparkles } from 'lucide-react';
import { getAllProjects, saveProject, deleteProject, checkProjectNameExists } from '../services/storageService';
import { Project } from '../types';
import { INITIAL_PROJECT } from '../constants';
import { DashboardBackground } from './dashboard/DashboardBackground';
import { ProjectCard } from './dashboard/ProjectCard';
import { CreateProjectModal } from './dashboard/CreateProjectModal';
import { DeleteProjectModal } from './dashboard/DeleteProjectModal';

export const Dashboard = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectImage, setNewProjectImage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
    const handleClickOutside = () => setActiveMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const loadProjects = async () => {
    const loadedProjects = await getAllProjects();
    setProjects(loadedProjects);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newProjectName.trim()) {
      setError('Project name is required');
      return;
    }

    const exists = await checkProjectNameExists(newProjectName);
    if (exists) {
      setError('Project name already exists');
      return;
    }

    const newBoardId = crypto.randomUUID();
    const newProject: Project = {
      ...INITIAL_PROJECT,
      id: crypto.randomUUID(),
      name: newProjectName,
      boards: [{ ...INITIAL_PROJECT.boards[0], id: newBoardId }], // Ensure unique board ID
      activeBoardId: newBoardId, // Set active board to the new board ID
      coverImage: newProjectImage || undefined
    };
    
    console.log('[Dashboard] Creating project:', newProject.name, 'Active Board ID:', newProject.activeBoardId, 'Boards:', newProject.boards.length, 'Board nodes:', newProject.boards[0].nodes.length, 'Board edges:', newProject.boards[0].edges.length);

    await saveProject(newProject);
    await loadProjects();
    setIsCreating(false);
    setNewProjectName('');
    setNewProjectImage(null);
    navigate(`/${newProject.name}`);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectToDelete(id);
    setShowDeleteModal(true);
    setActiveMenu(null);
  };

  const confirmDelete = async () => {
    if (projectToDelete) {
      await deleteProject(projectToDelete);
      loadProjects();
      setShowDeleteModal(false);
      setProjectToDelete(null);
    }
  };

  const handleDuplicate = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    let newName = `${project.name} (Copy)`;
    let counter = 1;
    while (await checkProjectNameExists(newName)) {
      counter++;
      newName = `${project.name} (Copy ${counter})`;
    }

    const newProject: Project = {
      ...project,
      id: crypto.randomUUID(),
      name: newName,
    };

    await saveProject(newProject);
    loadProjects();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedProject = JSON.parse(event.target?.result as string) as Project;
        
        // Validate basic structure
        if (!importedProject.boards || !importedProject.name) {
            throw new Error("Invalid project format");
        }

        // Ensure unique name
        let newName = importedProject.name;
        if (await checkProjectNameExists(newName)) {
            newName = `${newName} (Imported)`;
            let counter = 1;
            while (await checkProjectNameExists(newName)) {
                counter++;
                newName = `${importedProject.name} (Imported ${counter})`;
            }
        }

        const newProject = {
            ...importedProject,
            id: crypto.randomUUID(), // Always give a new ID to avoid conflicts
            name: newName
        };

        await saveProject(newProject);
        loadProjects();
      } catch (err) {
        alert('Failed to import project: ' + err);
      }
    };
    reader.readAsText(file);
  };

  const handleCoverImageUpdate = async (projectId: string, file: File) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
          const base64 = event.target?.result as string;
          const project = projects.find(p => p.id === projectId);
          if (project) {
              const updatedProject = { ...project, coverImage: base64 };
              await saveProject(updatedProject);
              loadProjects();
          }
      };
      reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-[#121212] text-zinc-100 p-8 relative overflow-hidden">
      <DashboardBackground />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/20">
                <FolderOpen className="text-white" size={24} />
            </div>
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">My Projects</h1>
                <p className="text-zinc-400 text-sm mt-1">Manage your interactive stories and flows</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <label className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800/80 hover:bg-zinc-700 backdrop-blur-sm border border-zinc-700/50 rounded-lg cursor-pointer transition-all hover:scale-105 active:scale-95 text-sm font-medium">
              <Upload size={16} />
              Import
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
            <button 
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 rounded-lg transition-all hover:scale-105 active:scale-95 shadow-lg shadow-orange-900/20 text-sm font-medium"
            >
              <Plus size={18} />
              New Project
            </button>
          </div>
        </div>

        <CreateProjectModal 
            isOpen={isCreating}
            onClose={() => setIsCreating(false)}
            onSubmit={handleCreateProject}
            projectName={newProjectName}
            setProjectName={setNewProjectName}
            projectImage={newProjectImage}
            setProjectImage={setNewProjectImage}
            error={error}
            setError={setError}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard 
                key={project.id}
                project={project}
                onClick={() => navigate(`/${project.name}`)}
                onDelete={(e) => handleDelete(project.id, e)}
                onDuplicate={(e) => handleDuplicate(project, e)}
                onCoverImageUpdate={(file) => handleCoverImageUpdate(project.id, file)}
                isMenuOpen={activeMenu === project.id}
                onToggleMenu={(e) => {
                    e.stopPropagation();
                    setActiveMenu(activeMenu === project.id ? null : project.id);
                }}
            />
          ))}
          
          {projects.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-32 text-zinc-500 border-2 border-dashed border-zinc-800/50 rounded-2xl bg-zinc-900/20 backdrop-blur-sm">
              <div className="w-20 h-20 bg-zinc-800/50 rounded-full flex items-center justify-center mb-6 animate-pulse">
                  <Sparkles size={32} className="text-orange-500/50" />
              </div>
              <h3 className="text-xl font-semibold text-zinc-300 mb-2">No projects yet</h3>
              <p className="text-zinc-500 mb-8 max-w-md text-center">
                  Start creating your interactive story by clicking the "New Project" button above, or import an existing one.
              </p>
              <button 
                  onClick={() => setIsCreating(true)}
                  className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                  <Plus size={18} /> Create First Project
              </button>
            </div>
          )}
        </div>

        <DeleteProjectModal 
            isOpen={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            onConfirm={confirmDelete}
        />
      </div>
    </div>
  );
};


