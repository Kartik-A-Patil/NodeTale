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

it('offers operators by type', () => {
  expect(opsFor(vars[0]).map((o) => o.op)).toEqual(['set', 'add', 'subtract', 'multiply', 'divide']);
  expect(opsFor(vars[2]).map((o) => o.op)).toEqual(['set', 'flip']);
  expect(opsFor(vars[4]).map((o) => o.op)).toEqual(['setKey']);
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

it('sets an object key with a value of that key’s type', () => {
  const obj: any = { id: '6', name: 'stats', type: VariableType.OBJECT, value: { keys: { hp: { type: 'number', value: 10 }, title: { type: 'string', value: '' } } } };
  const changes: any[] = [
    { id: 'a', variable: 'stats', op: 'setKey', key: 'hp', value: 50 },
    { id: 'b', variable: 'stats', op: 'setKey', key: 'hp', value: 'lots' },
    { id: 'c', variable: 'stats', op: 'setKey', key: 'nope', value: 1 },
    { id: 'd', variable: 'stats', op: 'setKey', key: 'title', ask: 'Your title?' },
  ];
  expect(compileChanges(changes, [obj])).toBe('stats = objectSpread(stats, { "hp": 50 })');
  expect(compileChanges(changes, [obj], { d: 'Sir' })).toContain('stats = objectSpread(stats, { "title": "Sir" })');
  expect(questionsOf(changes, [obj]).map((q) => q.change.id)).toEqual(['d']);
});
