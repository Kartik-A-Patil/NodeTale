export interface ShortcutKeys {
  key: string; // KeyboardEvent.key, e.g. 'z', 'Delete', 'Escape'
  ctrlOrCmd?: boolean; // Ctrl on Windows/Linux, Cmd on macOS
  shift?: boolean;
}

// A single editor action, usable both as a keyboard shortcut (if `keys` is set)
// and as a command palette entry. One list drives both — the palette and the
// keyboard registry never fall out of sync with each other, and adding a new
// action never means updating two places.
//
// `keys` accepts one binding or several (e.g. redo is bound to both
// Ctrl/Cmd+Shift+Z and Ctrl+Y) — the palette displays only the first.
export interface EditorAction {
  id: string;
  label: string;
  category: 'Edit' | 'File' | 'Story';
  keys?: ShortcutKeys | ShortcutKeys[];
  run: () => void;
  enabled?: boolean; // defaults to true
}
