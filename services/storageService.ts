import { Project } from '../types';
import { INITIAL_PROJECT } from '../constants';

const DB_NAME = 'NodeTaleDB';
const DB_VERSION = 2; // Increment version for schema changes if needed

const STORE_NAME = 'projects';
const ASSET_STORE = 'assets';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', event);
      reject('Error opening database');
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: true });
      }
      if (!db.objectStoreNames.contains(ASSET_STORE)) {
        db.createObjectStore(ASSET_STORE, { keyPath: 'id' });
      }
    };
  });
}

// Asset CRUD for IndexedDB
export const saveAsset = async (asset: any): Promise<void> => {
  try {
    const db = await initDB();
    const transaction = db.transaction([ASSET_STORE], 'readwrite');
    const store = transaction.objectStore(ASSET_STORE);
    const request = store.put(asset);
    return new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        console.error('Error saving asset to IndexedDB', request.error);
        reject('Error saving asset');
      };
    });
  } catch (error) {
    console.error('Error saving asset:', error);
  }
};

export const loadAsset = async (id: string): Promise<any | null> => {
  try {
    const db = await initDB();
    const transaction = db.transaction([ASSET_STORE], 'readonly');
    const store = transaction.objectStore(ASSET_STORE);
    const request = store.get(id);
    return new Promise<any | null>((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        reject('Error loading asset');
      };
    });
  } catch (error) {
    console.error('Error loading asset:', error);
    return null;
  }
};

export const loadAllAssets = async (): Promise<any[]> => {
  try {
    const db = await initDB();
    const transaction = db.transaction([ASSET_STORE], 'readonly');
    const store = transaction.objectStore(ASSET_STORE);
    const request = store.getAll();
    return new Promise<any[]>((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => {
        reject('Error loading assets');
      };
    });
  } catch (error) {
    console.error('Error loading assets:', error);
    return [];
  }
};

export const saveProject = async (project: Project): Promise<void> => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(project); // Uses keyPath 'id'

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        console.error('[StorageService] ✗ Error saving project to IndexedDB', request.error);
        reject('Error saving project');
      };
    });
  } catch (error) {
    console.error('[StorageService] ✗ Exception saving project:', error);
    throw error;
  }
};

export const loadProject = async (projectIdOrName: string): Promise<Project | null> => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    // Try loading by ID first
    let request = store.get(projectIdOrName);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        if (request.result) {
            const project = request.result as Project;
            resolve(project);
        } else {
            // If not found by ID, try finding by name
            const index = store.index('name');
            const nameRequest = index.get(projectIdOrName);
            nameRequest.onsuccess = () => {
                const project = nameRequest.result as Project;
                resolve(project || null);
            };
            nameRequest.onerror = () => {
                console.error('[StorageService] ✗ Error loading project by name');
                reject('Error loading project by name');
            }
        }
      };
      request.onerror = () => {
        console.error('[StorageService] ✗ Error loading project from IndexedDB', request.error);
        reject('Error loading project');
      };
    });
  } catch (error) {
    console.error('[StorageService] ✗ Exception loading project:', error);
    return null;
  }
};

export const getAllProjects = async (): Promise<Project[]> => {
    try {
        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                resolve(request.result as Project[] || []);
            };
            request.onerror = () => {
                reject('Error loading all projects');
            };
        });
    } catch (error) {
        console.error('Error getting all projects:', error);
        return [];
    }
};

export const deleteProject = async (projectId: string): Promise<void> => {
    try {
        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(projectId);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve();
            request.onerror = () => reject('Error deleting project');
        });
    } catch (error) {
        console.error('Error deleting project:', error);
    }
};

export const checkProjectNameExists = async (name: string): Promise<boolean> => {
    try {
        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('name');
        const request = index.getKey(name);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                resolve(request.result !== undefined);
            };
            request.onerror = () => {
                reject('Error checking project name');
            };
        });
    } catch (error) {
        console.error('Error checking project name:', error);
        return false;
    }
};

