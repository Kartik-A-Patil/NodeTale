import React from "react";
import { Asset } from "../../types";

interface MediaDisplayProps {
  asset?: Asset;
}

export const MediaDisplay: React.FC<MediaDisplayProps> = ({ asset }) => {
  if (!asset) return null;

  if (asset.type === "image") {
    return (
      <div className="w-full h-full relative bg-black/20">
        <img
          src={asset.url}
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
          src={asset.url}
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
