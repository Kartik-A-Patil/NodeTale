import { it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { StoryNode } from './StoryNode';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const key = (k: string) => act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k })); });

it('first key reveals the text, then digits pick choices and locked ones are skipped', () => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any;
  const pick = vi.fn();
  const el = document.createElement('div');
  document.body.append(el);
  const root = createRoot(el);
  const options = [
    { label: 'Locked', targetId: 'a', edgeId: 'e1', locked: true, lockedReason: 'Needs gold' },
    { label: 'Open', targetId: 'b', edgeId: 'e2', visited: true },
  ];
  act(() => root.render(createElement(StoryNode, { label: 'Hall', content: '<p>One</p><p>Two</p>', options, onOptionClick: pick, hasVisual: false })));
  expect(el.querySelector('.nt-reveal')!.classList.contains('is-revealed')).toBe(false);
  key('2');
  expect(pick).not.toHaveBeenCalled();
  expect(el.querySelector('.nt-reveal')!.classList.contains('is-revealed')).toBe(true);
  key('1');
  expect(pick).not.toHaveBeenCalled();
  key('2');
  expect(pick).toHaveBeenCalledWith('e2');
  key('Enter'); // the only open choice
  expect(pick).toHaveBeenLastCalledWith('e2');
  expect(el.textContent).toContain('seen');
  act(() => root.unmount());
});
