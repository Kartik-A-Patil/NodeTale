import { useState, useEffect, useRef } from 'react';
import { getStorageAdapter } from '../services/storage';

/**
 * Hook to load an asset URL from storage by ID.
 * @param assetId - The asset ID to load.
 * @param typeHint - Optional type hint ('image', 'audio', 'video', or MIME type)
 *   for platforms that need it (e.g., Electron's custom protocol for proper Content-Type).
 */
export const useAssetUrl = (assetId: string | null | undefined, typeHint?: string) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const currentUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!assetId) {
      setUrl(null);
      setError(null);
      return;
    }

    let cancelled = false;
    let retryCount = 0;
    const adapter = getStorageAdapter();

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await adapter.loadAsset(assetId, typeHint);
        if (cancelled) {
          adapter.releaseAssetUrl(result);
          return;
        }
        // Release previous URL before setting new one
        if (currentUrlRef.current) {
          adapter.releaseAssetUrl(currentUrlRef.current);
        }
        currentUrlRef.current = result;
        setUrl(result);
      } catch (err) {
        if (!cancelled && retryCount < 1) {
          retryCount++;
          setTimeout(load, 500);
          return;
        }
        if (!cancelled) {
          console.debug(`[useAssetUrl] Failed to load asset ${assetId}`);
          setError('Failed to load asset');
          setUrl(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (currentUrlRef.current) {
        adapter.releaseAssetUrl(currentUrlRef.current);
        currentUrlRef.current = null;
      }
    };
  }, [assetId, typeHint]);

  return { url, error, isLoading };
};
