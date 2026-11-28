import { it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, any>();
const log: string[] = [];
vi.mock('../../src/services/storage', () => ({
  getStorageAdapter: () => ({
    getProjectSummaries: async () => [...store.values()].map((p) => ({ id: p.id, name: p.name })),
    loadProject: async (id: string) => store.get(id) ?? null,
    saveProject: async (p: any) => { log.push(`save ${p.id.length}`); store.set(p.id, p); },
    deleteProject: async (id: string) => { log.push(`delete ${id.length}`); store.delete(id); },
  }),
}));

const { shortenProjectIds, resolveProjectId } = await import('../../src/services/storageService');
const OLD = '18f30b43-fb28-434e-b40c-3bd853d6a5ce';

beforeEach(() => localStorage.clear());

it('moves UUID projects to short ids, saving before deleting, keeping links and per-project prefs', async () => {
  store.set(OLD, { id: OLD, name: 'Old', boards: [], assets: [], variables: [], folders: [], activeBoardId: '' });
  store.set('k3x9q2ab7d', { id: 'k3x9q2ab7d', name: 'New', boards: [], assets: [], variables: [], folders: [], activeBoardId: '' });
  localStorage.setItem(`nodetale:saves:${OLD}`, JSON.stringify([{ sceneLabel: 'Hall' }]));
  localStorage.setItem('nodetale:lastOpened', JSON.stringify({ [OLD]: 5 }));

  await Promise.all([shortenProjectIds(), shortenProjectIds()]); // StrictMode double call

  const ids = [...store.keys()];
  expect(ids).toHaveLength(2);
  expect(ids.every((id) => id.length === 10)).toBe(true);
  expect(log).toEqual(['save 10', 'delete 36']);
  const moved = resolveProjectId(OLD);
  expect(store.get(moved).name).toBe('Old');
  expect(JSON.parse(localStorage.getItem(`nodetale:saves:${moved}`)!)).toEqual([{ sceneLabel: 'Hall' }]);
  expect(JSON.parse(localStorage.getItem('nodetale:lastOpened')!)[moved]).toBe(5);
  expect(resolveProjectId('k3x9q2ab7d')).toBe('k3x9q2ab7d');
});
