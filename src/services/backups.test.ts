import { it, expect, vi, beforeEach } from 'vitest';

const saved = new Map<string, any>();
vi.mock('./storageService', async (original) => ({
  ...(await original<typeof import('./storageService')>()),
  saveProject: async (p: any) => { saved.set(p.id, p); },
  deleteProject: async (id: string) => { saved.delete(id); },
}));
const { backUp, markSynced, editedSinceSession } = await import('./backups');

const story = (label = 'Start'): any => ({
  id: 'story1', name: 'Mystery', activeBoardId: 'b', variables: [], assets: [], folders: [],
  boards: [{ id: 'b', name: 'Main', edges: [], nodes: [{ id: 's', type: 'elementNode', position: { x: 0, y: 0 }, data: { label, content: '' } }] }],
});

beforeEach(() => { saved.clear(); localStorage.clear(); });

it('keeps one backup per story, replacing the previous one', async () => {
  const first = await backUp(story(), 'before live session');
  expect(first.name).toMatch(/^Mystery \(before live session, /);
  expect(first.id).not.toBe('story1');
  const second = await backUp(story('Changed'), 'before live session');
  expect([...saved.keys()]).toEqual([second.id]);
});

it('spots edits made alone since the last session, ignoring where you were looking', () => {
  expect(editedSinceSession(story())).toBe(true); // no session on record yet: be safe
  markSynced(story());
  expect(editedSinceSession({ ...story(), activeBoardId: 'other', modifiedAt: 99 })).toBe(false);
  expect(editedSinceSession(story('Edited alone'))).toBe(true);
});
