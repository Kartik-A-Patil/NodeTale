import React, { useEffect, useMemo, useRef, useState } from "react";
import { Project, ElementNodeData, Asset } from "../models/story";
import { sanitizeHtml } from "../utils/html";
import { usePlayModeLogic } from "../hooks/usePlayMode";
import { PlayControls } from "./playmode/PlayControls";
import { DebugPanel } from "./playmode/DebugPanel";
import { MediaDisplay } from "./playmode/MediaDisplay";
import { StoryNode } from "./playmode/StoryNode";
import { PlayerStatus } from "./playmode/PlayerStatus";
import { LogPanel, SavesPanel, SaveSlot } from "./playmode/PlayPanels";
import { useLocalPref } from "../utils/localPrefs";
import { buildStoryGraph } from "../core/graph/storyGraph";

import { useAssetUrl } from "../hooks/useAssetUrl";
import { stripScriptBlocks } from "../utils/html";
import { interpolateText } from "../core/runtime/scriptInterpreter";

interface PlayModeProps {
  project: Project;
  onClose: () => void;
  startNodeId?: string | null;
  /** Leave Play Mode and select this node on the canvas. */
  onShowInEditor?: (nodeId: string) => void;
}

const FADE_MS = 600;

// Ramps volume instead of cutting: returns a cancel function.
function fadeVolume(audio: HTMLAudioElement, to: number, done?: () => void) {
  const from = audio.volume;
  const start = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / FADE_MS);
    audio.volume = from + (to - from) * t;
    if (t < 1) frame = requestAnimationFrame(tick);
    else done?.();
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

// A scene's sound. Keyed by asset id, so a sound shared by consecutive scenes
// keeps playing across them; one that ends with its scene fades out.
const AudioPlayer: React.FC<{
  assetId: string;
  legacyUrl: string;
  loop: boolean;
  delay: number;
  muted: boolean;
}> = ({ assetId, legacyUrl, loop, delay, muted }) => {
  const { url: storageUrl } = useAssetUrl(assetId, 'audio');
  const src = storageUrl || legacyUrl || null;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useEffect(() => {
    if (!src) return;
    const audio = new Audio(src);
    audio.loop = loop;
    audio.volume = 0;
    audio.muted = mutedRef.current;
    audioRef.current = audio;
    let stopFadeIn = () => {};
    const timer = setTimeout(() => {
      audio.play().catch(() => {});
      stopFadeIn = fadeVolume(audio, 1);
    }, delay);
    return () => {
      clearTimeout(timer);
      stopFadeIn();
      fadeVolume(audio, 0, () => audio.pause());
      audioRef.current = null;
    };
  }, [src, loop, delay]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  return null;
};

const PlayMode: React.FC<PlayModeProps> = ({
  project,
  onClose,
  startNodeId,
  onShowInEditor,
}) => {
  const {
    currentNode,
    runtimeVars,
    values,
    getOptions,
    handleOptionClick,
    restart,
    projectAssets,
    goBack,
    canGoBack,
    errors,
    changes,
    turn,
    rewindTo,
    restore,
    getLog,
    snapshot,
    trace,
    setValue,
  } = usePlayModeLogic(project, startNodeId);
  const [debugging, setDebugging] = useLocalPref<boolean>("nodetale:playDebug", false);
  const labels = useMemo(() => new Map(project.boards.flatMap((b) => b.nodes.map((n) => [n.id, n.data?.label || "Untitled"] as const))), [project]);

  const [muted, setMuted] = useState(false);
  const [panel, setPanel] = useState<"log" | "saves" | null>(null);
  const [slots, setSlots] = useLocalPref<(SaveSlot | null)[]>(`nodetale:saves:${project.id}`, []);
  const [foundEndings, setFoundEndings] = useLocalPref<string[]>(`nodetale:endings:${project.id}`, []);
  const endingIds = useMemo(() => buildStoryGraph(project).endings, [project]);
  const endings = { found: foundEndings.filter((id) => endingIds.includes(id)).length, total: endingIds.length };

  // Reaching an ending counts it on this device.
  const atEnding = !!currentNode && endingIds.includes(currentNode.id) && !foundEndings.includes(currentNode.id);
  useEffect(() => {
    if (atEnding && currentNode) setFoundEndings([...foundEndings, currentNode.id]);
  }, [atEnding, currentNode, foundEndings, setFoundEndings]);

  const saveTo = (i: number) => {
    const snap = snapshot();
    if (!snap) return;
    const next = [...slots];
    next[i] = { savedAt: Date.now(), sceneLabel: currentNode?.data?.label || "Untitled", snapshot: snap };
    setSlots(next);
  };
  const loadFrom = (i: number) => {
    const slot = slots[i];
    if (!slot || !restore(slot.snapshot)) return false;
    setPanel(null);
    return true;
  };
  const panels = (
    <>
      {panel === "log" && (
        <LogPanel entries={getLog()} endings={endings} onClose={() => setPanel(null)} onRewind={(i) => { rewindTo(i); setPanel(null); }} />
      )}
      {panel === "saves" && (
        <SavesPanel
          slots={slots}
          canSave={!!currentNode}
          onSave={saveTo}
          onLoad={loadFrom}
          onDelete={(i) => { const next = [...slots]; next[i] = null; setSlots(next); }}
          onClose={() => setPanel(null)}
        />
      )}
    </>
  );
  const controls = {
    onClose, onRestart: restart, muted, onToggleMute: () => setMuted(!muted), onBack: goBack, canGoBack,
    onOpenLog: () => setPanel(panel === "log" ? null : "log"),
    onOpenSaves: () => setPanel(panel === "saves" ? null : "saves"),
    debugging,
    onToggleDebug: () => setDebugging(!debugging),
    problemCount: errors.length,
  };
  const debugPanel = debugging && currentNode && (
    <DebugPanel
      variables={runtimeVars}
      errors={errors}
      trace={trace}
      currentLabel={labels.get(currentNode.id) ?? "Untitled"}
      labelOf={(id) => labels.get(id) ?? "Untitled"}
      onSetValue={setValue}
      presets={project.simulationPresets ?? []}
      onRestartWith={(values) => restart(values)}
      onShowInEditor={onShowInEditor && (() => onShowInEditor(currentNode.id))}
    />
  );

  // Esc leaves, Backspace steps back (choices/reveal keys live in StoryNode).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if (typing) return;
      if (e.key === "Escape") return panel ? setPanel(null) : onClose();
      if (panel) return;
      if (e.key === "Backspace" && canGoBack) {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goBack, canGoBack, panel]);

  if (!currentNode) {
    return (
      <div className="fixed inset-0 z-50 bg-black text-white flex items-center justify-center font-mono text-sm">
        <span className="animate-pulse">Loading...</span>
      </div>
    );
  }

  // The runtime only stops on a logic node when it has nowhere to go (no
  // matching branch, no jump target, or a loop): that is an ending, and the
  // reason is in `errors` for the debug overlay.
  if (currentNode.type !== "elementNode") {
    return (
      <div className="fixed inset-0 z-50 bg-black text-zinc-200 font-sans select-none">
        <PlayControls {...controls} hasAudio={false} />
        {debugPanel}
        <StoryNode key={`${turn}-${currentNode.id}`} label="The End" content="" options={[]} onOptionClick={handleOptionClick} hasVisual={false} paused={!!panel} />
        {panels}
      </div>
    );
  }

  const elementData = currentNode.data as ElementNodeData;

  // Assets resolution
  const assets = elementData.assets
    ? elementData.assets
        .map((id) => projectAssets.find((a) => a.id === id))
        .filter((a): a is Asset => a !== undefined)
    : [];
  const visualAsset = assets.find(
    (a) => a.type === "image" || a.type === "video"
  );
  const audioAssets = assets.filter((a) => a.type === "audio");

  // Content processing
  // Imported projects can carry arbitrary HTML; never render it unsanitized.
  const processedContent = sanitizeHtml(interpolateText(
    stripScriptBlocks(elementData.content),
    values
  ));

  return (
    <div className="fixed inset-0 z-50 bg-black text-zinc-200 font-sans select-none">
      {/* UI Layer */}
      <PlayControls {...controls} hasAudio={audioAssets.length > 0} />
      {panels}
      
      {debugPanel}
      <PlayerStatus variables={runtimeVars} changes={changes} turn={turn} />

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
               <MediaDisplay key={visualAsset.id} asset={visualAsset} />
            </div>
         )}

         {/* Story Content Area */}
         <div className={`relative h-full transition-all duration-500 ease-in-out ${visualAsset ? 'w-full md:w-1/2 bg-zinc-950/90' : 'w-full bg-black'}`}>
            <StoryNode
              key={`${turn}-${currentNode.id}`}
              label={elementData.label}
              content={processedContent}
              options={getOptions()}
              onOptionClick={handleOptionClick}
              hasVisual={!!visualAsset}
              paused={!!panel}
              endings={endings}
            />
         </div>
      </div>

      {/* Background Audio */}
      {audioAssets.map((asset) => {
        const settings = elementData.audioSettings?.[asset.id] || {
          loop: false,
          delay: 0
        };
        return (
          <AudioPlayer
            key={asset.id}
            assetId={asset.id}
            legacyUrl={asset.url}
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
