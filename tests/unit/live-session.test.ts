import { it, expect, vi, beforeEach } from 'vitest';

const stored = new Map<string, Blob>();
vi.mock('../../src/services/storage', () => ({ getStorageAdapter: () => ({ saveAsset: async (b: Blob, id: string) => { stored.set(id, b); return id; } }) }));
const { LiveSession } = await import('../../src/services/liveSession');

// An in-memory channel pair. `hold` lets a test pause one direction to force message orderings.
function pair() {
  type End = any;
  function makeEnd(): any {
    const end = {
      listeners: { message: [] as any[], close: [] as any[] },
      peer: null as End | null,
      held: false,
      queue: [] as (string | ArrayBuffer)[],
      bufferedAmount: 0,
      bufferedAmountLowThreshold: 0,
      send(data: string | ArrayBuffer) { const copy = typeof data === 'string' ? data : data.slice(0); if (end.held) end.queue.push(copy); else deliver(end.peer!, copy); },
      release() { end.held = false; const q = end.queue; end.queue = []; q.forEach((d) => deliver(end.peer!, d)); },
      addEventListener(type: 'message' | 'close', fn: any) { end.listeners[type]?.push(fn); },
      removeEventListener() {},
      close() { end.listeners.close.forEach((f) => f()); end.peer!.listeners.close.forEach((f: () => void) => f()); },
    };
    return end;
  }
  const deliver = (to: End, data: string | ArrayBuffer) => to.listeners.message.forEach((fn: (e: { data: unknown }) => void) => fn({ data }));
  const a = makeEnd(), b = makeEnd();
  a.peer = b; b.peer = a;
  return [a, b] as const;
}

const story: any = { id: 'p1', name: 'Shared', boards: [], variables: [], assets: [], folders: [], activeBoardId: '' };
let host: InstanceType<typeof LiveSession>, a: InstanceType<typeof LiveSession>, b: InstanceType<typeof LiveSession>;
let hostSeen: any[], aSeen: any[], bSeen: any[];
let hostToA: ReturnType<typeof pair>, hostToB: ReturnType<typeof pair>;
// Each side's view of one entity after applying what it received.
const view = (seen: any[], key: string, local?: unknown) => { let v = local; for (const ops of seen) for (const op of ops) if (op.key === key) v = op.value; return v; };

beforeEach(async () => {
  host = new LiveSession('host', 'p1', { id: 'H', name: 'Host', color: '' });
  host.getProject = () => story;
  hostSeen = []; aSeen = []; bSeen = [];
  host.attach({ onOps: (ops) => hostSeen.push(ops) });
  hostToA = pair(); hostToB = pair();
  host.addGuest(hostToA[0] as any); host.addGuest(hostToB[0] as any);
  a = new LiveSession('guest', 'p1', { id: 'A', name: '', color: '' });
  b = new LiveSession('guest', 'p1', { id: 'B', name: '', color: '' });
  const [pa, pb] = await Promise.all([a.join(hostToA[1] as any, 'Ana'), b.join(hostToB[1] as any, 'Bo')]);
  expect(pa.name).toBe('Shared'); expect(pb.name).toBe('Shared');
  a.attach({ onOps: (ops) => aSeen.push(ops) });
  b.attach({ onOps: (ops) => bSeen.push(ops) });
});

it('welcomes guests with the story, a colour and everyone in the session', () => {
  expect(host.peers.map((p) => p.name)).toEqual(['Host', 'Ana', 'Bo']);
  expect(b.peers.map((p) => p.name)).toEqual(['Host', 'Ana', 'Bo']);
  expect(a.me.color).not.toBe(b.me.color);
});

it('passes a change to everyone else', () => {
  a.sendOps([{ key: 'node:b:n1', value: { label: 'from Ana' } }]);
  expect(view(hostSeen, 'node:b:n1')).toEqual({ label: 'from Ana' });
  expect(view(bSeen, 'node:b:n1')).toEqual({ label: 'from Ana' });
  expect(aSeen).toEqual([]); // its own change isn't applied back
});

it('converges when two guests change the same node at once', () => {
  hostToA[1].held = true; hostToB[1].held = true; // both send before either reaches the host
  a.sendOps([{ key: 'node:b:n1', value: 'A' }]);
  b.sendOps([{ key: 'node:b:n1', value: 'B' }]);
  hostToA[1].release(); hostToB[1].release(); // host gets A, then B: B wins
  const final = view(hostSeen, 'node:b:n1');
  expect(final).toBe('B');
  expect(view(aSeen, 'node:b:n1', 'A')).toBe('B');
  expect(view(bSeen, 'node:b:n1', 'B')).toBe('B');
});

it('never lets an older confirmation undo newer typing', () => {
  hostToA[0].held = true; // hold the host's replies to Ana
  a.sendOps([{ key: 'node:b:n1', value: 'Hel' }]);
  b.sendOps([{ key: 'node:b:n1', value: 'Bo was here' }]); // arrives at host after Ana's
  a.sendOps([{ key: 'node:b:n1', value: 'Hello' }]);       // Ana keeps typing
  hostToA[0].release();
  // Ana saw: echo of "Hel" (pending still "Hello"), Bo's change (ignored), echo of "Hello".
  expect(view(aSeen, 'node:b:n1', 'Hello')).toBe('Hello');
  expect(view(hostSeen, 'node:b:n1')).toBe('Hello');
  expect(view(bSeen, 'node:b:n1', 'Bo was here')).toBe('Hello');
});

it('relays media and notices people leaving', async () => {
  const file = new Blob([new Uint8Array(40_000).fill(7)], { type: 'image/png' });
  a.shareAsset('img9', file);
  await new Promise((r) => setTimeout(r, 20));
  expect(stored.get('img9')?.size).toBe(40_000);
  hostToA[1].close();
  expect(host.peers.map((p) => p.name)).toEqual(['Host', 'Bo']);
  expect(b.peers.map((p) => p.name)).toEqual(['Host', 'Bo']);
  expect(a.ended).toMatch(/lost/i); // closed without a goodbye
  expect(host.notices[0].kind).toBe('disconnected');
});

it('tells leaving and ending apart from a lost connection', async () => {
  b.end('You left the session.', true);
  await new Promise((r) => setTimeout(r, 200));
  expect(host.notices[0].kind).toBe('left');
  host.end('You ended the session.', true);
  await new Promise((r) => setTimeout(r, 200));
  expect(a.ended).toMatch(/ended/i);
});

it('ignores changes from a view-only guest, who can’t send any', async () => {
  const [hostEnd, viewerEnd] = pair();
  host.addGuest(hostEnd as any, 'view');
  const viewer = new LiveSession('guest', 'p1', { id: 'V', name: '', color: '' });
  await viewer.join(viewerEnd as any, 'Vi');
  expect(viewer.canEdit).toBe(false);
  expect(host.peers.find((p) => p.name === 'Vi')?.access).toBe('view');
  viewer.sendOps([{ key: 'node:b:n1', value: 'nope' }]);          // the viewer's own side refuses
  (viewerEnd as any).send(JSON.stringify({ t: 'op', from: 'V', seq: 1, ops: [{ key: 'node:b:n1', value: 'forced' }] })); // and the host ignores a forced one
  expect(hostSeen).toEqual([]);
  expect(aSeen).toEqual([]);
  a.sendOps([{ key: 'node:b:n2', value: 'Ana edits' }]);
  const seen: unknown[] = [];
  viewer.attach({ onOps: (ops) => seen.push(...ops) });
  a.sendOps([{ key: 'node:b:n3', value: 'more' }]);
  expect(seen).toEqual([{ key: 'node:b:n2', value: 'Ana edits' }, { key: 'node:b:n3', value: 'more' }]); // but sees everything (earlier ones handed over on attach)
});

it('groups repeated edits to one thing in the activity list', () => {
  const entry = { peerId: 'A', name: 'Ana', color: '', key: 'node:b:n1', label: 'Hall', nodeId: 'n1' };
  host.record(entry); host.record({ ...entry, label: 'Hallway' }); host.record({ ...entry, key: 'node:b:n2', label: 'Cellar' });
  expect(host.activity.map((x) => x.label)).toEqual(['Cellar', 'Hallway']);
});
