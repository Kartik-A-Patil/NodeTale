#!/usr/bin/env node
import { rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const dirs = ['dist', 'out', 'node_modules/.vite'];

console.log('🧹 Cleaning build artifacts...\n');

for (const dir of dirs) {
  const target = join(rootDir, dir);
  try {
    await rm(target, { recursive: true, force: true });
    console.log(`  ✓ Cleaned: ${dir}`);
  } catch (e) {
    console.log(`  ⚠ Skipped: ${dir} (not found)`);
  }
}

console.log('\n✨ Clean complete!');
