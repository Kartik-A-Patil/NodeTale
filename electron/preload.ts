import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  storage: {
    saveAsset: (buffer: ArrayBuffer, name: string, preferredId?: string, mimeType?: string) => ipcRenderer.invoke('storage:save-asset', buffer, name, preferredId, mimeType),
    loadAsset: (id: string) => ipcRenderer.invoke('storage:load-asset', id),
    deleteAsset: (id: string) => ipcRenderer.invoke('storage:delete-asset', id),
    saveProject: (project: any) => ipcRenderer.invoke('storage:save-project', project),
    loadProject: (id: string) => ipcRenderer.invoke('storage:load-project', id),
    getAllProjects: () => ipcRenderer.invoke('storage:get-all-projects'),
    deleteProject: (id: string) => ipcRenderer.invoke('storage:delete-project', id),
    getAssetData: (id: string) => ipcRenderer.invoke('storage:get-asset-data', id),
  }
})
