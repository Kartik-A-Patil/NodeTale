import { describe, expect, it } from 'vitest';
import { buildProjectSummary } from './projectSummary';

const node = (id: string, type: string, x: number, y: number, label = id) => ({ id, type, position: { x, y }, data: { label } });

describe('buildProjectSummary', () => {
  const project = {
    id: 'p', name: 'Story', activeBoardId: 'b1', assets: [{}, {}],
    boards: [
      {
        id: 'b1', name: 'Main',
        nodes: [node('s', 'elementNode', 0, 0, 'Start'), node('c', 'conditionNode', 100, 50), node('end', 'elementNode', 200, 100), node('note', 'commentNode', 500, 500)],
        edges: [{ source: 's', target: 'c' }, { source: 'c', target: 'end' }],
      },
      { id: 'b2', name: 'Act II', nodes: [node('j', 'jumpNode', 0, 0)], edges: [] },
    ],
  };

  it('counts scenes and endings across boards, ignoring comments', () => {
    const s = buildProjectSummary(project);
    expect(s.stats).toEqual({ scenes: 4, endings: 1, boardNames: ['Main', 'Act II'] });
    expect(s.boardCount).toBe(2);
    expect(s.assetCount).toBe(2);
  });

  it('normalizes the active board into a thumbnail with kinds and edge indices', () => {
    const t = buildProjectSummary(project).thumbnail!;
    expect(t.n).toEqual([[0, 0, 3], [0.5, 0.5, 1], [1, 1, 0]]);
    expect(t.e).toEqual([[0, 1], [1, 2]]);
  });

  it('caps thumbnail size on big boards', () => {
    const nodes = Array.from({ length: 1000 }, (_, i) => node(`n${i}`, 'elementNode', i * 10, (i % 7) * 10));
    const t = buildProjectSummary({ id: 'x', name: 'Big', boards: [{ id: 'b', name: 'B', nodes, edges: [] }] }).thumbnail!;
    expect(t.n.length).toBeLessThanOrEqual(150);
  });
});
