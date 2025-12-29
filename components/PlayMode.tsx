import React, { useEffect, useState } from "react";
import { Project } from "../types";
import { replaceVariablesInText } from "../services/logicService";
import { usePlayModeLogic } from "../hooks/usePlayMode";
import { PlayControls } from "./playmode/PlayControls";
import { DebugOverlay } from "./playmode/DebugOverlay";
import { MediaDisplay } from "./playmode/MediaDisplay";
import { StoryNode } from "./playmode/StoryNode";

interface PlayModeProps {
  project: Project;
  onClose: () => void;
  startNodeId?: string | null;
}

const AudioPlayer: React.FC<{
  src: string;
  loop: boolean;
  delay: number;
  muted: boolean;
}> = ({ src, loop, delay, muted }) => {
  const [shouldPlay, setShouldPlay] = useState(delay === 0);

  useEffect(() => {
    setShouldPlay(delay === 0);
    if (delay > 0) {
      const timer = setTimeout(() => {
        setShouldPlay(true);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [delay, src]);

  if (!shouldPlay) return null;

  return <audio src={src} autoPlay loop={loop} muted={muted} />;
};

const PlayMode: React.FC<PlayModeProps> = ({
  project,
  onClose,
  startNodeId,
}) => {
  const {
    currentNode,
    runtimeVars,
    getOptions,
    handleOptionClick,
    restart,
    projectAssets,
    goBack,
    canGoBack,
  } = usePlayModeLogic(project, startNodeId);

  const [muted, setMuted] = useState(false);

  if (!currentNode) {
    return (
      <div className="fixed inset-0 z-50 bg-black text-white flex items-center justify-center font-mono text-sm">
        <span className="animate-pulse">Loading...</span>
      </div>
    );
  }

  // Don't render content for logic nodes, they should flicker past instantly.
  const isLogicNode =
    currentNode.type === "conditionNode" || currentNode.type === "jumpNode";

  if (isLogicNode) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center text-zinc-600 font-mono text-xs">
        <span className="animate-pulse">Processing Logic...</span>
        <button
          onClick={onClose}
          className="mt-4 hover:text-zinc-400 underline transition-colors"
        >
          Force Exit
        </button>
      </div>
    );
  }

  // Assets resolution
  const assets = currentNode.data.assets
    ? currentNode.data.assets
        .map((id) => projectAssets.find((a) => a.id === id))
        .filter(Boolean)
    : [];
  const visualAsset = assets.find(
    (a) => a.type === "image" || a.type === "video"
  );
  const audioAssets = assets.filter((a) => a.type === "audio");

  // Content processing
  const processedContent = replaceVariablesInText(
    currentNode.data.content,
    runtimeVars
  );

  return (
    <div className="fixed inset-0 z-50 bg-black text-zinc-200 font-sans select-none">
      {/* UI Layer */}
      <PlayControls 
        onClose={onClose} 
        onRestart={restart} 
        muted={muted}
        onToggleMute={() => setMuted(!muted)}
        hasAudio={audioAssets.length > 0}
        onBack={goBack}
        canGoBack={canGoBack}
      />
      
      <DebugOverlay variables={runtimeVars} />

      {/* Main Content Layout */}
      <div className="flex h-full w-full">
         {/* 
            If visual asset exists: 
            - Left 50%: Content (StoryNode)
            - Right 50%: Visual (MediaDisplay)
            
            If NO visual asset:
            - Center: Content (StoryNode)
         */}
         
         {/* Visual Asset Area (Right side when present) */}
         {visualAsset && (
            <div className="absolute right-0 top-0 w-1/2 h-full hidden md:block pointer-events-none">
               <MediaDisplay asset={visualAsset} />
            </div>
         )}

         {/* Story Content Area */}
         <div className={`relative h-full transition-all duration-500 ease-in-out ${visualAsset ? 'w-full md:w-1/2 bg-zinc-950/90' : 'w-full bg-black'}`}>
            <StoryNode
              label={currentNode.data.label}
              content={processedContent}
              options={getOptions()}
              onOptionClick={handleOptionClick}
              hasVisual={!!visualAsset}
            />
         </div>
      </div>

      {/* Background Audio */}
      {audioAssets.map((asset) => {
        const settings = currentNode.data.audioSettings?.[asset.id] || {
          loop: false,
          delay: 0
        };
        return (
          <AudioPlayer
            key={asset.id}
            src={asset.url}
            loop={settings.loop}
            delay={settings.delay}
            muted={muted}
          />
        );
      })}

      {/* Global Styles for dynamic content */}
      <style>{`
        .play-content blockquote { 
            border-left: 3px solid #f97316; 
            padding-left: 16px; 
            font-style: italic; 
            color: #d4d4d8; 
            margin: 16px 0; 
            background: linear-gradient(to right, rgba(249, 115, 22, 0.05), transparent);
            padding: 8px 16px;
        }
        .play-content pre { 
            background: #18181b; 
            padding: 8px; 
            border-radius: 4px; 
            font-family: 'JetBrains Mono', monospace; 
            border: 1px solid #27272a; 
            color: #a1a1aa; 
            margin: 8px 0; 
            font-size: 0.7em;
            white-space: pre-wrap;
        }
        .play-content ul { 
            list-style-type: disc; 
            padding-left: 24px; 
            margin: 8px 0; 
            color: #d4d4d8;
        }
        .play-content .text-blue-400 { color: #60a5fa; font-weight: 600; }
        .play-content .text-white { color: #e4e4e7; }
        .play-content .text-zinc-400 { color: #a1a1aa; }
        .play-content .text-purple-400 { color: #c084fc; }
      `}</style>
    </div>
  );
};

export default PlayMode;
