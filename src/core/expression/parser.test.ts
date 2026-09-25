import { describe, expect, it } from 'vitest';
import { parseExpression, parseScript, ExpressionSyntaxError } from './parser';
import { evaluate } from './evaluator';

const evalExpr = (source: string, vars: Record<string, unknown> = {}) =>
  evaluate(parseExpression(source), { resolveIdentifier: (name) => {
    if (!(name in vars)) throw new Error(`Unknown: ${name}`);
    return vars[name];
  } });

describe('expression precedence', () => {
  it('multiplicative binds tighter than additive', () => {
    expect(evalExpr('2 + 3 * 4')).toBe(14);
    expect(evalExpr('(2 + 3) * 4')).toBe(20);
  });

  it('comparison binds tighter than &&/||', () => {
    expect(evalExpr('1 < 2 && 3 < 4')).toBe(true);
    expect(evalExpr('1 > 2 || 3 < 4')).toBe(true);
  });

  it('&& binds tighter than ||', () => {
    // true || (false && false) => true, not (true || false) && false => false
    expect(evalExpr('true || false && false')).toBe(true);
  });

  it('unary ! and - bind tighter than binary operators', () => {
    expect(evalExpr('!false && true')).toBe(true);
    expect(evalExpr('-2 + 5')).toBe(3);
  });
});

describe('literals and identifiers', () => {
  it('parses numbers, strings, booleans', () => {
    expect(evalExpr('42')).toBe(42);
    expect(evalExpr('"hi"')).toBe('hi');
    expect(evalExpr("'hi'")).toBe('hi');
    expect(evalExpr('true')).toBe(true);
    expect(evalExpr('false')).toBe(false);
  });

  it('resolves identifiers', () => {
    expect(evalExpr('health', { health: 50 })).toBe(50);
  });

  it('throws a syntax error on malformed input', () => {
    expect(() => parseExpression('health >')).toThrow(ExpressionSyntaxError);
    expect(() => parseExpression('== 5')).toThrow(ExpressionSyntaxError);
  });
});

describe('function calls and arrow functions', () => {
  it('parses and evaluates a call to a registered function', () => {
    const expr = parseExpression('double(5)');
    const result = evaluate(expr, {
      resolveIdentifier: () => { throw new Error('n/a'); },
      callFunction: (name, args) => (name === 'double' ? (args[0] as number) * 2 : undefined),
    });
    expect(result).toBe(10);
  });

  it('evaluates an arrow function value passed as a call argument', () => {
    const expr = parseExpression('apply(x => x + 1, 5)');
    const result = evaluate(expr, {
      resolveIdentifier: () => { throw new Error('n/a'); },
      callFunction: (name, args) => {
        if (name === 'apply') {
          const [fn, val] = args as [(...a: unknown[]) => unknown, number];
          return fn(val);
        }
      },
    });
    expect(result).toBe(6);
  });

  it('supports parenthesized multi-param arrow functions', () => {
    const expr = parseExpression('apply((a, b) => a + b)');
    const result = evaluate(expr, {
      resolveIdentifier: () => { throw new Error('n/a'); },
      callFunction: (name, args) => {
        const fn = args[0] as (...a: unknown[]) => unknown;
        return fn(3, 4);
      },
    });
    expect(result).toBe(7);
  });
});

describe('object literals', () => {
  it('evaluates an object literal expression', () => {
    const expr = parseExpression('{ health: 100, name: "Ada" }');
    const result = evaluate(expr, { resolveIdentifier: () => undefined });
    expect(result).toEqual({ health: 100, name: 'Ada' });
  });
});

describe('parseScript (statements)', () => {
  it('parses assignment and compound-assignment statements', () => {
    const stmts = parseScript('health = 50\nhealth += 10');
    expect(stmts).toEqual([
      { kind: 'assign', name: 'health', op: '=', value: { kind: 'literal', value: 50 } },
      { kind: 'assign', name: 'health', op: '+=', value: { kind: 'literal', value: 10 } },
    ]);
  });

  it('accepts semicolons or newlines as statement separators', () => {
    expect(parseScript('a = 1; b = 2')).toHaveLength(2);
    expect(parseScript('a = 1\nb = 2\n')).toHaveLength(2);
  });

  it('skips blank lines and comments', () => {
    const stmts = parseScript('\n// a comment\na = 1\n\nb = 2\n');
    expect(stmts).toHaveLength(2);
  });
});
