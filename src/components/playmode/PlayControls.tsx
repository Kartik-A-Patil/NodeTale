import React from "react";
import { X, RefreshCcw, Volume2, VolumeX, CornerUpLeft } from "lucide-react";

interface PlayControlsProps {
  onClose: () => void;
  onRestart: () => void;
  muted: boolean;
  onToggleMute: () => void;
  hasAudio: boolean;
  onBack: () => void;
  canGoBack: boolean;
}

export const PlayControls: React.FC<PlayControlsProps> = ({
  onClose,
  onRestart,
  muted,
  onToggleMute,
  hasAudio,
  onBack,
  canGoBack,
}) => {
  return (
    <>
      {canGoBack && (
        <div className="absolute top-4 left-4 z-50">
          <button
            onClick={onBack}
            className="flex items-center gap-2 pl-3 pr-5 py-2 bg-black/20 hover:bg-black/40 backdrop-blur-sm border border-white/5 hover:border-white/10 rounded-full text-zinc-400 hover:text-zinc-100 transition-all"
            title="Back"
          >
            <CornerUpLeft size={24} />
            <span className="font-medium text-lg">Go Back</span>
          </button>
        </div>
      )}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        {hasAudio && (
          <button
            onClick={onToggleMute}
            className="p-2 bg-black/20 hover:bg-black/40 backdrop-blur-sm border border-white/5 hover:border-white/10 rounded-full text-zinc-400 hover:text-zinc-100 transition-all"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        )}
        <button
          onClick={onRestart}
          className="p-2 bg-black/20 hover:bg-black/40 backdrop-blur-sm border border-white/5 hover:border-white/10 rounded-full text-zinc-400 hover:text-zinc-100 transition-all"
          title="Restart"
        >
          <RefreshCcw size={18} />
        </button>
        <button
          onClick={onClose}
          className="p-2 bg-black/20 hover:bg-black/40 backdrop-blur-sm border border-white/5 hover:border-white/10 rounded-full text-zinc-400 hover:text-zinc-100 transition-all"
          title="Close"
        >
          <X size={18} />
        </button>
      </div>
    </>
  );
};
