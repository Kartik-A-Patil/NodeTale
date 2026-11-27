import { useEffect } from 'react';
import { EditorAction } from './types';
import { matchesShortcut } from './format';

// Wires a single global keydown listener dispatching to whichever action's
// `keys` matches — the one registry both the keyboard and the command palette
// read from (src/components/CommandPalette.tsx), so there's one place that
// knows the full shortcut surface instead of scattered listeners.
// Never while typing. Single-key shortcuts (S, B, Enter…) also stay out of
// dialogs and menus, and Enter leaves a focused button to press itself.
function shouldHandle(event: KeyboardEvent): boolean {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return true;
  if (target.closest('input, textarea, select, [contenteditable="true"]')) return false;
  const plain = !event.ctrlKey && !event.metaKey && !event.altKey;
  if (plain && target.closest('dialog, [role="dialog"], [role="menu"]')) return false;
  if (event.key === 'Enter' && target.closest('button, a')) return false;
  return true;
}

export function useShortcuts(actions: EditorAction[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!shouldHandle(event)) return;

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
