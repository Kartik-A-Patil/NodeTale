import { StorageAdapter, FileOrBlob } from './StorageAdapter';
import { Project } from '../../types';

const DB_NAME = 'NodeTaleDB';
const DB_VERSION = 3;
const PROJECT_STORE = 'projects';
const ASSET_STORE = 'assets';
const STORAGE_VERSION_KEY = 'storage_version';
const CURRENT_STORAGE_VERSION = 2; // Version 2 implies Blob storage

export class WebStorageAdapter implements StorageAdapter {
  private dbPromise: Promise<IDBDatabase> | null = null;
  // Reference-counted blob URL cache: prevents premature revocation in React Strict Mode
  private urlCache: Map<string, string> = new Map();
  private urlRefCount: Map<string, number> = new Map();

  constructor() {
    // Singleton initialization could happen here or lazily
  }

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('IndexedDB error:', event);
        reject('Error opening database');
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        // Fresh install or upgrade from before v2
        if (!db.objectStoreNames.contains(PROJECT_STORE)) {
          const store = db.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
        }
        if (!db.objectStoreNames.contains(ASSET_STORE)) {
          db.createObjectStore(ASSET_STORE, { keyPath: 'id' });
        }

        // Upgrade from v2 -> v3: relax name uniqueness constraint
        if (oldVersion >= 2 && oldVersion < 3) {
          const tx = (event.target as IDBOpenDBRequest).transaction!;
          const store = tx.objectStore(PROJECT_STORE);
          if (store.indexNames.contains('name')) {
            store.deleteIndex('name');
          }
          store.createIndex('name', 'name', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };
    });

    return this.dbPromise;
  }

  async saveAsset(file: FileOrBlob, preferredId?: string): Promise<string> {
    const db = await this.initDB();
    const id = preferredId || crypto.randomUUID();
    
    // Store as Blob/File directly
    const assetRecord = {
      id,
      data: file,
      type: file.type,
      name: file instanceof File ? file.name : 'blob',
      createdAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ASSET_STORE], 'readwrite');
      const store = transaction.objectStore(ASSET_STORE);
      const request = store.put(assetRecord);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject('Error saving asset');
    });
  }

  async loadAsset(id: string, _typeHint?: string): Promise<string> {
    // Return cached URL and increment ref count
    if (this.urlCache.has(id)) {
      this.urlRefCount.set(id, (this.urlRefCount.get(id) || 0) + 1);
      return this.urlCache.get(id)!;
    }

    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ASSET_STORE], 'readonly');
      const store = transaction.objectStore(ASSET_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          reject(new Error(`Asset not found: ${id}`));
          return;
        }
        
        // Check cache again (another call may have populated it while we awaited IDB)
        if (this.urlCache.has(id)) {
          this.urlRefCount.set(id, (this.urlRefCount.get(id) || 0) + 1);
          resolve(this.urlCache.get(id)!);
          return;
        }

        const blob = result.data as Blob;
        const url = URL.createObjectURL(blob);
        this.urlCache.set(id, url);
        this.urlRefCount.set(id, 1);
        resolve(url);
      };
      
      request.onerror = () => reject('Error loading asset');
    });
  }

  releaseAssetUrl(url: string): void {
    // Find the ID for this URL
    for (const [id, cachedUrl] of this.urlCache.entries()) {
      if (cachedUrl === url) {
        const count = (this.urlRefCount.get(id) || 1) - 1;
        if (count <= 0) {
          // Last reference — actually revoke
          URL.revokeObjectURL(url);
          this.urlCache.delete(id);
          this.urlRefCount.delete(id);
        } else {
          this.urlRefCount.set(id, count);
        }
        return;
      }
    }
    // URL not in cache (already released or external) — revoke directly
    URL.revokeObjectURL(url);
  }

  async deleteAsset(id: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ASSET_STORE], 'readwrite');
      const store = transaction.objectStore(ASSET_STORE);
      const request = store.delete(id);
      
      request.onsuccess = () => {
        // Cleanup cache and ref counts
        if (this.urlCache.has(id)) {
            URL.revokeObjectURL(this.urlCache.get(id)!);
            this.urlCache.delete(id);
            this.urlRefCount.delete(id);
        }
        resolve();
      };
      request.onerror = () => reject('Error deleting asset');
    });
  }

  async saveProject(project: Project): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PROJECT_STORE], 'readwrite');
      const store = transaction.objectStore(PROJECT_STORE);
      const request = store.put(project);

      request.onsuccess = () => resolve();
      request.onerror = () => reject('Error saving project');
    });
  }

  async loadProject(idOrName: string): Promise<Project | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
       const transaction = db.transaction([PROJECT_STORE], 'readonly');
       const store = transaction.objectStore(PROJECT_STORE);
       
       // 1. Try by ID
       const request = store.get(idOrName);
       
       request.onsuccess = () => {
         if (request.result) {
            resolve(request.result);
         } else {
            // 2. Try by Name
            const index = store.index('name');
            const nameRequest = index.get(idOrName);
            
            nameRequest.onsuccess = () => {
               resolve(nameRequest.result || null);
            };
            nameRequest.onerror = () => {
               // Name lookup failed, return null (not found)
               resolve(null);
            }
         }
       };
       request.onerror = () => reject('Error loading project');
    });
  }

  async getAllProjects(): Promise<Project[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PROJECT_STORE], 'readonly');
      const store = transaction.objectStore(PROJECT_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject('Error fetching projects');
    });
  }

  async deleteProject(id: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PROJECT_STORE], 'readwrite');
      const store = transaction.objectStore(PROJECT_STORE);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject('Error deleting project');
    });
  }

  async getAssetData(id: string): Promise<Blob> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ASSET_STORE], 'readonly');
      const store = transaction.objectStore(ASSET_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        if (!request.result) {
            reject(new Error(`Asset not found: ${id}`));
            return;
        }
        resolve(request.result.data as Blob);
      };
      request.onerror = () => reject('Error getting asset data');
    });
  }

  async migrate(): Promise<void> {
     // Check localized version flag
     const storedVersion = parseInt(localStorage.getItem(STORAGE_VERSION_KEY) || '0', 10);
     
     if (storedVersion >= CURRENT_STORAGE_VERSION) {
         return;
     }

     console.log('[WebStorageAdapter] Starting migration to version', CURRENT_STORAGE_VERSION);

     // Migration: Convert Base64 assets in Projects to Blob Assets in AssetStore
     const projects = await this.getAllProjects();
     
     for (const project of projects) {
         let projectUpdated = false;

         // Migrate Project Assets (Base64 data URLs → Blob storage)
         if (project.assets) {
             for (const asset of project.assets) {
                 if (asset.url && asset.url.startsWith('data:')) {
                    try {
                        const blob = await (await fetch(asset.url)).blob();
                        // Save with the EXISTING ID to preserve references in nodes
                        await this.saveLegacyAssetWithId(asset.id, blob, asset.name || 'migrated');
                        asset.url = ''; 
                        projectUpdated = true;
                    } catch (e) {
                        console.error('Failed to migrate asset', asset.id, e);
                    }
                 }
             }
         }

         if (projectUpdated) {
             await this.saveProject(project);
         }
     }

     localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_STORAGE_VERSION.toString());
     console.log('[WebStorageAdapter] Migration complete.');
  }

  // Helper for migration to keep IDs stable
  private async saveLegacyAssetWithId(id: string, file: Blob, name: string): Promise<void> {
    const db = await this.initDB();
    const assetRecord = {
        id,
        data: file,
        type: file.type,
        name: name,
        createdAt: Date.now()
    };
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([ASSET_STORE], 'readwrite');
        const store = transaction.objectStore(ASSET_STORE);
        const request = store.put(assetRecord);
        request.onsuccess = () => resolve();
        request.onerror = () => reject('Error storing legacy asset');
    });
  }
}
