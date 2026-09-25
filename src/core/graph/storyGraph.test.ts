import { describe, expect, it } from 'vitest';
import { Edge } from 'reactflow';
import { AppNode, Project } from '../../types';
import { buildStoryGraph, PATH_CAP } from './storyGraph';

const el = (id: string, label = id, content = ''): AppNode =>
  ({ id, type: 'elementNode', position: { x: 0, y: 0 }, data: { label, content } }) as AppNode;
const edge = (source: string, target: string, sourceHandle?: string): Edge =>
  ({ id: `${source}-${target}-${sourceHandle ?? ''}`, source, target, sourceHandle });
const project = (nodes: AppNode[], edges: Edge[], extraBoards: Project['boards'] = []): Project => ({
  id: 'p', name: 'P', activeBoardId: 'b', variables: [], assets: [], folders: [],
  boards: [{ id: 'b', name: 'Main', nodes, edges }, ...extraBoards],
} as unknown as Project);

describe('buildStoryGraph', () => {
  it('finds reachability, endings, the fork and branch membership', () => {
    const g = buildStoryGraph(project(
      [el('s', 'Start'), el('a'), el('b'), el('c'), el('end'), el('orphan')],
      [edge('s', 'a'), edge('a', 'b'), edge('a', 'c'), edge('b', 'end'), edge('c', 'end')],
    ));
    expect(g.startId).toBe('s');
    expect(g.unreachable).toEqual(['orphan']);
    expect(g.endings).toEqual(['end']);
    expect(g.forkId).toBe('a');
    expect(g.branchOf.get('s')).toBe('trunk');
    expect(g.branchOf.get('b')).toBe(0);
    expect(g.branchOf.get('c')).toBe(1);
    expect(g.branchOf.get('end')).toBe('shared');
    expect(g.pathsFromStart.get('end')).toBe(2);
    expect(g.pathsToEnd.get('s')).toBe(2);
  });

  it('marks loops as back-edges and keeps path counts finite', () => {
    const g = buildStoryGraph(project(
      [el('s', 'Start'), el('a'), el('end')],
      [edge('s', 'a'), edge('a', 's'), edge('a', 'end')],
    ));
    expect([...g.backEdges].map((l) => `${l.source}->${l.target}`)).toEqual(['a->s']);
    expect(g.pathsToEnd.get('s')).toBe(1);
  });

  it('follows condition branches by handle and reports unconnected branches as dead ends', () => {
    const cond = { id: 'c', type: 'conditionNode', position: { x: 0, y: 0 },
      data: { label: 'Check', branches: [{ id: 'yes', label: 'If', condition: 'health > 0' }, { id: 'no', label: 'Else', condition: '' }] } } as AppNode;
    const g = buildStoryGraph(project([el('s', 'Start'), cond, el('alive')], [edge('s', 'c'), edge('c', 'alive', 'yes')]));
    expect(g.out.get('c')).toEqual([{ source: 'c', target: 'alive', kind: 'branch', label: 'If health > 0' }]);
    expect(g.deadEnds).toEqual([{ nodeId: 'c', what: 'Else' }]);
    expect(g.variableUse.get('c')?.checked).toEqual(new Set(['health']));
  });

  it('follows jumps across boards', () => {
    const jump = { id: 'j', type: 'jumpNode', position: { x: 0, y: 0 }, data: { label: 'Go', jumpTargetId: 'far' } } as AppNode;
    const g = buildStoryGraph(project([el('s', 'Start'), jump], [edge('s', 'j')], [{ id: 'b2', name: 'Act II', nodes: [el('far')], edges: [] }]));
    expect(g.reachable.has('far')).toBe(true);
    expect(g.nodes.get('far')?.boardName).toBe('Act II');
    expect(g.endings).toEqual(['far']);
  });

  it('records variables set in scripts, checked in expressions and shown in text', () => {
    const g = buildStoryGraph(project(
      [el('s', 'Start', '<p>You have {{gold}} gold</p><pre>gold += 5\nkey = hasMap</pre>')], [],
    ));
    const use = g.variableUse.get('s')!;
    expect(use.shown).toEqual(new Set(['gold']));
    expect(use.set).toEqual(new Set(['gold', 'key']));
    expect(use.checked).toEqual(new Set(['gold', 'hasMap']));
  });

  it('caps path counts', () => {
    // 20 sequential diamonds -> 2^20 routes
    const nodes = [el('s', 'Start')];
    const edges: Edge[] = [];
    let prev = 's';
    for (let i = 0; i < 20; i++) {
      nodes.push(el(`l${i}`), el(`r${i}`), el(`j${i}`));
      edges.push(edge(prev, `l${i}`), edge(prev, `r${i}`), edge(`l${i}`, `j${i}`), edge(`r${i}`, `j${i}`));
      prev = `j${i}`;
    }
    expect(buildStoryGraph(project(nodes, edges)).pathsToEnd.get('s')).toBe(PATH_CAP);
  });
});
