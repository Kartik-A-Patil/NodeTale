// A small driver for headless Chromium over the DevTools protocol: just what
// the end-to-end tests need, no dependencies. Set CHROME_PATH to use a
// particular browser; otherwise common install locations are tried.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/chromium-browser', '/usr/bin/chromium', '/snap/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean);
export const chromePath = () => CANDIDATES.find((p) => existsSync(p));

let nextPort = 9400 + Math.floor(Math.random() * 400);

/** A fresh browser profile with one page, driven through the DevTools protocol. */
export async function openBrowser({ shots } = {}) {
  const path = chromePath();
  if (!path) throw new Error('No Chrome or Chromium found. Set CHROME_PATH.');
  const port = nextPort++;
  const profile = mkdtempSync(join(tmpdir(), 'nodetale-e2e-'));
  const proc = spawn(path, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1300,850',
    '--no-first-run', '--disable-features=WebRtcHideLocalIpsWithMdns', 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 75 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch { /* starting */ }
  }
  if (!target) throw new Error('Browser didn’t start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description?.slice(0, 300));
    pending.get(m.id)?.(m);
  });
  const send = (method, params = {}) => new Promise((resolve) => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })); });
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    return r.result.result?.value;
  };
  const center = async (selector) => {
    const p = await ev(`(() => { const el = ${selector}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    if (!p) throw new Error('No element: ' + selector);
    return p;
  };
  const mouse = (type, x, y, buttons = 0) => send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', buttons, clickCount: 1 });
  const b = {
    send, ev, center, mouse, errors,
    goto: async (url) => { await send('Page.navigate', { url }); await sleep(1500); },
    click: async (selector) => { const p = await center(selector); await mouse('mousePressed', p.x, p.y, 1); await mouse('mouseReleased', p.x, p.y); },
    type: (text) => send('Input.insertText', { text }),
    key: async (key, code) => {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: key === 'Delete' ? 46 : key.toUpperCase().charCodeAt(0) });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
    },
    until: async (expression, ms = 20000) => {
      const end = Date.now() + ms;
      while (Date.now() < end) { const v = await ev(expression); if (v) return v; await sleep(200); }
      throw new Error('Timed out waiting for: ' + expression.slice(0, 160));
    },
    shot: async (name) => {
      if (!shots) return;
      const s = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(shots, `${name}.png`), Buffer.from(s.result.data, 'base64'));
    },
    close: async () => {
      await send('Browser.close').catch(() => {});
      try { proc.kill(); } catch { /* already gone (or a snap that refuses signals) */ }
      try { rmSync(profile, { recursive: true, force: true }); } catch { /* still in use */ }
    },
  };
  await send('Page.enable');
  await send('Runtime.enable');
  return b;
}
