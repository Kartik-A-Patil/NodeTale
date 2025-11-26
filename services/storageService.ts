import { Project } from '../types';
import { INITIAL_PROJECT } from '../constants';

const DB_NAME = 'NodeTaleDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const PROJECT_KEY = 'currentProject';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', event);
      reject('Error opening database');
    };

    request.onsuccess = (event) => {
      console.log('IndexedDB opened successfully');
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      console.log('IndexedDB upgrade needed');
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

export const saveProject = async (project: Project): Promise<void> => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(project, PROJECT_KEY);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log('Project saved to IndexedDB');
        resolve();
      };
      request.onerror = () => {
        console.error('Error saving project to IndexedDB', request.error);
        reject('Error saving project');
      };
    });
  } catch (error) {
    console.error('Error saving project:', error);
  }
};

export const loadProject = async (): Promise<Project | null> => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(PROJECT_KEY);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log('Project loaded from IndexedDB', request.result);
        resolve(request.result as Project || null);
      };
      request.onerror = () => {
        console.error('Error loading project from IndexedDB', request.error);
        reject('Error loading project');
      };
    });
  } catch (error) {
    console.error('Error loading project:', error);
    return null;
  }
};
