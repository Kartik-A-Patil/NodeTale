import React from "react";
import { Asset } from "../../types";
import { useAssetUrl } from "../../hooks/useAssetUrl";

interface MediaDisplayProps {
  asset?: Asset;
}

export const MediaDisplay: React.FC<MediaDisplayProps> = ({ asset }) => {
  const { url: storageUrl, isLoading } = useAssetUrl(asset?.id, asset?.type);
  
  if (!asset) return null;
  
  // Prefer storage URL, fallback to legacy asset.url
  const displayUrl = storageUrl || asset.url;
  
  if (isLoading && !displayUrl) {
    return (
      <div className="w-full h-full relative bg-black/40 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!displayUrl) return null;

  if (asset.type === "image") {
    return (
      <div className="w-full h-full relative bg-black/20">
        <img
          src={displayUrl}
          className="w-full h-full object-cover animate-in fade-in duration-700"
          alt="Scene background"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent w-full h-full" />
      </div>
    );
  }

  if (asset.type === "video") {
    return (
      <div className="w-full h-full relative bg-black/20">
        <video
          src={displayUrl}
          className="w-full h-full object-cover animate-in fade-in duration-700"
          autoPlay
          loop
          muted
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent w-full h-full" />
      </div>
    );
  }

  return null;
};
