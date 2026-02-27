import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, Sparkles, ChevronDown } from 'lucide-react';
import JSZip from 'jszip';
import { getAllProjects, saveProject, deleteProject, checkProjectNameExists } from '../services/storageService';
import { getStorageAdapter } from '../services/storage';
import { Project } from '../types';
import { INITIAL_PROJECT } from '../constants';
import { DashboardBackground } from './dashboard/DashboardBackground';
import { ProjectCard } from './dashboard/ProjectCard';
import { CreateProjectModal } from './modals/CreateProjectModal';
import { DeleteProjectModal } from './modals/DeleteProjectModal';
import { RenameProjectModal } from './modals/RenameProjectModal';
import nodetaleLogo from '../assets/logo.png';

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
      // Use document.baseURI for reliable resolution in all environments
      // (file:// in Electron prod, http:// in dev/web)
      const baseUrl = new URL('./', document.baseURI).href;
      
      const res = await fetch(`${baseUrl}assets/Example_Project/Project.json`);
      if (!res.ok) throw new Error('Could not load Example Project');
      const project = await res.json();
      
      const adapter = getStorageAdapter();
      const assetsBaseUrl = `${baseUrl}assets/Example_Project/`;

      // 1. Process Assets
      if (project.assets) {
        // Fetch and save each asset to storage
        const assetPromises = project.assets.map(async (asset: any) => {
            if (asset.url && !asset.url.startsWith('data:')) {
               const assetRes = await fetch(assetsBaseUrl + asset.url);
               if (assetRes.ok) {
                   const blob = await assetRes.blob();
                   // Save with preferredId = asset.id to maintain link
                   await adapter.saveAsset(blob, asset.id);
                   // Clear URL as it is now managed by storage
                   asset.url = ''; 
               }
            }
        });
        await Promise.all(assetPromises);
      }

      // 2. Process Cover Image
      if (project.coverImage && !project.coverImage.startsWith('data:')) {
          // If cover image is a file path, we should ideally save it as an asset too?
          // Or just keep it as is if it is a static asset?
          // Current logic expects coverImage to be base64 for now in many places, 
          // OR a URL. 
          // If we want to support it properly, we should probably save it.
          // BUT, project.coverImage is a string property, not an asset ref.
          // Let's keep existing logic for cover image for now (patching URL), 
          // assuming it works via standard img src if it points to public folder.
          // Wait, if we are in Electron, file:// won't access public folder easily if we are in a text editor?
          // Actually, built app serves from bundle.
          
          // Let's patch it to absolute path if needed, or fetch and convert to base64 if that's safer for now across platforms.
          // Fetching and converting to base64 is safest for coverImage as it is just a string property.
           const coverRes = await fetch(assetsBaseUrl + project.coverImage);
           if (coverRes.ok) {
               const blob = await coverRes.blob();
               const reader = new FileReader();
               project.coverImage = await new Promise((resolve) => {
                   reader.onload = () => resolve(reader.result as string);
                   reader.readAsDataURL(blob);
               });
           }
      }

      // 3. Process Embedded Images in Nodes
      // These are problematic. They point to `assets/...`. 
      // We should ideally extract them and save them as assets, then replace src with generic ID-based URL?
      // Or if they are simple generic images, maybe just base64 them?
      // Base64 is easiest to ensure they work everywhere immediately.
      for (const board of project.boards || []) {
        for (const node of board.nodes || []) {
          if (node.data && typeof node.data.content === 'string') {
             // scan for src="assets/..."
             const regex = /src=["'](assets\/[^"']+)["']/g;
             let content = node.data.content;
             let match;
             // We need to async replace.
             // Simplest way: find all matches, fetch them, convert to base64, replace.
             const replacements: {match: string, replacement: string}[] = [];
             
             while ((match = regex.exec(content)) !== null) {
                 const fullMatch = match[0];
                 const relativePath = match[1];
                 try {
                     const imgRes = await fetch(assetsBaseUrl + relativePath);
                     if (imgRes.ok) {
                         const blob = await imgRes.blob();
                         const base64 = await new Promise<string>((resolve) => {
                             const reader = new FileReader();
                             reader.onload = () => resolve(reader.result as string);
                             reader.readAsDataURL(blob);
                         });
                         replacements.push({ match: fullMatch, replacement: `src="${base64}"` });
                     }
                 } catch (e) {
                     console.warn('Failed to embed example image', relativePath);
                 }
             }
             
             for (const rep of replacements) {
                 content = content.replace(rep.match, rep.replacement);
             }
             node.data.content = content;
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
  const adapter = getStorageAdapter();
  for (const asset of project.assets) {
    if (asset.url && !asset.url.startsWith('data:')) {
      // It's a path in the zip (e.g. "assets/foo.png")
      const normalized = asset.url.startsWith('/') ? asset.url.slice(1) : asset.url;
      const file = zip.file(normalized);
      if (file) {
        // Read as Blob for web or ArrayBuffer for generic usage (adapter handles Blob)
        const blob = await file.async('blob');
        // Save using the SAME ID to preserve references in nodes
        await adapter.saveAsset(blob, asset.id);
        asset.url = ''; // Clear URL in model as it's now managed by storage
      }
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


