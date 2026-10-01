import { Asset } from '../models/story';

export const isVisualAsset = (asset: Pick<Asset, 'type'>) => asset.type === 'image' || asset.type === 'video';

/**
 * A scene's asset ids after attaching `asset`. A scene shows one image or video,
 * so a new visual replaces the current one; audio stacks. Attaching twice is a no-op.
 */
export const withAttachedAsset = (attachedIds: string[], asset: Asset, projectAssets: Asset[]): string[] => {
  if (attachedIds.includes(asset.id)) return attachedIds;
  const kept = isVisualAsset(asset)
    ? attachedIds.filter((id) => {
        const attached = projectAssets.find((a) => a.id === id);
        return !attached || !isVisualAsset(attached);
      })
    : attachedIds;
  return [...kept, asset.id];
};

/** Reads the asset id from a sidebar drag (AssetsList sets `{ type: 'asset', id }`). */
export const draggedAssetId = (dataTransfer: DataTransfer | null): string | null => {
  const json = dataTransfer?.getData('application/json');
  if (!json) return null;
  try {
    const payload = JSON.parse(json);
    return payload?.type === 'asset' && typeof payload.id === 'string' ? payload.id : null;
  } catch {
    return null;
  }
};

export const hasDraggedJson = (dataTransfer: DataTransfer | null) =>
  !!dataTransfer && Array.from(dataTransfer.types).includes('application/json');
