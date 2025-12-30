import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, Sparkles, ChevronDown } from 'lucide-react';
import JSZip from 'jszip';
import { getAllProjects, saveProject, deleteProject, checkProjectNameExists } from '../services/storageService';
import { Project } from '../types';
import { INITIAL_PROJECT } from '../constants';
import { DashboardBackground } from './dashboard/DashboardBackground';
import { ProjectCard } from './dashboard/ProjectCard';
import { CreateProjectModal } from './dashboard/CreateProjectModal';
import { DeleteProjectModal } from './dashboard/DeleteProjectModal';
import { RenameProjectModal } from './dashboard/RenameProjectModal';
import nodetaleLogo from '@/assets/logo.png';

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
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [projectToRename, setProjectToRename] = useState<Project | null>(null);
  const [renameProjectName, setRenameProjectName] = useState('');
  const [renameError, setRenameError] = useState('');
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProjects();
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCreateDropdown(false);
      }
      setActiveMenu(null);
    };
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

  const handleRename = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectToRename(project);
    setRenameProjectName(project.name);
    setRenameError('');
    setShowRenameModal(true);
    setActiveMenu(null);
  };

  const submitRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectToRename) return;
    setRenameError('');

    const trimmedName = renameProjectName.trim();
    if (!trimmedName) {
      setRenameError('Project name is required');
      return;
    }

    if (trimmedName !== projectToRename.name) {
      const exists = await checkProjectNameExists(trimmedName);
      if (exists) {
        setRenameError('Project name already exists');
        return;
      }
    }

    const updatedProject: Project = { ...projectToRename, name: trimmedName };
    await saveProject(updatedProject);
    await loadProjects();
    setShowRenameModal(false);
    setProjectToRename(null);
    setRenameProjectName('');
  };

  const closeRenameModal = () => {
    setShowRenameModal(false);
    setProjectToRename(null);
    setRenameProjectName('');
    setRenameError('');
  };

  const handleCreateExampleProject = async () => {
    try {
      const res = await fetch('/assets/Example_Project/Project.json');
      if (!res.ok) throw new Error('Could not load Example Project');
      const project = await res.json();
      // Patch asset URLs to correct relative path
      if (project.assets) {
        project.assets = project.assets.map((a) => ({
          ...a,
          url: a.url.replace('assets/', '/assets/Example_Project/assets/')
        }));
      }
      // Patch coverImage if present
      if (project.coverImage && !project.coverImage.startsWith('data:')) {
        project.coverImage = '/assets/Example_Project/' + project.coverImage;
      }
      // Patch embedded images in node content
      for (const board of project.boards || []) {
        for (const node of board.nodes || []) {
          if (node.data && typeof node.data.content === 'string') {
            node.data.content = node.data.content.replace(/src=["']assets\//g, 'src="/assets/Example_Project/assets/');
          }
        }
      }
      // Ensure unique name
      let newName = project.name || 'Example Project';
      let counter = 1;
      while (await checkProjectNameExists(newName)) {
        newName = `Example Project (${counter++})`;
      }
      const newProject = {
        ...project,
        id: crypto.randomUUID(),
        name: newName,
      };
      await saveProject(newProject);
      await loadProjects();
    } catch (err) {
      alert('Failed to add Example Project: ' + err);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isZip = file.name.toLowerCase().endsWith('.zip');

    if (isZip) {
      importZipProject(file)
        .then(() => loadProjects())
        .catch((err) => {
        console.error('[Dashboard] Zip import failed', err);
        alert('Failed to import project: ' + err);
        });
    } else {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const importedProject = JSON.parse(event.target?.result as string) as Project;
          await finalizeAndSaveImportedProject(importedProject);
          await loadProjects();
        } catch (err) {
          alert('Failed to import project: ' + err);
        }
      };
      reader.readAsText(file);
    }

    // Allow re-importing the same file after this run
    e.target.value = '';
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
    <div className="min-h-screen bg-[#0c0c0f] text-zinc-100 px-6 py-10 relative overflow-hidden">
      <DashboardBackground />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <header
          className="flex flex-col gap-4 mb-10 rounded-2xl border border-white/15 bg-gradient-to-br from-white/12 via-white/8 to-white/4 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.45)] ring-1 ring-white/10 px-5 py-6 sm:px-6"
          style={{ boxShadow: '0 18px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(255,255,255,0.04)' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <img src={nodetaleLogo} alt="Nodetale" className="h-12 w-auto drop-shadow-[0_6px_20px_rgba(0,0,0,0.35)]" />
            <div className="flex gap-2 sm:gap-3">
              <label className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg cursor-pointer transition-colors text-sm font-medium text-zinc-200">
                <Upload size={16} />
                Import
                <input type="file" accept=".json,.zip" onChange={handleImport} className="hidden" />
              </label>
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setShowCreateDropdown(!showCreateDropdown)}
                  className="flex items-center gap-2 px-5 py-2 bg-orange-500 hover:bg-orange-400 text-black font-semibold rounded-lg transition-colors shadow-sm"
                >
                  <Plus size={18} />
                  Create Project
                  <ChevronDown size={16} className={`transition-transform ${showCreateDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showCreateDropdown && (
                  <div className="absolute top-full mt-2 right-0 bg-[#1a1a1f] border border-white/15 rounded-lg shadow-lg py-2 min-w-[200px] z-50">
                    <button
                      onClick={() => {
                        setIsCreating(true);
                        setShowCreateDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors text-zinc-200"
                    >
                      <Plus size={16} />
                      New Project
                    </button>
                    <button
                      onClick={() => {
                        handleCreateExampleProject();
                        setShowCreateDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors text-zinc-200"
                    >
                      <Sparkles size={16} />
                      Example Project
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 px-1">
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">My Projects</h1>
            <p className="text-zinc-500 text-sm mt-1">Clean, aligned overview of your interactive stories.</p>
          </div>
          <span className="text-xs text-zinc-500 bg-white/5 px-3 py-1 rounded-full border border-white/10 self-start sm:self-auto">{projects.length} project{projects.length === 1 ? '' : 's'}</span>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => (
            <ProjectCard 
                key={project.id}
                project={project}
                onClick={() => navigate(`/${project.name}`)}
                onDelete={(e) => handleDelete(project.id, e)}
                onDuplicate={(e) => handleDuplicate(project, e)}
              onRename={(e) => handleRename(project, e)}
                onCoverImageUpdate={(file) => handleCoverImageUpdate(project.id, file)}
                isMenuOpen={activeMenu === project.id}
                onToggleMenu={(e) => {
                    e.stopPropagation();
                    setActiveMenu(activeMenu === project.id ? null : project.id);
                }}
            />
          ))}
          
          {projects.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-28 text-zinc-500 border border-dashed border-white/10 rounded-2xl bg-white/5 backdrop-blur-sm">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-5">
                  <Sparkles size={28} className="text-orange-400/70" />
              </div>
              <h3 className="text-xl font-semibold text-zinc-200 mb-2">No projects yet</h3>
              <p className="text-zinc-500 mb-8 max-w-md text-center">
                  Start a fresh board or import an existing narrative to see it here.
              </p>
              <button 
                  onClick={() => setIsCreating(true)}
                  className="px-5 py-2.5 bg-orange-500 hover:bg-orange-400 text-black font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                  <Plus size={18} /> Create first project
              </button>
            </div>
          )}
        </div>

        <DeleteProjectModal 
            isOpen={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            onConfirm={confirmDelete}
        />

        <RenameProjectModal 
            isOpen={showRenameModal}
            onClose={closeRenameModal}
            onSubmit={submitRename}
            projectName={renameProjectName}
            setProjectName={setRenameProjectName}
            error={renameError}
            setError={setRenameError}
        />
      </div>
    </div>
  );
};

// -------- Helpers for imports --------

const EXTENSION_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  webm: 'video/webm',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4a: 'audio/mp4',
};

const getMimeFromPath = (path: string) => {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return EXTENSION_MIME[ext] || 'application/octet-stream';
};

const readZipEntryAsDataUrl = async (zip: JSZip, path: string): Promise<string | null> => {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  const file = zip.file(normalized);
  if (!file) return null;
  const base64 = await file.async('base64');
  const mime = getMimeFromPath(normalized);
  return `data:${mime};base64,${base64}`;
};

const rehydrateAssetsFromZip = async (project: Project, zip: JSZip) => {
  for (const asset of project.assets) {
    if (asset.url && !asset.url.startsWith('data:')) {
      const dataUrl = await readZipEntryAsDataUrl(zip, asset.url);
      asset.url = dataUrl || '';
    }
  }
};

const rehydrateCoverFromZip = async (project: Project, zip: JSZip) => {
  if (project.coverImage && !project.coverImage.startsWith('data:')) {
    const coverUrl = await readZipEntryAsDataUrl(zip, project.coverImage);
    project.coverImage = coverUrl || '';
  }
};

const rehydrateEmbeddedImages = async (project: Project, zip: JSZip) => {
  const embeddedRegex = /src=["'](embedded\/[^"']+)["']/g;

  for (const board of project.boards) {
    for (const node of board.nodes) {
      const content = node.data?.content;
      if (typeof content !== 'string') continue;

      let newContent = content;
      let match: RegExpExecArray | null;
      while ((match = embeddedRegex.exec(content)) !== null) {
        const relPath = match[1];
        const dataUrl = await readZipEntryAsDataUrl(zip, relPath);
        if (dataUrl) {
          newContent = newContent.replace(match[0], `src="${dataUrl}"`);
        }
      }
      node.data.content = newContent;
    }
  }
};

const importZipProject = async (file: File) => {
  const zip = await JSZip.loadAsync(file);
  const projectFile = zip.file('Project.json');
  if (!projectFile) throw new Error('Project.json not found in ZIP');

  const projectJson = await projectFile.async('string');
  const importedProject = JSON.parse(projectJson) as Project;

  if (!importedProject.boards || !importedProject.name) {
    throw new Error('Invalid project format');
  }

  await rehydrateAssetsFromZip(importedProject, zip);
  await rehydrateCoverFromZip(importedProject, zip);
  await rehydrateEmbeddedImages(importedProject, zip);

  await finalizeAndSaveImportedProject(importedProject);
};

const finalizeAndSaveImportedProject = async (importedProject: Project) => {
  // Ensure unique name without losing board/node references
  let newName = importedProject.name;
  if (await checkProjectNameExists(newName)) {
    newName = `${newName} (Imported)`;
    let counter = 1;
    while (await checkProjectNameExists(newName)) {
      counter++;
      newName = `${importedProject.name} (Imported ${counter})`;
    }
  }

  const newProject: Project = {
    ...importedProject,
    id: crypto.randomUUID(),
    name: newName,
  };

  await saveProject(newProject);
  return newProject;
};


