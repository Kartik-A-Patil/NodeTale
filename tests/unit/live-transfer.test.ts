import { it, expect, vi } from 'vitest';

// The sender's media, and what the receiver saved.
const senderFiles = new Map<string, Blob>([
  ['img1', new Blob([new Uint8Array(70_000).map((_, i) => i % 251)], { type: 'image/jpeg' })],
  ['snd1', new Blob([new Uint8Array(5)], { type: 'audio/mpeg' })],
]);
const saved = new Map<string, Blob>();
vi.mock('../../src/services/storage', () => ({
  getStorageAdapter: () => ({
    getAssetData: async (id: string) => { const b = senderFiles.get(id); if (!b) throw new Error('missing'); return b; },
    saveAsset: async (blob: Blob, id: string) => { saved.set(id, blob); return id; },
  }),
}));

const { sendStory, receiveStory } = await import('../../src/services/liveShare');

// Two connected ends of an in-memory data channel.
function channelPair() {
  const make = () => ({ listeners: [] as ((e: { data: unknown }) => void)[], peer: null as any });
  const a = make(), b = make();
  a.peer = b; b.peer = a;
  const end = (self: ReturnType<typeof make>) => ({
    bufferedAmount: 0,
    bufferedAmountLowThreshold: 0,
    send(data: string | ArrayBuffer) {
      const copy = typeof data === 'string' ? data : data.slice(0);
      queueMicrotask(() => self.peer.listeners.forEach((fn: any) => fn({ data: copy })));
    },
    addEventListener(type: string, fn: any) { if (type === 'message') self.listeners.push(fn); },
    removeEventListener() {},
  });
  return [end(a), end(b)] as const;
}

it('sends a story and every media file, byte for byte, and skips files it can’t read', async () => {
  const project: any = {
    id: 'p', name: 'Demo', activeBoardId: 'b', variables: [], folders: [],
    assets: [
      { id: 'img1', name: 'hall.jpg', url: 'blob:x', type: 'image', parentId: null },
      { id: 'snd1', name: 'hum.mp3', url: '', type: 'audio', parentId: null },
      { id: 'gone', name: 'lost.mp3', url: '', type: 'audio', parentId: null },
    ],
    boards: [{ id: 'b', name: 'Main', nodes: [{ id: 's', type: 'elementNode', position: { x: 0, y: 0 }, data: { label: 'Start', content: '<p>Hi</p>', assets: ['img1'] } }], edges: [] }],
  };
  const [host, guest] = channelPair();
  const last: any[] = [];
  const got = receiveStory(guest as any, (p) => last.push(p));
  await sendStory(host as any, project, () => {});
  const story = await got;

  expect(story.name).toBe('Demo');
  expect(story.assets.every((a) => a.url === '')).toBe(true);
  expect((story.boards[0].nodes[0].data as any).assets).toEqual(['img1']);
  expect([...saved.keys()].sort()).toEqual(['img1', 'snd1']);
  expect(new Uint8Array(await saved.get('img1')!.arrayBuffer())).toEqual(new Uint8Array(await senderFiles.get('img1')!.arrayBuffer()));
  expect(saved.get('img1')!.type).toBe('image/jpeg');
  expect(last.at(-1)).toEqual({ name: 'Demo', done: 70_005, total: 70_005, files: 2, fileCount: 2 });
});
