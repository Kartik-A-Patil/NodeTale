import { ShortcutKeys } from './types';

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

const KEY_LABELS: Record<string, string> = {
  Delete: 'Del',
  Escape: 'Esc',
  Enter: '↵',
  ' ': 'Space',
};

/** The keys of a shortcut in order, e.g. ["Ctrl", "Shift", "Z"] (or ⌘ ⇧ Z on macOS). */
export function shortcutParts(keys: ShortcutKeys): string[] {
  const parts: string[] = [];
  if (keys.ctrlOrCmd) parts.push(isMac ? '⌘' : 'Ctrl');
  if (keys.shift) parts.push(isMac ? '⇧' : 'Shift');
  if (keys.alt) parts.push(isMac ? '⌥' : 'Alt');
  parts.push(KEY_LABELS[keys.key] || (keys.key.length === 1 ? keys.key.toUpperCase() : keys.key));
  return parts;
}

// Display label for a shortcut, e.g. "⌘Z" on macOS / "Ctrl+Z" elsewhere.
export function formatShortcut(keys: ShortcutKeys): string {
  return shortcutParts(keys).join(isMac ? '' : '+');
}

// Whether a keyboard event matches a shortcut's key combo exactly (not just
// "at least these modifiers" — an unrelated combo sharing the same letter but
// different modifiers must not accidentally trigger it).
export function matchesShortcut(keys: ShortcutKeys, event: KeyboardEvent): boolean {
  const key = keys.key.toLowerCase();
  // With Alt/Option held, macOS reports a symbol in event.key (Alt+1 -> '¡'),
  // and Shift changes digits (Shift+1 -> '!'), so those also match on the physical key.
  const physical = /^\d$/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`;
  if (event.key.toLowerCase() !== key && !((keys.alt || keys.shift) && event.code === physical)) return false;
  const wantsCtrlOrCmd = !!keys.ctrlOrCmd;
  const hasCtrlOrCmd = event.ctrlKey || event.metaKey;
  if (hasCtrlOrCmd !== wantsCtrlOrCmd) return false;
  if (event.shiftKey !== !!keys.shift) return false;
  if (!!event.altKey !== !!keys.alt) return false;
  return true;
}
