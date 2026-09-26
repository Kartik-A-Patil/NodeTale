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

let migration: Promise<void> | null = null;

/**
 * Runs the storage migration once per page load, however many times it's
 * called (StrictMode runs App's effect twice; two concurrent migrations would
 * each rewrite the same projects). Resolves even if migration fails, so the
 * app can still start.
 */
export const runStorageMigration = (): Promise<void> => {
  if (!migration) {
    const adapter = storageInstance ?? getStorageAdapter();
    migration = adapter
      .migrate()
      .catch((err) => console.error('[Storage] Migration failed', err))
      .finally(() => { migrationComplete = true; });
  }
  return migration;
};
