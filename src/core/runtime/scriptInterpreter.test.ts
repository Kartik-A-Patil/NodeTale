import { describe, expect, it } from 'vitest';
import { runScript } from './scriptInterpreter';
import { VariableType } from '../../types';

describe('runScript', () => {
  it('applies a simple assignment', () => {
    const result = runScript('health = 100', { health: 50 });
    expect(result.changes).toEqual({ health: 100 });
    expect(result.error).toBeUndefined();
  });

  it('applies compound assignment operators', () => {
    expect(runScript('health += 10', { health: 50 }).changes).toEqual({ health: 60 });
    expect(runScript('health -= 10', { health: 50 }).changes).toEqual({ health: 40 });
    expect(runScript('health *= 2', { health: 50 }).changes).toEqual({ health: 100 });
    expect(runScript('health /= 2', { health: 50 }).changes).toEqual({ health: 25 });
  });

  it('runs multiple statements in sequence', () => {
    const result = runScript('health = 100\nhealth -= 30', { health: 50 });
    expect(result.changes).toEqual({ health: 70 });
  });

  it('only reports variables the script actually assigned to', () => {
    const result = runScript('health = level * 10', { health: 0, level: 5, unrelated: 1 });
    expect(result.changes).toEqual({ health: 50 });
    expect(result.changes).not.toHaveProperty('level');
    expect(result.changes).not.toHaveProperty('unrelated');
  });

  it('calls a whitelisted array helper', () => {
    const inventory = { elementType: VariableType.STRING, elements: ['sword'] };
    const result = runScript('inventory = arrayPush(inventory, "shield")', { inventory });
    expect(result.changes.inventory).toEqual({ elementType: VariableType.STRING, elements: ['sword', 'shield'] });
  });

  it('calls a whitelisted array helper with an arrow-function callback', () => {
    const nums = { elementType: VariableType.NUMBER, elements: [1, 2, 3] };
    const result = runScript('nums = arrayMap(nums, (x) => x * 2)', { nums });
    expect(result.changes.nums).toEqual({ elementType: VariableType.NUMBER, elements: [2, 4, 6] });
  });

  it('calls objectSpread with an object literal argument', () => {
    const player = { keys: { health: { type: VariableType.NUMBER, value: 50 }, name: { type: VariableType.STRING, value: 'Ada' } } };
    const result = runScript('player = objectSpread(player, { health: 100 })', { player });
    // objectSpread's overrides are always wrapped as STRING-typed entries (pre-existing
    // behavior of the helper itself, unrelated to this interpreter) — asserting the
    // shape it actually produces, not what might seem more "correct".
    expect(result.changes.player).toEqual({
      keys: {
        health: { type: VariableType.STRING, value: 100 },
        name: { type: VariableType.STRING, value: 'Ada' },
      },
    });
  });

  it('errors on an unknown variable instead of throwing out of the caller', () => {
    const result = runScript('missing = 1', {});
    expect(result.error).toMatch(/Unknown variable: missing/);
  });

  it('errors on an unknown function call — cannot reach anything outside the whitelist', () => {
    const result = runScript('require("fs")', {});
    expect(result.error).toMatch(/Unknown function: require/);
  });

  it('cannot reach globals like window even as a bare read — this is real sandboxing, not global-shadowing', () => {
    const result = runScript('x = window', { x: 0 });
    expect(result.error).toMatch(/Unknown variable: window/);
  });

  it('member-access syntax (e.g. window.alert(...)) is not part of the grammar at all — fails to parse', () => {
    const result = runScript('window.alert("x")', {});
    expect(result.error).toBeDefined();
  });

  it('preserves changes made before a later statement errors', () => {
    const result = runScript('health = 100\nmissing = 1', { health: 50 });
    expect(result.changes).toEqual({ health: 100 });
    expect(result.error).toMatch(/Unknown variable: missing/);
  });
});
