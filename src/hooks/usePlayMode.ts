import { useCallback, useReducer, useRef } from "react";
import { Project } from "../models/story";
import { StoryRuntime, PlaySnapshot } from "../core/runtime/StoryRuntime";

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

  const handleOptionClick = useCallback((edgeId: string) => {
    runtime.choose(edgeId);
    forceRender();
  }, [runtime]);

  const goBack = useCallback(() => {
    runtime.back();
    forceRender();
  }, [runtime]);

  const setValue = useCallback((name: string, value: unknown) => {
    runtime.setValue(name, value);
    forceRender();
  }, [runtime]);

  const rewindTo = useCallback((index: number) => {
    runtime.rewindTo(index);
    forceRender();
  }, [runtime]);

  const restore = useCallback((snapshot: PlaySnapshot) => {
    const ok = runtime.restore(snapshot);
    forceRender();
    return ok;
  }, [runtime]);

  const restart = useCallback((overrides?: Record<string, unknown>) => {
    runtime.restart(overrides);
    forceRender();
  }, [runtime]);

  const getOptions = useCallback(() => runtime.getOptions(), [runtime]);

  // Cheap to compute fresh each render — no need to memoize against the
  // useReducer dispatch (which is stable and wouldn't invalidate a memo anyway).
  const state = runtime.getState();

  return {
    currentNode: state.currentNode,
    runtimeVars: state.runtimeVars,
    values: state.values,
    getOptions,
    handleOptionClick,
    restart,
    goBack,
    rewindTo,
    restore,
    getLog: () => runtime.getLog(),
    snapshot: () => runtime.snapshot(),
    canGoBack: state.canGoBack,
    projectAssets: state.projectAssets,
    errors: state.errors,
    changes: state.changes,
    turn: state.turn,
    trace: state.trace,
    setValue,
  };
};
