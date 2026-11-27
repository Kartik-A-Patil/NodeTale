import React from "react";
import { X, RefreshCcw, Volume2, VolumeX, CornerUpLeft, ScrollText, Save, Bug } from "lucide-react";

interface PlayControlsProps {
  onClose: () => void;
  onRestart: () => void;
  muted: boolean;
  onToggleMute: () => void;
  hasAudio: boolean;
  onBack: () => void;
  canGoBack: boolean;
  onOpenLog?: () => void;
  onOpenSaves?: () => void;
  debugging?: boolean;
  onToggleDebug?: () => void;
  /** Problems met so far: flagged on the debugger button while it's hidden. */
  problemCount?: number;
}

export const PlayControls: React.FC<PlayControlsProps> = ({
  onClose,
  onRestart,
  muted,
  onToggleMute,
  hasAudio,
  onBack,
  canGoBack,
  onOpenLog,
  onOpenSaves,
  debugging,
  onToggleDebug,
  problemCount = 0,
}) => {
  const round = "p-2 bg-black/20 hover:bg-black/40 backdrop-blur-sm border border-white/5 hover:border-white/10 rounded-full text-zinc-400 hover:text-zinc-100 transition-all";
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
        {onToggleDebug && (
          <button
            onClick={onToggleDebug}
            className={`relative ${round} ${debugging ? "!text-orange-400 !border-orange-500/40" : ""}`}
            title={debugging ? "Hide the debugger" : "Show the debugger: what ran, every variable, problems"}
            aria-label={problemCount && !debugging ? `Debugger, ${problemCount} problems` : "Debugger"}
            aria-pressed={!!debugging}
          >
            <Bug size={18} />
            {problemCount > 0 && !debugging && (
              <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white" aria-hidden>
                {problemCount}
              </span>
            )}
          </button>
        )}
        {onOpenLog && (
          <button onClick={onOpenLog} className={round} title="Story so far" aria-label="Story so far">
            <ScrollText size={18} />
          </button>
        )}
        {onOpenSaves && (
          <button onClick={onOpenSaves} className={round} title="Saves" aria-label="Saves">
            <Save size={18} />
          </button>
        )}
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
