import { useEffect } from 'react';
import { EditorAction } from './types';
import { matchesShortcut } from './format';

// Wires a single global keydown listener dispatching to whichever action's
// `keys` matches — the one registry both the keyboard and the command palette
// read from (src/components/CommandPalette.tsx), so there's one place that
// knows the full shortcut surface instead of scattered listeners.
export function useShortcuts(actions: EditorAction[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if an input or textarea is focused (matches the prior behavior).
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      for (const action of actions) {
        if (!action.keys) continue;
        if (action.enabled === false) continue;
        const bindings = Array.isArray(action.keys) ? action.keys : [action.keys];
        if (bindings.some((k) => matchesShortcut(k, event))) {
          event.preventDefault();
          action.run();
          return;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [actions]);
}
