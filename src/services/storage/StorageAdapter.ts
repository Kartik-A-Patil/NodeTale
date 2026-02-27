import { Project } from '../../types';

/**
 * Union type for file data handling.
 * - Browser uses File or Blob.
 * - Electron uses Buffer (bridged).
 */
export type FileOrBlob = File | Blob;

export interface StorageAdapter {
  // Asset Management
  /**
   * Saves an asset to the underlying storage.
   * @param file FileOrBlob - The file data to save.
   * @param preferredId string - (Optional) Use this exact string as the Asset ID
   *   instead of generating a random UUID. Required when importing/rehydrating
   *   assets that must keep their original ID to preserve node references.
   * @returns Promise<string> - The Asset ID (either generated or the preferred one).
   * Note: No deduplication is performed. Random UUIDs are generated for every save unless preferredId is given.
   */
  saveAsset(file: FileOrBlob, preferredId?: string): Promise<string>;

  /**
   * Loads an asset URL for display directly in the UI (e.g., <img src="...">).
   * @param id string - The Asset ID.
   * @returns Promise<string> - A URL string (e.g., "blob:..." or "file://...").
   * @throws Error if asset does not exist.
   * 
   * Contract:
   * - URLs are ephemeral (valid only for the current session).
   * - Caller should NOT persist these URLs to storage.
   * - Caller must assume the URL may be revoked if high memory usage occurs.
   * - **URL Ownership**: Caller owns the returned URL and is responsible for calling releaseAssetUrl when done.
   * @param typeHint string - (Optional) Asset type hint ('image', 'audio', 'video', or MIME type)
   *   for platforms that need it (e.g., Electron's custom protocol).
   */
  loadAsset(id: string, typeHint?: string): Promise<string>;

  /**
   * Explicitly releases an asset URL to free memory.
   * Primarily for Blob URLs in the browser. Safe to call on file:// URLs (no-op).
   * @param url string - The URL returned by loadAsset.
   */
  releaseAssetUrl(url: string): void;

  /**
   * Deletes an asset from storage.
   * @param id string - The Asset ID.
   */
  deleteAsset(id: string): Promise<void>;
  
  // Project Management
  /**
   * Saves a project to storage.
   * Contract: 
   * - Overwrite semantics (replaces existing project with same ID).
   * - Electron implementation must use atomic writes (write to temp then rename) to prevent corruption.
   * @param project Project - The project object to save.
   */
  saveProject(project: Project): Promise<void>;
  
  /**
   * Loads a project by ID.
   * @param id string - The Project ID.
   * @returns Promise<Project | null> - Returns null if project not found.
   */
  loadProject(id: string): Promise<Project | null>;

  /**
   * Retrieves all available projects.
   * @returns Promise<Project[]> - List of projects.
   */
  getAllProjects(): Promise<Project[]>;

  /**
   * Deletes a project by ID.
   * @param id string - The Project ID.
   */
  deleteProject(id: string): Promise<void>;
  
  // Migration
  /**
   * Checks for storage version and performs necessary migrations (e.g., Base64 -> Blob).
   * Contract: 
   * - Must run exactly once on application startup.
   * - Must complete before any project or asset is loaded.
   * - Must be safe to re-run (idempotent).
   */
  migrate(): Promise<void>;

  /**
   * Retrieves raw asset data for export (e.g., ZIP creation).
   * @param id string - The Asset ID.
   * @returns Promise<Blob> - The raw file data (Blob in browser, Buffer-wrapped Blob in Electron).
   * @throws Error if asset missing.
   */
  getAssetData(id: string): Promise<Blob>;
}
