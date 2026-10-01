import type { ShortcutKeys } from './types';

// Every editor shortcut, in one place. The keyboard handler (via the action
// list in ProjectEditor), the command palette, menus and tooltips all read
// these, so a key is never shown in one place and bound to another.
export const KEYS = {
  undo: { key: 'z', ctrlOrCmd: true },
  redo: { key: 'z', ctrlOrCmd: true, shift: true },
  redoAlt: { key: 'y', ctrlOrCmd: true },
  delete: { key: 'Delete' },
  save: { key: 's', ctrlOrCmd: true },
  copy: { key: 'c', ctrlOrCmd: true },
  cut: { key: 'x', ctrlOrCmd: true },
  paste: { key: 'v', ctrlOrCmd: true },
  selectAll: { key: 'a', ctrlOrCmd: true },
  deselect: { key: 'Escape' },
  duplicate: { key: 'd', ctrlOrCmd: true },
  edit: { key: 'Enter' },
  editAlt: { key: 'e' },
  rename: { key: 'F2' },
  playFromHere: { key: 'Enter', ctrlOrCmd: true },
  find: { key: 'f', ctrlOrCmd: true },
  palette: { key: 'k', ctrlOrCmd: true },
  help: { key: '?', shift: true },

  toolSelect: { key: 'v' },
  toolPan: { key: 'h' },
  addScene: { key: 's' },
  addBranch: { key: 'b' },
  addJump: { key: 'j' },
  addComment: { key: 'c' },
  addSection: { key: 'g' },
  addAnnotation: { key: 'a' },

  fitView: { key: '1', shift: true },
  zoomIn: { key: '=', ctrlOrCmd: true },
  zoomOut: { key: '-', ctrlOrCmd: true },
  tidyBoard: { key: 'a', shift: true },
  minimap: { key: 'm' },
  lock: { key: 'l' },

  panelBoards: { key: 'b', alt: true },
  panelVariables: { key: 'v', alt: true },
  panelAssets: { key: 'a', alt: true },
  panelProblems: { key: 'p', alt: true },
} satisfies Record<string, ShortcutKeys>;
