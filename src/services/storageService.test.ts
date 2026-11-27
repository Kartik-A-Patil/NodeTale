import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { compactProject } from './storageService';

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
  console.log(`example project: ${JSON.stringify(project).length} -> ${raw.length} bytes`);
});

it('stores only what the author set, and loading restores the rest', async () => {
  const { toCanvasEdge } = await import('../adapters/reactFlow');
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
  // Resized scene: width kept, its chosen height kept as style, measured height dropped.
  expect(board.nodes[0]).toEqual({ id: 's', type: 'elementNode', position: { x: 1, y: 3 }, width: 250, style: { height: 150 }, data: { label: 'Start', content: '' } });
  expect(board.nodes[1].data).toEqual({ label: 'If', branches: [] });
  expect(board.nodes[2]).toEqual({ id: 'c', type: 'commentNode', position: { x: 0, y: 0 }, data: { label: '', text: 'note' } });
  expect(board.edges[0]).toEqual({ id: 'e1', source: 's', target: 'k' });
  expect(board.edges[1]).toEqual({ id: 'e2', source: 'k', target: 's', sourceHandle: 'true', label: 'Go', style: { stroke: '#ef4444' }, data: { manualLabel: true } });
  expect(compactProject(project).assets[0].url).toBe('');
  expect(toCanvasEdge(board.edges[0])).toMatchObject({ type: 'floating', markerEnd: arrow, style: { stroke: '#71717a' } });
  expect(toCanvasEdge(board.edges[1]).style).toEqual({ stroke: '#ef4444' });
});
