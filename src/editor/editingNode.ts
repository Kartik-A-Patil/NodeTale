// Which node you're typing in right now (its text or its title). Live editing
// holds others' changes to that node until you're done, so nothing shifts
// under your cursor.
let current: string | null = null;
const listeners = new Set<() => void>();

export const editingNode = {
  get: () => current,
  start(id: string) { current = id; },
  /** Done typing in `id` (ignored if another node took over meanwhile). */
  stop(id: string) {
    if (current !== id) return;
    current = null;
    listeners.forEach((fn) => fn());
  },
  /** Called whenever typing stops. */
  onStop(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
};
