import { describe, expect, it } from 'vitest';
import { evaluateCondition, replaceVariablesInText } from './logicService';
import { Variable, VariableType } from '../types';

const numberVar = (name: string, value: number): Variable => ({
  id: name,
  name,
  type: VariableType.NUMBER,
  value,
});

const boolVar = (name: string, value: boolean): Variable => ({
  id: name,
  name,
  type: VariableType.BOOLEAN,
  value,
});

const stringVar = (name: string, value: string): Variable => ({
  id: name,
  name,
  type: VariableType.STRING,
  value,
});

describe('evaluateCondition', () => {
  it('returns true for an empty condition', () => {
    expect(evaluateCondition(undefined, [])).toBe(true);
    expect(evaluateCondition('', [])).toBe(true);
  });

  it('evaluates equality and inequality', () => {
    const vars = [numberVar('health', 50)];
    expect(evaluateCondition('health == 50', vars)).toBe(true);
    expect(evaluateCondition('health != 50', vars)).toBe(false);
  });

  it('evaluates > and <', () => {
    const vars = [numberVar('health', 50)];
    expect(evaluateCondition('health > 10', vars)).toBe(true);
    expect(evaluateCondition('health < 10', vars)).toBe(false);
  });

  it('evaluates >= and <= (regression for the >=/<= misparse bug)', () => {
    const vars = [numberVar('health', 50)];
    expect(evaluateCondition('health >= 50', vars)).toBe(true);
    expect(evaluateCondition('health >= 51', vars)).toBe(false);
    expect(evaluateCondition('health <= 50', vars)).toBe(true);
    expect(evaluateCondition('health <= 49', vars)).toBe(false);
  });

  it('evaluates boolean variables', () => {
    const vars = [boolVar('hasKey', true)];
    expect(evaluateCondition('hasKey == true', vars)).toBe(true);
    expect(evaluateCondition('hasKey == false', vars)).toBe(false);
  });

  it('evaluates string variables', () => {
    const vars = [stringVar('status', 'completed')];
    expect(evaluateCondition('status == "completed"', vars)).toBe(true);
    expect(evaluateCondition("status == 'other'", vars)).toBe(false);
  });

  it('returns false when the variable is not found', () => {
    expect(evaluateCondition('missing == 1', [numberVar('health', 50)])).toBe(false);
  });

  it('a bare identifier evaluates its own truthiness (real-parser behavior change from the old substring parser, which always returned false here)', () => {
    expect(evaluateCondition('health', [numberVar('health', 50)])).toBe(true);
    expect(evaluateCondition('health', [numberVar('health', 0)])).toBe(false);
    expect(evaluateCondition('hasKey', [boolVar('hasKey', true)])).toBe(true);
  });

  it('supports && and || (new — the old substring parser had no support for these at all)', () => {
    const vars = [numberVar('health', 50), boolVar('hasKey', true)];
    expect(evaluateCondition('health > 10 && hasKey == true', vars)).toBe(true);
    expect(evaluateCondition('health > 10 && hasKey == false', vars)).toBe(false);
    expect(evaluateCondition('health < 10 || hasKey == true', vars)).toBe(true);
    expect(evaluateCondition('health < 10 || hasKey == false', vars)).toBe(false);
  });

  it('supports parentheses and unary !', () => {
    const vars = [numberVar('health', 50), boolVar('hasKey', false)];
    expect(evaluateCondition('!hasKey', vars)).toBe(true);
    expect(evaluateCondition('(health > 10) && !hasKey', vars)).toBe(true);
  });

  it('returns false for a malformed condition instead of throwing', () => {
    expect(evaluateCondition('health >', [numberVar('health', 50)])).toBe(false);
    expect(evaluateCondition('== 5', [numberVar('health', 50)])).toBe(false);
  });
});

describe('replaceVariablesInText', () => {
  it('replaces a simple variable reference', () => {
    const vars = [numberVar('health', 50)];
    expect(replaceVariablesInText('HP: {{health}}', vars)).toBe('HP: 50');
  });

  it('replaces an object property reference', () => {
    const vars: Variable[] = [{
      id: 'player',
      name: 'player',
      type: VariableType.OBJECT,
      value: { keys: { name: { type: VariableType.STRING, value: 'Ada' } } },
    }];
    expect(replaceVariablesInText('Hello {{player.name}}', vars)).toBe('Hello Ada');
  });

  it('replaces an array index reference', () => {
    const vars: Variable[] = [{
      id: 'inventory',
      name: 'inventory',
      type: VariableType.ARRAY,
      value: { elementType: VariableType.STRING, elements: ['sword', 'shield'] },
    }];
    expect(replaceVariablesInText('First item: {{inventory[0]}}', vars)).toBe('First item: sword');
  });

  it('leaves unknown references untouched', () => {
    expect(replaceVariablesInText('{{unknown}}', [])).toBe('{{unknown}}');
  });
});
