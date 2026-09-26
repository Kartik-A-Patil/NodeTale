import JSZip from 'jszip';
import { Project } from '../types';
import { getStorageAdapter } from './storage';
import { saveProject, checkProjectNameExists } from './storageService';
import { shrinkCoverImage } from '../utils/coverImage';

// Creating projects from outside the editor: the bundled example story and
// imported .json / .zip files. Each resolves with the saved project.

const uniqueName = async (base: string, suffix: (n: number) => string): Promise<string> => {
  if (!(await checkProjectNameExists(base))) return base;
  for (let n = 1; ; n++) {
    const candidate = suffix(n);
    if (!(await checkProjectNameExists(candidate))) return candidate;
  }
};

export async function createExampleProject(): Promise<Project> {
  // Use document.baseURI for reliable resolution in all environments
  // (file:// in Electron prod, http:// in dev/web)
  const baseUrl = new URL('./', document.baseURI).href;

  const res = await fetch(`${baseUrl}assets/Example_Project/Project.json`);
  if (!res.ok) throw new Error('Could not load Example Project');
  const project = await res.json();

  const adapter = getStorageAdapter();
  const assetsBaseUrl = `${baseUrl}assets/Example_Project/`;

  // 1. Process Assets and 2. Cover Image, all fetched concurrently
  const assetPromises = (project.assets || []).map(async (asset: any) => {
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
  // The cover is stored as a thumbnail-sized data URL; the shipped file is
  // a full-resolution PNG.
  const coverPromise = (async () => {
      if (!project.coverImage || project.coverImage.startsWith('data:')) return;
      const coverRes = await fetch(assetsBaseUrl + project.coverImage);
      project.coverImage = coverRes.ok ? await shrinkCoverImage(await coverRes.blob()) : '';
  })();
  await Promise.all([...assetPromises, coverPromise]);

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
             } catch {
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

  const newProject: Project = {
    ...project,
    id: crypto.randomUUID(),
    name: await uniqueName(project.name || 'Example Project', (n) => `Example Project (${n})`),
  };
  await saveProject(newProject);
  return newProject;
}

export async function importProjectFile(file: File): Promise<Project> {
  if (file.name.toLowerCase().endsWith('.zip')) return importZipProject(file);
  const importedProject = JSON.parse(await file.text()) as Project;
  if (!importedProject.boards || !importedProject.name) throw new Error('This file is not a NodeTale project');
  return finalizeAndSaveImportedProject(importedProject);
}

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
  // Parallel: each asset is an independent unzip + IndexedDB write.
  await Promise.all(project.assets.map(async (asset) => {
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
  }));
};

const rehydrateCoverFromZip = async (project: Project, zip: JSZip) => {
  if (project.coverImage && !project.coverImage.startsWith('data:')) {
    const normalized = project.coverImage.startsWith('/') ? project.coverImage.slice(1) : project.coverImage;
    const file = zip.file(normalized);
    project.coverImage = file ? await shrinkCoverImage(await file.async('blob')) : '';
  }
};

const rehydrateEmbeddedImages = async (project: Project, zip: JSZip) => {
  const embeddedRegex = /src=["'](embedded\/[^"']+)["']/g;

  for (const board of project.boards) {
    for (const node of board.nodes) {
      const nodeData = node.data as { content?: string };
      const content = nodeData?.content;
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
      nodeData.content = newContent;
    }
  }
};

const importZipProject = async (file: File): Promise<Project> => {
  const zip = await JSZip.loadAsync(file);
  const projectFile = zip.file('Project.json');
  if (!projectFile) throw new Error('Project.json not found in ZIP');

  const projectJson = await projectFile.async('string');
  const importedProject = JSON.parse(projectJson) as Project;

  if (!importedProject.boards || !importedProject.name) {
    throw new Error('Invalid project format');
  }

  await Promise.all([
    rehydrateAssetsFromZip(importedProject, zip),
    rehydrateCoverFromZip(importedProject, zip),
    rehydrateEmbeddedImages(importedProject, zip),
  ]);

  return finalizeAndSaveImportedProject(importedProject);
};

const finalizeAndSaveImportedProject = async (importedProject: Project): Promise<Project> => {
  // Unique name without losing board/node references
  const newName = await uniqueName(importedProject.name, (n) =>
    n === 1 ? `${importedProject.name} (Imported)` : `${importedProject.name} (Imported ${n})`
  );

  const newProject: Project = {
    ...importedProject,
    id: crypto.randomUUID(),
    name: newName,
  };

  await saveProject(newProject);
  return newProject;
};
