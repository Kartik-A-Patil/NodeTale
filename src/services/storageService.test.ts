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
