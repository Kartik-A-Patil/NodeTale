import { describe, expect, it } from 'vitest';
import { Node, Edge } from 'reactflow';
import { computeBoardHash } from './contentHash';

const node = (id: string, data: object, position = { x: 0, y: 0 }): Node =>
  ({ id, type: 'elementNode', data, position } as Node);

describe('computeBoardHash', () => {
  it('produces the same hash for identical content', () => {
    const nodes: Node[] = [node('a', { label: 'A' })];
    const edges: Edge[] = [];
    expect(computeBoardHash(nodes, edges)).toBe(computeBoardHash(nodes, edges));
  });

  it('changes when a node\'s content changes', () => {
    const before = computeBoardHash([node('a', { label: 'A' })], []);
    const after = computeBoardHash([node('a', { label: 'B' })], []);
    expect(before).not.toBe(after);
  });

  it('ignores injected render context (variables/projectAssets)', () => {
    const plain = computeBoardHash([node('a', { label: 'A' })], []);
    const wrapped = computeBoardHash([node('a', { label: 'A', variables: [{ name: 'x' }], projectAssets: [{ id: 'img' }] })], []);
    expect(wrapped).toBe(plain);
  });

  it('changes when a node moves (position-only edit)', () => {
    const before = computeBoardHash([node('a', { label: 'A' }, { x: 0, y: 0 })], []);
    const after = computeBoardHash([node('a', { label: 'A' }, { x: 10, y: 0 })], []);
    expect(before).not.toBe(after);
  });

  it('is unaffected by node array order', () => {
    const a = node('a', { label: 'A' });
    const b = node('b', { label: 'B' });
    expect(computeBoardHash([a, b], [])).toBe(computeBoardHash([b, a], []));
  });

  it('does not recompute the hash of an unchanged node object', () => {
    const a = node('a', { label: 'A' });
    const h1 = computeBoardHash([a], []);
    const h2 = computeBoardHash([a], []);
    expect(h1).toBe(h2);
  });

  it('ignores transient ReactFlow-only fields (selected/dragging/positionAbsolute)', () => {
    const base = node('a', { label: 'A' });
    const selected: Node = { ...base, selected: true, dragging: true, positionAbsolute: { x: 5, y: 5 }, resizing: true } as Node;
    expect(computeBoardHash([base], [])).toBe(computeBoardHash([selected], []));
  });

  it('ignores transient edge selection state', () => {
    const edgeBase: Edge = { id: 'e1', source: 'a', target: 'b' };
    const edgeSelected: Edge = { ...edgeBase, selected: true };
    expect(computeBoardHash([], [edgeBase])).toBe(computeBoardHash([], [edgeSelected]));
  });
});
