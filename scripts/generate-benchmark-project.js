#!/usr/bin/env node
// Generates a synthetic large project for manually benchmarking save/load/
// dashboard-list timing. Usage: node scripts/generate-benchmark-project.js [nodeCount] [outFile]
// Import the resulting JSON via the Dashboard's "Import" button.

import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const nodeCount = parseInt(process.argv[2] || '500', 10);
const outFile = process.argv[3] || join(__dirname, '..', `benchmark-project-${nodeCount}.json`);

const boardId = 'bench-board';
const nodes = [];
const edges = [];

for (let i = 0; i < nodeCount; i++) {
  const id = `bench-node-${i}`;
  nodes.push({
    id,
    type: 'elementNode',
    position: { x: (i % 20) * 260, y: Math.floor(i / 20) * 180 },
    data: {
      label: i === 0 ? 'Start' : `Node ${i}`,
      content: `<p>Benchmark content for node ${i}. ${'Lorem ipsum dolor sit amet. '.repeat(10)}</p>`,
    },
  });
  if (i > 0) {
    edges.push({
      id: `bench-edge-${i}`,
      source: `bench-node-${i - 1}`,
      target: id,
      type: 'floating',
      animated: false,
      style: { stroke: '#71717a' },
    });
  }
}

const project = {
  id: `bench-project-${nodeCount}`,
  name: `Benchmark ${nodeCount} nodes`,
  activeBoardId: boardId,
  boards: [{ id: boardId, name: 'Main', nodes, edges }],
  variables: [
    { id: 'v1', name: 'health', type: 'number', value: 100 },
    { id: 'v2', name: 'hasKey', type: 'boolean', value: false },
  ],
  assets: [],
  folders: [],
};

await writeFile(outFile, JSON.stringify(project));
console.log(`Wrote ${nodeCount}-node benchmark project to ${outFile}`);
console.log(`Import it via the Dashboard's "Import" button, then time: import, dashboard reload (list), and opening the project (load).`);
