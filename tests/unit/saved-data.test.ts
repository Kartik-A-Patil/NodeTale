import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { compactProject } from '../../src/services/storageService';

it('compacts saved projects without losing story data', () => {
  const project = JSON.parse(readFileSync('public/assets/Example_Project/Project.json', 'utf8'));
  project.boards[0].edges[0].data = { condition: 'gold > 1', effect: 'gold -= 1', manualLabel: true };
  project.boards[0].edges[0].label = 'Pay';
  const out = compactProject(project);
  const raw = JSON.stringify(out);
  expect(raw).not.toMatch(/data-(start|end)=/);
  expect(Number.isInteger(out.boards[0].nodes[0].position.x)).toBe(true);
  expect(out.boards[0].edges[0]).toMatchObject({ label: 'Pay', data: { condition: 'gold > 1', effect: 'gold -= 1' } });
  expect(out.boards[0].nodes.map((n: any) => n.data.label)).toEqual(project.boards[0].nodes.map((n: any) => n.data.label));
});

it('stores only what the author set, and loading restores the rest', async () => {
  const { toCanvasEdge } = await import('../../src/adapters/reactFlow');
  const arrow = { type: 'arrowclosed', width: 20, height: 20 };
  const project: any = {
    id: 'p', name: 'p', activeBoardId: 'b', variables: [], folders: [],
    assets: [{ id: 'a1', name: 'x', url: 'blob:http://x/1', type: 'audio', parentId: null }],
    boards: [{ id: 'b', name: 'b', nodes: [
      { id: 's', type: 'elementNode', position: { x: 1.4, y: 2.6 }, width: 250.2, height: 150, style: { width: 250, height: 150 },
        data: { label: 'Start', content: '', assets: [], color: '', audioSettings: { gone: { loop: true, delay: 0 } } } },
      { id: 'k', type: 'conditionNode', position: { x: 0, y: 0 }, data: { label: 'If', branches: [] } },
      { id: 'c', type: 'commentNode', position: { x: 0, y: 0 }, zIndex: -1, style: { zIndex: -1 }, data: { label: '', text: 'note' } },
    ], edges: [
      { id: 'e1', source: 's', target: 'k', sourceHandle: 'source-right', targetHandle: 'target', type: 'floating', animated: false,
        markerEnd: arrow, style: { stroke: '#71717a' }, label: 'old auto text', data: { manualLabel: false, pathType: 'bezier', condition: '' } },
      { id: 'e2', source: 'k', target: 's', sourceHandle: 'true', type: 'floating', style: { stroke: '#ef4444' }, label: 'Go', data: { manualLabel: true } },
    ] }],
  };
  const [board] = compactProject(project).boards;
  // A resized scene: its width and chosen height (style) are kept, its measured height isn't.
  expect(board.nodes[0]).toEqual({ id: 's', type: 'elementNode', position: { x: 1, y: 3 }, width: 250, style: { height: 150 }, data: { label: 'Start', content: '' } });
  expect(board.nodes[1].data).toEqual({ label: 'If', branches: [] });
  expect(board.nodes[2]).toEqual({ id: 'c', type: 'commentNode', position: { x: 0, y: 0 }, data: { label: '', text: 'note' } });
  expect(board.edges[0]).toEqual({ id: 'e1', source: 's', target: 'k' });
  expect(board.edges[1]).toEqual({ id: 'e2', source: 'k', target: 's', sourceHandle: 'true', label: 'Go', style: { stroke: '#ef4444' }, data: { manualLabel: true } });
  expect(compactProject(project).assets[0].url).toBe('');
  expect(toCanvasEdge(board.edges[0])).toMatchObject({ type: 'floating', markerEnd: arrow, style: { stroke: '#71717a' } });
  expect(toCanvasEdge(board.edges[1]).style).toEqual({ stroke: '#ef4444' });
});

it('drops references to media that no longer exists', () => {
  const project: any = {
    id: 'p', name: 'p', activeBoardId: 'b', variables: [], folders: [],
    assets: [{ id: 'a1', name: 'x.mp3', url: '', type: 'audio', parentId: null }],
    boards: [{ id: 'b', name: 'b', edges: [], nodes: [
      { id: 's', type: 'elementNode', position: { x: 0, y: 0 }, data: { label: 'S', content: '', assets: ['gone', 'a1'], audioSettings: { gone: { loop: true, delay: 0 }, a1: { loop: true, delay: 0 } } } },
      { id: 't', type: 'elementNode', position: { x: 0, y: 0 }, data: { label: 'T', content: '', assets: ['gone'] } },
    ] }],
  };
  const [s, t] = compactProject(project).boards[0].nodes as any[];
  expect(s.data).toEqual({ label: 'S', content: '', assets: ['a1'], audioSettings: { a1: { loop: true, delay: 0 } } });
  expect(t.data).toEqual({ label: 'T', content: '' });
});

it('does not pin an unresized scene to an old measured height', () => {
  const project: any = {
    id: 'p', name: 'p', activeBoardId: 'b', variables: [], folders: [], assets: [],
    boards: [{ id: 'b', name: 'b', edges: [], nodes: [
      { id: 's', type: 'elementNode', position: { x: 0, y: 0 }, width: 250, height: 300, data: { label: 'S', content: '' } },
      { id: 'g', type: 'sectionNode', position: { x: 0, y: 0 }, width: 600, height: 400, data: { label: 'Group' } },
    ] }],
  };
  const [scene, section] = compactProject(project).boards[0].nodes as any[];
  expect(scene.height).toBeUndefined();     // fits its text next time
  expect(scene.style?.height).toBeUndefined();
  expect(section.height).toBe(400);         // other nodes keep their size
});
