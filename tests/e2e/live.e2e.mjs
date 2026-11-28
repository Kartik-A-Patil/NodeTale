// Three people edit one story together, each in their own browser profile,
// through the real UI: joining by link and reply code, changes and media
// syncing, a view-only guest, leaving.
import { openBrowser, sleep } from './browser.mjs';

const node = (label) => `[...document.querySelectorAll('.react-flow__node')].find((n) => n.querySelector('.nt-node') && n.textContent.includes(${JSON.stringify(label)}))`;
const posOf = (label) => `(() => { const n = ${node(label)}; return n ? n.style.transform : null; })()`;
const count = `document.querySelectorAll('.react-flow__node').length`;
// Found by data-* hooks, not by wording, so copy changes don't break the test.
const PANEL = 'aside[aria-label="Sharing"]';
const action = (name, scope = '') => `document.querySelector('${scope} [data-action="${name}"]')`;
const has = (selector) => `!!document.querySelector(${JSON.stringify(selector)})`;
const peer = (name, extra = '') => `${PANEL} [data-peer="${name}"]${extra}`;

export async function run({ base, shots, check }) {
  const people = await Promise.all([openBrowser({ shots }), openBrowser({ shots }), openBrowser({ shots }), openBrowser({ shots })]);
  const [host, ana, bo, vi] = people;
  try {
    await host.goto(base);
    await sleep(1000);
    const pid = await host.ev(`(async () => { const m = await import('/src/services/projectImport.ts'); return (await m.createExampleProject()).id; })()`);
    await host.goto(`${base}/${pid}`);
    await sleep(1500);
    const joined = (g) => g.until(`location.pathname === '/${pid}' && document.querySelectorAll('.react-flow__node').length > 5`, 30000);

    async function invite(guest, name, { later = false, access = 'edit' } = {}) {
      if (await host.ev(has(PANEL))) await host.click(action('invite', PANEL));
      else await host.click(action('share'));
      await host.until(has('dialog[open] [data-mode="live"]'));
      await host.click(`document.querySelector('dialog[open] [data-mode="live"]')`);
      await sleep(200);
      if (await host.ev(`!!document.querySelector('dialog[open] input[aria-label="Your name"]')`)) {
        await host.ev(`document.querySelector('dialog[open] input[aria-label="Your name"]').select()`);
        await host.type('Kartik');
      }
      if (access === 'view') {
        await host.ev(`(() => { const s = document.querySelector('dialog[open] select[aria-label="What they can do"]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, 'view'); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
        await sleep(300);
      }
      const link = await host.until(`(() => { const v = document.querySelector('dialog[open] input[aria-label="Share link"]')?.value; return v && v.startsWith('http') && v; })()`);
      if (later) await host.click(action('close', 'dialog[open]'));
      await guest.goto(link);
      await guest.until(`!!document.querySelector('input[aria-label="Your name"]')`);
      await guest.ev(`document.querySelector('input[aria-label="Your name"]').select()`);
      await guest.type(name);
      const reply = await guest.until(`(() => { const v = document.querySelector('input[aria-label="Reply code"]')?.value; return v && !v.startsWith('Preparing') && v; })()`);
      if (later) {
        check('waiting link shows in the panel', await host.ev(has(`${PANEL} [data-invite-status="waiting"]`)));
        await host.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin: base });
        await host.ev(`navigator.clipboard.writeText(${JSON.stringify(reply)})`);
        await host.click(action('paste-reply', PANEL));
      } else {
        await host.ev(`(() => { const el = document.querySelector('dialog[open] input[aria-label="Reply code"]'); el.focus(); const dt = new DataTransfer(); dt.setData('text', ${JSON.stringify(reply)}); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); })()`);
        await host.until(has('dialog[open][data-status="sent"]'), 30000);
        await host.click(action('done', 'dialog[open]'));
      }
      await joined(guest);
      await sleep(1200);
    }

    await invite(ana, 'Ana');
    check('Ana joins (pasting in the dialog)', await ana.ev(has(peer('Ana', '[data-me]'))));
    await invite(bo, 'Bo', { later: true });
    check('Bo joins (pasting later, from the panel)', await host.ev(has(peer('Bo'))));
    await invite(vi, 'Vi', { access: 'view' });
    check('Vi joins as view-only', (await vi.ev(has(`${PANEL}[data-view-only]`))) && (await host.ev(has(peer('Vi', '[data-access="view"]')))));

    const before = await host.ev(posOf('Entrance Hall'));
    const p = await ana.center(`${node('Entrance Hall')}.querySelector('.nt-node')`);
    await ana.mouse('mousePressed', p.x, p.y - 40, 1);
    for (let i = 1; i <= 10; i++) { await ana.mouse('mouseMoved', p.x + i * 15, p.y - 40 + i * 6, 1); await sleep(16); }
    await ana.mouse('mouseReleased', p.x + 150, p.y + 20);
    await sleep(900);
    const positions = await Promise.all([host, ana, bo, vi].map((b) => b.ev(posOf('Entrance Hall'))));
    check('a drag reaches everyone', positions[0] !== before && positions.every((x) => x === positions[0]));

    const n0 = await host.ev(count);
    await host.click(`document.querySelector('.react-flow__pane')`);
    await host.key('s', 'KeyS');
    await sleep(1000);
    const counts = await Promise.all([host, ana, bo, vi].map((b) => b.ev(count)));
    check('a new scene reaches everyone', counts.every((c) => c === n0 + 1));

    await bo.click(`${node('Proceed in the dark')}.querySelector('.nt-node')`);
    await sleep(200);
    await bo.key('Delete', 'Delete');
    await sleep(1000);
    const left = await Promise.all([host, ana, bo, vi].map((b) => b.ev(`!!${node('Proceed in the dark')}`)));
    check('a deletion reaches everyone', left.every((x) => !x));

    // The viewer can't change anything: a drag attempt moves nothing anywhere.
    const vp = await vi.center(`${node('Power Control Room')}.querySelector('.nt-node')`);
    const vBefore = await host.ev(posOf('Power Control Room'));
    await vi.mouse('mousePressed', vp.x, vp.y - 30, 1);
    for (let i = 1; i <= 8; i++) { await vi.mouse('mouseMoved', vp.x + i * 20, vp.y - 30, 1); await sleep(16); }
    await vi.mouse('mouseReleased', vp.x + 160, vp.y - 30);
    await sleep(800);
    check('a view-only guest can’t move nodes', (await host.ev(posOf('Power Control Room'))) === vBefore && (await vi.ev(posOf('Power Control Room'))) === vBefore);

    // Typing protection: you're renaming a node when Bo renames it too.
    // Found by id: while a title is being edited it's an input, not text.
    const prId = await host.ev(`${node('Power Restored')}.dataset.id`);
    const byId = `document.querySelector('.react-flow__node[data-id="${prId}"]')`;
    const rename = (who) => who.ev(`(() => { const t = ${byId}?.querySelector('[title="Double click to rename"]'); if (!t) return false; t.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return true; })()`);
    check('you can start renaming', await rename(host));
    await host.until(`!!${byId}?.querySelector('input[aria-label="Title"]')`);
    check('Bo can start renaming the same node', await rename(bo));
    await bo.until(`!!${byId}?.querySelector('input[aria-label="Title"]')`);
    await bo.ev(`${byId}.querySelector('input[aria-label="Title"]').select()`);
    await bo.type('Generators online');
    await bo.key('Enter', 'Enter');
    await sleep(900);
    check('your typing isn’t changed under you', (await host.ev(`${byId}?.querySelector('input[aria-label="Title"]')?.value`)) === 'Power Restored');
    await host.ev(`${byId}.querySelector('input[aria-label="Title"]').blur()`);
    await sleep(600);
    check('their change lands once you stop (you changed nothing)', (await host.ev(`${byId}?.textContent || ''`)).includes('Generators online'));

    check('the host sees recent changes by others', await host.ev(has(`${PANEL} details[data-activity]`)));
    await host.ev(`document.querySelector('${PANEL} details')?.setAttribute('open', '')`);
    await sleep(200);
    await host.shot('live-host');
    await vi.shot('live-viewer');

    await ana.click(action('leave', PANEL));
    await sleep(900);
    check('leaving is told apart from a lost connection', (await host.ev(has(`${PANEL} [data-notice="left"]`))) && !(await ana.ev(has(`${PANEL}[data-live]`))));

    await host.click(action('collapse', PANEL));
    await sleep(300);
    check('the panel collapses to a chip', await host.ev(has('[data-action="expand"]')));

    check('no page errors', people.every((b) => b.errors.length === 0), people.flatMap((b) => b.errors).join(' | '));
  } finally {
    await Promise.all(people.map((b) => b.close()));
  }
}
