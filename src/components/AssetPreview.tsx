import React from 'react';
import { Asset } from '../types';
import { useAssetUrl } from '../hooks/useAssetUrl';
import { FileVideo, Image as ImageIcon, Loader2 } from 'lucide-react';

interface AssetPreviewProps {
  asset: Asset;
  className?: string; // Container class
  imgClassName?: string;
}

export const AssetPreview: React.FC<AssetPreviewProps> = ({ asset, className, imgClassName }) => {
  const { url: cachedUrl, isLoading, error } = useAssetUrl(asset.id, asset.type);
  
  // Prefer cached URL (Storage), fallback to asset.url (Legacy/Remote)
  const displayUrl = cachedUrl || asset.url;

  if (isLoading && !displayUrl) {
    return (
        <div className={`flex items-center justify-center bg-zinc-800 ${className}`}>
            <Loader2 className="animate-spin text-zinc-500" size={20} />
        </div>
    );
  }

  if (!displayUrl) {
      return (
          <div className={`flex items-center justify-center bg-zinc-800 text-red-400 text-xs p-2 ${className}`}>
             Failed to load
          </div>
      );
  }

  if (asset.type === 'image') {
      return (
          <img 
            src={displayUrl} 
            alt={asset.name} 
            className={imgClassName}
          />
      );
  }

  if (asset.type === 'video') {
       return (
         <div className="relative w-full h-full">
            <video
              src={displayUrl}
              className={`pointer-events-none ${imgClassName}`}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <FileVideo size={24} className="text-white drop-shadow-md" />
            </div>
         </div>
       );
  }

  return null;
};
