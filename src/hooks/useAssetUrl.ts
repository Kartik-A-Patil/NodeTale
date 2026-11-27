import { useState, useEffect, useRef } from 'react';
import { getStorageAdapter } from '../services/storage';

/**
 * Hook to load an asset URL from storage by ID.
 * @param assetId - The asset ID to load.
 * @param typeHint - Optional type hint ('image', 'audio', 'video', or MIME type)
 *   for platforms that need it (e.g., Electron's custom protocol for proper Content-Type).
 */
export const useAssetUrl = (assetId: string | null | undefined, typeHint?: string) => {
  // An asset already loaded elsewhere (or by this node before it scrolled out
  // of view) shows on the first frame; the effect below still takes its reference.
  const [url, setUrl] = useState<string | null>(() => (assetId ? getStorageAdapter().peekAssetUrl(assetId, typeHint) : null));
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(() => !!assetId && url === null);
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
      if (!adapter.peekAssetUrl(assetId, typeHint)) setIsLoading(true);
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
      } catch {
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
