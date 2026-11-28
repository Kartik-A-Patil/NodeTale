import { it, expect } from 'vitest';
import { changedKeys, rememberBoard } from './useLiveSync';

const make = (n: number) => Array.from({ length: n }, (_, i) => ({
  id: `n${i}`, type: 'elementNode', position: { x: i * 10, y: 0 }, width: 250, height: 120,
  data: { label: `Scene ${i}`, content: `<p>${'Some story text. '.repeat(20)}</p>` },
})) as any[];

it('sends real changes only: not selection, not measured size', () => {
  let nodes = make(3);
  const known = new Map<string, string>();
  rememberBoard(nodes, [], 'b', known);
  expect(changedKeys(nodes, [], 'b', known)).toEqual([]);

  nodes = nodes.map((n, i) => (i === 0 ? { ...n, selected: true, width: 251.4, height: 97 } : n));
  expect(changedKeys(nodes, [], 'b', known)).toEqual([]); // local only

  nodes = nodes.map((n, i) => (i === 1 ? { ...n, position: { x: 99, y: 5 } } : n));
  expect(changedKeys(nodes, [], 'b', known)).toEqual(['node:b:n1']);

  const fewer = nodes.filter((n) => n.id !== 'n2');
  expect(changedKeys(fewer, [], 'b', known)).toEqual(['node:b:n1', 'node:b:n2']); // moved + deleted

  // Another board's entries are left alone.
  known.set('node:other:x', '{}');
  expect(changedKeys(fewer, [], 'b', known)).not.toContain('node:other:x');
});

it('costs well under a frame on a 2,000-node board while dragging', () => {
  const nodes = make(2000);
  const edges = nodes.slice(1).map((n, i) => ({ id: `e${i}`, source: `n${i}`, target: n.id })) as any[];
  const known = new Map<string, string>();
  rememberBoard(nodes, edges, 'b', known);
  let total = 0;
  for (let f = 0; f < 120; f++) {
    nodes[5] = { ...nodes[5], position: { x: f, y: f } }; // the dragged node: a new object each frame
    const t = performance.now();
    const changed = changedKeys(nodes, edges, 'b', known);
    total += performance.now() - t;
    expect(changed).toEqual(['node:b:n5']);
  }
  const perFrame = total / 120;
  console.log(`2,000 nodes + 1,999 edges, per drag frame: ${perFrame.toFixed(2)} ms`);
  expect(perFrame).toBeLessThan(4); // a 60 fps frame is 16.7 ms
});
