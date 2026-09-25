import { useCallback, useReducer, useRef } from "react";
import { Project } from "../types";
import { StoryRuntime } from "../core/runtime/StoryRuntime";

// Thin React wrapper around StoryRuntime (src/core/runtime/StoryRuntime.ts),
// which holds all the actual play-mode logic and has no React dependency. This
// hook's only job is to construct the runtime once per play session and
// re-render whenever an action mutates it.
export const usePlayModeLogic = (
  project: Project,
  startNodeId?: string | null
) => {
  const runtimeRef = useRef<StoryRuntime | null>(null);
  if (!runtimeRef.current) {
    runtimeRef.current = new StoryRuntime(project, startNodeId);
  }
  const runtime = runtimeRef.current;

  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  const handleOptionClick = useCallback((targetId: string) => {
    runtime.choose(targetId);
    forceRender();
  }, [runtime]);

  const goBack = useCallback(() => {
    runtime.back();
    forceRender();
  }, [runtime]);

  const restart = useCallback(() => {
    runtime.restart();
    forceRender();
  }, [runtime]);

  const getOptions = useCallback(() => runtime.getOptions(), [runtime]);

  // Cheap to compute fresh each render — no need to memoize against the
  // useReducer dispatch (which is stable and wouldn't invalidate a memo anyway).
  const state = runtime.getState();

  return {
    currentNode: state.currentNode,
    runtimeVars: state.runtimeVars,
    getOptions,
    handleOptionClick,
    restart,
    goBack,
    canGoBack: state.canGoBack,
    projectAssets: state.projectAssets,
  };
};
