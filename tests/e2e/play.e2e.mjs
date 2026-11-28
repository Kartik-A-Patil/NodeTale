// Play Mode's debugger: every value readable, edits only of the variable's type.
import { openBrowser, sleep } from './browser.mjs';

export async function run({ base, shots, check }) {
  const b = await openBrowser({ shots });
  try {
    await b.goto(base);
    await sleep(1000);
    // The example story, plus a list and an object variable to inspect.
    const pid = await b.ev(`(async () => {
      const m = await import('/src/services/projectImport.ts');
      const s = await import('/src/services/storageService.ts');
      const p = await m.createExampleProject();
      p.variables.push(
        { id: 'inv', name: 'inventory', type: 'array', value: { elementType: 'string', elements: ['rope', 'lamp'] } },
        { id: 'st', name: 'stats', type: 'object', value: { keys: { hp: { type: 'number', value: 10 }, title: { type: 'string', value: 'Scout' } } } },
      );
      await s.saveProject(p);
      return p.id;
    })()`);
    await b.goto(`${base}/${pid}`);
    await sleep(1500);
    await b.click(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Play')`);
    await b.until(`!!document.querySelector('button[aria-label^="Debugger"]')`);
    if (!(await b.ev(`!!document.querySelector('aside[aria-label="Debugger"]')`))) await b.click(`document.querySelector('button[aria-label^="Debugger"]')`);
    await b.until(`!!document.querySelector('aside[aria-label="Debugger"]')`);
    const panel = `document.querySelector('aside[aria-label="Debugger"]')`;

    // Open the list and the object.
    await b.ev(`[...${panel}.querySelectorAll('button[aria-expanded]')].forEach((x) => x.getAttribute('aria-expanded') === 'false' && x.click())`);
    await sleep(300);
    check('lists and objects open into typed editors', await b.ev(`!!${panel}.querySelector('input[aria-label="inventory item 0"]') && !!${panel}.querySelector('input[aria-label="stats.hp"]')`));
    check('no value shows as [object Object]', !(await b.ev(`${panel}.innerText.includes('[object')`)));

    // A number field refuses text and takes a number.
    const field = `${panel}.querySelector('input[aria-label="trust_level value"]')`;
    const typeInto = async (text) => {
      await b.ev(`${field}.focus(); ${field}.select();`);
      await b.type(text);
      await b.ev(`${field}.blur()`);
      await sleep(300);
    };
    const before = await b.ev(`${field}.value`);
    await typeInto('abc');
    check('a number variable refuses text', (await b.ev(`${field}.value`)) === before);
    await typeInto('42');
    check('a number variable takes a number', (await b.ev(`${field}.value`)) === '42');
    await b.ev(`${panel}.querySelector('input[aria-label="stats.hp"]').focus()`);
    await b.ev(`${panel}.querySelector('input[aria-label="stats.hp"]').select()`);
    await b.type('25');
    await b.ev(`${panel}.querySelector('input[aria-label="stats.hp"]').blur()`);
    await sleep(300);
    check('an object key takes a value of its type', (await b.ev(`${panel}.querySelector('input[aria-label="stats.hp"]').value`)) === '25');
    await b.shot('play-debugger');
    check('no page errors', b.errors.length === 0, b.errors.join(' | '));
  } finally {
    await b.close();
  }
}
