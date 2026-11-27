import { it, expect } from 'vitest';
import { validateTypeAssignments } from './logicService';
import { VariableType } from '../models/story';

const vars: any = [
  { name: 'roll', type: VariableType.NUMBER, value: 0 },
  { name: 'ok', type: VariableType.BOOLEAN, value: false },
  { name: 'name', type: VariableType.STRING, value: '' },
];
const check = (code: string) => validateTypeAssignments(code, vars).errors.map((e) => e.message);

it('flags only literals of the wrong type', () => {
  expect(check('if (roll == 1) {\n  ok = true\n}\nroll = random(1, 6)\nroll = -3\nname = "x"\nok = roll > 2')).toEqual([]);
  expect(check('roll = "ten"\nif (ok) {\n  ok = 1\n}\nname = 5')).toEqual([
    'Type mismatch: roll is number, but assigned "ten"',
    'Type mismatch: ok is boolean, but assigned 1',
    'Type mismatch: name is string, but assigned 5',
  ]);
});
