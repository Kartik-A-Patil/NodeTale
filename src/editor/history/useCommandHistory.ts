import { useCallback, useMemo, useReducer, useRef } from 'react';
import { Command, mergeCommands } from '../commands/types';

const HISTORY_LIMIT = 50;
// Same-key commands closer together than this merge into one undo step, so a
// typing burst undoes as a whole but a later edit of the same field doesn't.
const MERGE_WINDOW_MS = 1500;

// Command stacks live in refs, not React state: execute/undo/redo must run their
// side effect (command.execute()/undo()) as a direct imperative call, never inside
// a state updater function, since React (StrictMode in dev) can invoke updaters
// twice and would double-apply the mutation. A render counter forces a re-render
// so canUndo/canRedo stay accurate for consumers.
export function useCommandHistory() {
  const pastRef = useRef<Command[]>([]);
  const futureRef = useRef<Command[]>([]);
  const lastExecuteAtRef = useRef(0);
  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  const execute = useCallback((command: Command) => {
    command.execute();
    const now = Date.now();
    const last = pastRef.current[pastRef.current.length - 1];
    const merge = !!command.mergeKey && last?.mergeKey === command.mergeKey && now - lastExecuteAtRef.current < MERGE_WINDOW_MS;
    lastExecuteAtRef.current = now;
    if (merge) {
      pastRef.current = [...pastRef.current.slice(0, -1), mergeCommands(last, command)];
      // canUndo is unchanged; only re-render if this clears a redo stack.
      if (futureRef.current.length > 0) {
        futureRef.current = [];
        forceRender();
      }
      return;
    }
    const next = [...pastRef.current, command];
    if (next.length > HISTORY_LIMIT) next.shift();
    pastRef.current = next;
    futureRef.current = [];
    forceRender();
  }, []);

  const undo = useCallback(() => {
    const command = pastRef.current[pastRef.current.length - 1];
    if (!command) return;
    command.undo();
    lastExecuteAtRef.current = 0;
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [command, ...futureRef.current];
    forceRender();
  }, []);

  const redo = useCallback(() => {
    const command = futureRef.current[0];
    if (!command) return;
    command.execute();
    lastExecuteAtRef.current = 0;
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current, command];
    forceRender();
  }, []);

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;
  // Memoized so consumers can depend on the object without re-creating their
  // callbacks every render.
  return useMemo(() => ({ execute, undo, redo, canUndo, canRedo }), [execute, undo, redo, canUndo, canRedo]);
}
