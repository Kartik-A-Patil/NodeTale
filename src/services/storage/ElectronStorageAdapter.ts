import { StorageAdapter, FileOrBlob } from './StorageAdapter';
import { Project } from '../../types';

// Declare global augmentation for window.electron
declare global {
  interface Window {
    electron: {
      storage: {
        saveAsset(buffer: ArrayBuffer, name: string, preferredId?: string, mimeType?: string): Promise<string>;
        loadAsset(id: string): Promise<string>; // Returns path
        deleteAsset(id: string): Promise<void>;
        saveProject(project: Project): Promise<void>;
        loadProject(id: string): Promise<Project | null>;
        getAllProjects(): Promise<Project[]>;
        deleteProject(id: string): Promise<void>;
        getAssetData(id: string): Promise<ArrayBuffer>;
      }
    }
  }
}

export class ElectronStorageAdapter implements StorageAdapter {
  constructor() {
    if (!window.electron) {
        throw new Error('Electron API not available');
    }
  }

  async saveAsset(file: FileOrBlob, preferredId?: string): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const name = file instanceof File ? file.name : 'blob';
    // Pass MIME type so the main process can write a .meta sidecar
    const mimeType = file.type || undefined;
    return await window.electron.storage.saveAsset(arrayBuffer, name, preferredId, mimeType);
  }

  async loadAsset(id: string, typeHint?: string): Promise<string> {
    // No IPC needed — the asset:// protocol handler resolves the file directly
    // Encode type hint in query string so protocol handler can set correct Content-Type
    const base = `asset://${encodeURIComponent(id)}`;
    return typeHint ? `${base}?type=${encodeURIComponent(typeHint)}` : base;
  }

  releaseAssetUrl(url: string): void {
    // No-op for file:// URLs
  }

  async deleteAsset(id: string): Promise<void> {
    return await window.electron.storage.deleteAsset(id);
  }

  async saveProject(project: Project): Promise<void> {
    return await window.electron.storage.saveProject(project);
  }

  async loadProject(id: string): Promise<Project | null> {
    return await window.electron.storage.loadProject(id);
  }

  async getAllProjects(): Promise<Project[]> {
    return await window.electron.storage.getAllProjects();
  }

  async deleteProject(id: string): Promise<void> {
    return await window.electron.storage.deleteProject(id);
  }

  async migrate(): Promise<void> {
    // No legacy data to migrate on Electron currently.
    // When schema changes are needed, implement version-checked migration here.
    console.log('[ElectronStorageAdapter] Migration check complete (no-op).');
  }

  async getAssetData(id: string): Promise<Blob> {
    const buffer = await window.electron.storage.getAssetData(id);
    // Create a Blob from the ArrayBuffer
    return new Blob([buffer]);
  }
}
