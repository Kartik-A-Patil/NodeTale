import { ShortcutKeys } from './types';

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

const KEY_LABELS: Record<string, string> = {
  Delete: 'Del',
  Escape: 'Esc',
  ' ': 'Space',
};

// Display label for a shortcut, e.g. "⌘Z" on macOS / "Ctrl+Z" elsewhere.
export function formatShortcut(keys: ShortcutKeys): string {
  const parts: string[] = [];
  if (keys.ctrlOrCmd) parts.push(isMac ? '⌘' : 'Ctrl');
  if (keys.shift) parts.push(isMac ? '⇧' : 'Shift');
  const keyLabel = KEY_LABELS[keys.key] || (keys.key.length === 1 ? keys.key.toUpperCase() : keys.key);
  parts.push(keyLabel);
  return parts.join(isMac ? '' : '+');
}

// Whether a keyboard event matches a shortcut's key combo exactly (not just
// "at least these modifiers" — an unrelated combo sharing the same letter but
// different modifiers must not accidentally trigger it).
export function matchesShortcut(keys: ShortcutKeys, event: KeyboardEvent): boolean {
  if (event.key.toLowerCase() !== keys.key.toLowerCase()) return false;
  const wantsCtrlOrCmd = !!keys.ctrlOrCmd;
  const hasCtrlOrCmd = event.ctrlKey || event.metaKey;
  if (hasCtrlOrCmd !== wantsCtrlOrCmd) return false;
  if (event.shiftKey !== !!keys.shift) return false;
  return true;
}
