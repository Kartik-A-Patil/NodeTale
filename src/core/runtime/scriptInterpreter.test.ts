import { describe, it, expect } from 'vitest';
import { runScript, evaluateCondition, interpolateText, mathRng } from './scriptInterpreter';
import { enumerateOutcomes } from '../sim/simulate';

const list = (...elements: (string | number)[]) => ({ elementType: 'string', elements });
const obj = { keys: { hp: { type: 'number', value: 40 } } };

describe('script language', () => {
  it('runs if / else if / else and ternaries', () => {
    const code = 'if (roll >= 5) {\n gold += 20\n} else if (roll == 1) {\n hp -= 10\n} else { gold += 1 }\nmood = hp > 50 ? "calm" : "shaken"';
    expect(runScript(code, { roll: 6, gold: 0, hp: 100, mood: '' }).changes).toEqual({ gold: 20, mood: 'calm' });
    expect(runScript(code, { roll: 1, gold: 0, hp: 40, mood: '' }).changes).toEqual({ hp: 30, mood: 'shaken' });
    expect(runScript(code, { roll: 3, gold: 0, hp: 100, mood: '' }).changes).toEqual({ gold: 1, mood: 'calm' });
  });

  it('has math, list helpers, member/index access and loose ==', () => {
    const r = runScript(
      'a = clamp(150, 0, 100)\nb = round(2.456, 1)\ninv = remove(push(inv, "rope"), "key")\nn = len(inv) + obj.hp + inv[0].length * 0\nok = has(inv, "rope") && "5" == 5 && 7 % 2 == 1',
      { a: 0, b: 0, inv: list('key', 'map'), n: 0, ok: false, obj },
    );
    expect(r.error).toBeUndefined();
    expect(r.changes).toMatchObject({ a: 100, b: 2.5, n: 42, ok: true });
    expect((r.changes.inv as any).elements).toEqual(['map', 'rope']);
  });

  it('rolls dice only where luck is allowed', () => {
    const r = runScript('roll = random(1, 6)', { roll: 0 }, mathRng);
    expect(r.changes.roll).toBeGreaterThanOrEqual(1);
    expect(r.changes.roll).toBeLessThanOrEqual(6);
    expect(runScript('roll = random(1, 6)', { roll: 0 }).error).toMatch(/only works in scripts/);
  });

  it('reports a broken condition instead of hiding it', () => {
    const errors: string[] = [];
    expect(evaluateCondition('nope > 1', {}, { onError: (m) => errors.push(m) })).toBe(false);
    expect(errors[0]).toMatch(/Unknown variable: nope/);
    expect(evaluateCondition('has(inv, "map")', { inv: list('map') })).toBe(true);
  });

  it('fills expressions in story text, decoding HTML and keeping broken ones', () => {
    const html = '<p>{{gold * 2}} · {{inv[1]}} · {{obj.hp}} · {{gold &gt; 5 ? &#39;rich&#39; : &#39;poor&#39;}} · {{missing}}</p>';
    expect(interpolateText(html, { gold: 10, inv: list('a', 'b'), obj }))
      .toBe('<p>20 · b · 40 · rich · {{missing}}</p>');
  });
});

describe('simulator luck', () => {
  it('explores every outcome of chance() and small random() ranges', () => {
    const outcomes = enumerateOutcomes((rng) => `${rng.chance(0.5)}-${rng.int(1, 3)}`);
    expect(outcomes.sort()).toEqual(['false-1', 'false-2', 'false-3', 'true-1', 'true-2', 'true-3']);
    expect(enumerateOutcomes((rng) => rng.int(1, 100))).toEqual([1, 51, 100]);
  });
});
