import { StorageAdapter } from './StorageAdapter';
import { WebStorageAdapter } from './WebStorageAdapter';
// Conditional import - tree-shaken in web build when VITE_PLATFORM !== 'electron'
import { ElectronStorageAdapter } from './ElectronStorageAdapter';

let storageInstance: StorageAdapter | null = null;
let migrationComplete = false;

const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).electron;
};

/**
 * Gets the singleton instance of the StorageAdapter.
 * Initializes it if it doesn't exist.
 */
export const getStorageAdapter = (): StorageAdapter => {
  if (storageInstance) {
    if (!migrationComplete) {
      console.warn('[Storage] Adapter accessed before migration completed');
    }
    return storageInstance;
  }

  if (isElectron()) {
    console.log('[Storage] Initializing Electron Adapter');
    storageInstance = new ElectronStorageAdapter();
  } else {
    console.log('[Storage] Initializing Web Adapter');
    storageInstance = new WebStorageAdapter();
  }

  return storageInstance;
};

/**
 * Call after migrate() resolves to suppress pre-migration warnings.
 */
export const markMigrationComplete = () => { migrationComplete = true; };
