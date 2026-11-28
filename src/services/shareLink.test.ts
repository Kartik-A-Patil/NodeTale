import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { encodeStory, decodeStory, codeFromPasted, ShareLinkError } from './shareLink';

const example = () => JSON.parse(readFileSync('public/assets/Example_Project/Project.json', 'utf8'));

it('round-trips a story through a share code, without media', async () => {
  const project = example();
  project.boards[0].nodes[0].data.content += '<img src="data:image/png;base64,AAAA">';
  const code = await encodeStory(project);
  expect(code.startsWith('v1.')).toBe(true);
  expect(code).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
  console.log(`example story code: ${code.length} chars`);

  const back = await decodeStory(codeFromPasted(`https://nodetale.app/share#${code}`));
  expect(back.name).toBe(project.name);
  expect(back.variables).toEqual(project.variables);
  expect(back.boards[0].nodes.map((n: any) => n.data.label)).toEqual(project.boards[0].nodes.map((n: any) => n.data.label));
  expect(back.assets).toEqual([]);
  expect(back.boards.flatMap((b) => b.nodes).some((n: any) => n.data.assets || n.data.content?.includes('data:'))).toBe(false);
});

it('explains damaged or foreign links', async () => {
  const code = await encodeStory(example());
  await expect(decodeStory(code.slice(0, code.length / 2))).rejects.toBeInstanceOf(ShareLinkError);
  await expect(decodeStory('hello')).rejects.toThrow(/doesn’t look like/);
});
