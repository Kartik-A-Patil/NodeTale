import { useCallback, useMemo, useReducer, useRef } from 'react';
import { Command } from '../commands/types';

const HISTORY_LIMIT = 50;

// Command stacks live in refs, not React state: execute/undo/redo must run their
// side effect (command.execute()/undo()) as a direct imperative call, never inside
// a state updater function, since React (StrictMode in dev) can invoke updaters
// twice and would double-apply the mutation. A render counter forces a re-render
// so canUndo/canRedo stay accurate for consumers.
export function useCommandHistory() {
  const pastRef = useRef<Command[]>([]);
  const futureRef = useRef<Command[]>([]);
  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  const execute = useCallback((command: Command) => {
    command.execute();
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
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [command, ...futureRef.current];
    forceRender();
  }, []);

  const redo = useCallback(() => {
    const command = futureRef.current[0];
    if (!command) return;
    command.execute();
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
