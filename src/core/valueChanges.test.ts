import { it, expect } from 'vitest';
import { compileChanges, questionsOf, opsFor } from './valueChanges';
import { VariableType } from '../models/story';

const vars: any[] = [
  { id: '1', name: 'gold', type: VariableType.NUMBER, value: 0 },
  { id: '2', name: 'name', type: VariableType.STRING, value: '' },
  { id: '3', name: 'has_key', type: VariableType.BOOLEAN, value: false },
  { id: '4', name: 'inv', type: VariableType.ARRAY, value: { elementType: 'string', elements: [] } },
  { id: '5', name: 'stats', type: VariableType.OBJECT, value: { keys: {} } },
];

it('offers operators by type, none for objects', () => {
  expect(opsFor(vars[0]).map((o) => o.op)).toEqual(['set', 'add', 'subtract', 'multiply', 'divide']);
  expect(opsFor(vars[2]).map((o) => o.op)).toEqual(['set', 'flip']);
  expect(opsFor(vars[4])).toEqual([]);
});

it('compiles changes to script lines, typed by variable, skipping unanswered questions and bad values', () => {
  const changes: any[] = [
    { id: 'a', variable: 'gold', op: 'add', value: 10 },
    { id: 'b', variable: 'name', op: 'set', ask: 'Your name?' },
    { id: 'c', variable: 'has_key', op: 'flip' },
    { id: 'd', variable: 'inv', op: 'push', value: 'rope "x"' },
    { id: 'e', variable: 'gold', op: 'set', value: 'abc' },
    { id: 'f', variable: 'gone', op: 'set', value: 1 },
  ];
  expect(compileChanges(changes, vars)).toBe('gold += 10\nhas_key = !has_key\ninv = push(inv, "rope \\"x\\"")');
  expect(compileChanges(changes, vars, { b: 'Alex' })).toContain('name = "Alex"');
  expect(questionsOf(changes, vars).map((q) => q.change.id)).toEqual(['b']);
});
