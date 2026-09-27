import { describe, expect, it } from 'vitest';
import { Edge, Node } from 'reactflow';
import { Project } from '../../types';
import { computeResolvedEdgeLabels, EdgeLabelCache } from './resolvedEdgeLabels';

const el = (id: string, label: string, x = 0): Node => ({ id, type: 'elementNode', position: { x, y: 0 }, data: { label } });
const cond = (id: string): Node =>
  ({ id, type: 'conditionNode', position: { x: 0, y: 0 }, data: { label: 'Check', branches: [{ id: 'yes', label: 'If', condition: 'hasKey == true' }, { id: 'no', label: 'Else', condition: '' }] } });
const jump = (id: string, targetId?: string): Node => ({ id, type: 'jumpNode', position: { x: 0, y: 0 }, data: { label: 'Jump', jumpTargetId: targetId } });
const edge = (id: string, source: string, target: string, sourceHandle?: string): Edge => ({ id, source, target, sourceHandle });

const project = (): Project => ({
  id: 'p', name: 'P', activeBoardId: 'b', assets: [], folders: [],
  variables: [{ id: 'k', name: 'hasKey', type: 'boolean', value: true }],
  boards: [{ id: 'b', name: 'Main', nodes: [], edges: [] }],
} as unknown as Project);

describe('computeResolvedEdgeLabels', () => {
  it('leaves an edge into a plain scene untouched', () => {
    const nodes = [el('a', 'A'), el('b', 'B')];
    const edges = [edge('e1', 'a', 'b')];
    const result = computeResolvedEdgeLabels(nodes, edges, project(), new Map());
    expect(result[0]).toBe(edges[0]); // exact same object: nothing to add
  });

  it('leaves a branch edge (source is a condition node) untouched — it shows its own branch text elsewhere', () => {
    const nodes = [cond('c'), el('vault', 'Vault')];
    const edges = [edge('e1', 'c', 'vault', 'yes')];
    const result = computeResolvedEdgeLabels(nodes, edges, project(), new Map());
    expect(result[0]).toBe(edges[0]);
  });

  it('resolves an edge into a condition node to the scene the player actually reaches', () => {
    const nodes = [el('start', 'Start'), cond('c'), el('vault', 'Vault'), el('locked', 'Locked')];
    const edges = [edge('e1', 'start', 'c'), edge('e2', 'c', 'vault', 'yes'), edge('e3', 'c', 'locked', 'no')];
    const result = computeResolvedEdgeLabels(nodes, edges, project(), new Map());
    expect(result.find((e) => e.id === 'e1')?.data?.autoResolvedLabel).toBe('Vault');
  });

  it('resolves through a jump node the same way', () => {
    const nodes = [el('start', 'Start'), jump('j', 'far'), el('far', 'Far Away')];
    const edges = [edge('e1', 'start', 'j')];
    const result = computeResolvedEdgeLabels(nodes, edges, project(), new Map());
    expect(result.find((e) => e.id === 'e1')?.data?.autoResolvedLabel).toBe('Far Away');
  });

  it('falls back to "Untitled" on a dead end and does not throw on a cycle', () => {
    const deadEnd = computeResolvedEdgeLabels([el('start', 'Start'), jump('j')], [edge('e1', 'start', 'j')], project(), new Map());
    expect(deadEnd.find((e) => e.id === 'e1')?.data?.autoResolvedLabel).toBe('Untitled');

    const cycle = computeResolvedEdgeLabels([el('start', 'Start'), jump('j', 'j')], [edge('e1', 'start', 'j')], project(), new Map());
    expect(cycle.find((e) => e.id === 'e1')?.data?.autoResolvedLabel).toBe('Untitled');
  });

  it('keeps the exact same object across calls when nothing relevant changed — the point of the cache', () => {
    const nodes = [el('start', 'Start'), cond('c'), el('vault', 'Vault')];
    const edges = [edge('e1', 'start', 'c'), edge('e2', 'c', 'vault', 'yes')];
    const cache: EdgeLabelCache = new Map();
    const first = computeResolvedEdgeLabels(nodes, edges, project(), cache);
    // Same inputs again, e.g. a node elsewhere just moved — `edges` unchanged.
    const second = computeResolvedEdgeLabels(nodes, edges, project(), cache);
    expect(second[0]).toBe(first[0]);
  });

  it('recomputes only the edge that actually changed, reusing the other from the cache', () => {
    const nodes = [el('start', 'Start'), cond('c'), el('vault', 'Vault'), jump('j2', 'far'), el('far', 'Far')];
    const edges = [edge('e1', 'start', 'c'), edge('e2', 'start', 'j2'), edge('e3', 'c', 'vault', 'yes')];
    const cache: EdgeLabelCache = new Map();
    const first = computeResolvedEdgeLabels(nodes, edges, project(), cache);

    const editedEdges = [{ ...edges[0], style: { stroke: 'red' } }, edges[1], edges[2]];
    const second = computeResolvedEdgeLabels(nodes, editedEdges, project(), cache);
    expect(second[0]).not.toBe(first[0]); // e1 itself changed (style) -> recomputed
    expect(second[0].data?.autoResolvedLabel).toBe('Vault');
    expect(second[1]).toBe(first[1]); // e2 untouched -> reused from the cache
  });
});
