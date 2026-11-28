// npm run test:e2e: starts the dev server on a free port, runs the browser
// tests, reports, and always cleans up. Screenshots: E2E_SHOTS=<folder>.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromePath } from './browser.mjs';

const freePort = () => new Promise((resolve) => { const s = createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

if (!chromePath()) {
  console.log('Skipping end-to-end tests: no Chrome or Chromium found (set CHROME_PATH).');
  process.exit(0);
}

const port = await freePort();
const base = `http://localhost:${port}`;
const server = spawn('npx', ['vite', '--config', 'configs/vite.web.config.ts', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-server.pid); } catch { /* gone */ } };
process.on('exit', stop);

for (let i = 0; i < 100; i++) {
  try { if ((await fetch(base)).ok) break; } catch { /* starting */ }
  await new Promise((r) => setTimeout(r, 300));
}

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${!ok && detail ? ` (${detail})` : ''}`);
  if (!ok) failed++;
};

for (const file of ['./play.e2e.mjs', './live.e2e.mjs']) {
  console.log(file.replace('./', '').replace('.e2e.mjs', ''));
  try {
    const { run } = await import(file);
    await run({ base, shots: process.env.E2E_SHOTS, check });
  } catch (err) {
    check('finished without errors', false, err.message);
  }
}

console.log(failed ? `\n${failed} failed` : '\nAll passed');
stop();
process.exit(failed ? 1 : 0);
