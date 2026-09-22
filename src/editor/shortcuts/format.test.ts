import { describe, expect, it } from 'vitest';
import { matchesShortcut } from './format';

const event = (init: Partial<KeyboardEvent>): KeyboardEvent =>
  ({ key: '', ctrlKey: false, metaKey: false, shiftKey: false, ...init } as KeyboardEvent);

describe('matchesShortcut', () => {
  it('matches key + ctrlOrCmd via either Ctrl or Meta', () => {
    const keys = { key: 'z', ctrlOrCmd: true };
    expect(matchesShortcut(keys, event({ key: 'z', ctrlKey: true }))).toBe(true);
    expect(matchesShortcut(keys, event({ key: 'z', metaKey: true }))).toBe(true);
  });

  it('does not match without the required modifier', () => {
    expect(matchesShortcut({ key: 'z', ctrlOrCmd: true }, event({ key: 'z' }))).toBe(false);
  });

  it('does not match with an unwanted extra modifier', () => {
    // Ctrl+Z should not also fire when Ctrl+Shift+Z (redo) is pressed.
    expect(matchesShortcut({ key: 'z', ctrlOrCmd: true }, event({ key: 'z', ctrlKey: true, shiftKey: true }))).toBe(false);
  });

  it('matches a plain key with no modifiers required', () => {
    expect(matchesShortcut({ key: 'Delete' }, event({ key: 'Delete' }))).toBe(true);
    expect(matchesShortcut({ key: 'Delete' }, event({ key: 'Delete', ctrlKey: true }))).toBe(false);
  });

  it('is case-insensitive on the key itself', () => {
    expect(matchesShortcut({ key: 'z', ctrlOrCmd: true }, event({ key: 'Z', ctrlKey: true }))).toBe(true);
  });
});
