import { parseScript, parseExpression, ExpressionSyntaxError } from '../expression/parser';
import { evaluate, EvalContext, looseEqual } from '../expression/evaluator';
import { Stmt } from '../expression/ast';
import { ArrayValue } from '../../models/story';
import {
  arrayMap, arrayFilter, arrayReduce, arrayPush, arrayPop, arrayShift, arrayUnshift,
  objectKeys, objectValues, objectEntries, objectSpread, decodeEntities,
} from '../../services/logicService';

/** Where random() and chance() get their luck. Play Mode rolls real dice; the
 *  simulator plugs in one that explores every outcome (see enumerateOutcomes). */
export interface Rng {
  int(min: number, max: number): number;
  chance(p: number): boolean;
}

export const mathRng: Rng = {
  int: (min, max) => min + Math.floor(Math.random() * (max - min + 1)),
  chance: (p) => Math.random() < p,
};

/** Always the first outcome: for read-only previews such as labelling a choice. */
export const firstOutcomeRng: Rng = { int: (min) => min, chance: (p) => p > 0 };

const num = (v: unknown, fn: string): number => {
  const n = typeof v === 'number' ? v : Number(v);
  if (typeof v === 'boolean' || Number.isNaN(n)) throw new Error(`${fn}() needs a number, got ${JSON.stringify(v)}`);
  return n;
};
const asList = (v: unknown, fn: string): ArrayValue => {
  if (v && typeof v === 'object' && Array.isArray((v as ArrayValue).elements)) return v as ArrayValue;
  throw new Error(`${fn}() needs a list, got ${JSON.stringify(v)}`);
};

// The only functions a script or condition can call: no window/document/
// process/require/fs/ipcRenderer or any Node/Electron API. Without an rng
// (story text, choice conditions), random() and chance() refuse to run, so
// re-rendering a scene never re-rolls what the player sees.
export function makeFunctions(rng?: Rng): Record<string, (...args: any[]) => unknown> {
  const noLuck = (fn: string) => () => {
    throw new Error(`${fn}() only works in scripts and branch conditions; roll it into a variable first`);
  };
  return {
    // math
    min: (...xs: unknown[]) => Math.min(...xs.map((x) => num(x, 'min'))),
    max: (...xs: unknown[]) => Math.max(...xs.map((x) => num(x, 'max'))),
    clamp: (x: unknown, lo: unknown, hi: unknown) => Math.min(num(hi, 'clamp'), Math.max(num(lo, 'clamp'), num(x, 'clamp'))),
    round: (x: unknown, digits: unknown = 0) => {
      const f = 10 ** num(digits, 'round');
      return Math.round(num(x, 'round') * f) / f;
    },
    floor: (x: unknown) => Math.floor(num(x, 'floor')),
    ceil: (x: unknown) => Math.ceil(num(x, 'ceil')),
    abs: (x: unknown) => Math.abs(num(x, 'abs')),
    // luck
    random: rng
      ? (a: unknown, b: unknown) => {
          const [lo, hi] = [Math.ceil(num(a, 'random')), Math.floor(num(b, 'random'))].sort((x, y) => x - y);
          return rng.int(lo, hi);
        }
      : noLuck('random'),
    chance: rng
      ? (p: unknown) => {
          const n = num(p, 'chance');
          return n <= 0 ? false : n >= 1 ? true : rng.chance(n);
        }
      : noLuck('chance'),
    // lists and objects
    len: (v: unknown) => {
      if (typeof v === 'string') return v.length;
      if (v && typeof v === 'object' && Array.isArray((v as ArrayValue).elements)) return (v as ArrayValue).elements.length;
      if (v && typeof v === 'object' && 'keys' in v) return Object.keys((v as { keys: object }).keys).length;
      throw new Error(`len() needs a list, object or text, got ${JSON.stringify(v)}`);
    },
    has: (v: unknown, item: unknown) => {
      if (typeof v === 'string') return v.includes(String(item));
      if (v && typeof v === 'object' && Array.isArray((v as ArrayValue).elements)) return (v as ArrayValue).elements.some((e) => looseEqual(e, item));
      if (v && typeof v === 'object' && 'keys' in v) return String(item) in (v as { keys: object }).keys;
      throw new Error(`has() needs a list, object or text, got ${JSON.stringify(v)}`);
    },
    push: (list: unknown, ...items: unknown[]) => arrayPush(asList(list, 'push'), ...items),
    pop: (list: unknown) => {
      const l = asList(list, 'pop');
      return { ...l, elements: l.elements.slice(0, -1) };
    },
    remove: (list: unknown, item: unknown) => {
      const l = asList(list, 'remove');
      const i = l.elements.findIndex((e) => looseEqual(e, item));
      return i < 0 ? l : { ...l, elements: [...l.elements.slice(0, i), ...l.elements.slice(i + 1)] };
    },
    // original helpers, kept so existing stories keep working
    arrayMap, arrayFilter, arrayReduce, arrayPush, arrayPop, arrayShift, arrayUnshift,
    objectKeys, objectValues, objectEntries, objectSpread,
  };
}

/** What each callable function looks like, for autocomplete and Help. */
export const SCRIPT_FUNCTIONS: { name: string; signature: string; description: string }[] = [
  { name: 'random', signature: 'random(1, 6)', description: 'A whole number from min to max, both included' },
  { name: 'chance', signature: 'chance(0.3)', description: 'true about 30% of the time' },
  { name: 'min', signature: 'min(a, b, …)', description: 'The smallest number' },
  { name: 'max', signature: 'max(a, b, …)', description: 'The largest number' },
  { name: 'clamp', signature: 'clamp(x, low, high)', description: 'x kept between low and high' },
  { name: 'round', signature: 'round(x, digits)', description: 'x rounded (digits is optional)' },
  { name: 'floor', signature: 'floor(x)', description: 'x rounded down' },
  { name: 'ceil', signature: 'ceil(x)', description: 'x rounded up' },
  { name: 'abs', signature: 'abs(x)', description: 'x without its minus sign' },
  { name: 'len', signature: 'len(list)', description: 'How many items (or keys, or letters)' },
  { name: 'has', signature: 'has(list, item)', description: 'Whether the list holds item (or the object has that key)' },
  { name: 'push', signature: 'push(list, item)', description: 'The list with item added at the end' },
  { name: 'pop', signature: 'pop(list)', description: 'The list without its last item' },
  { name: 'remove', signature: 'remove(list, item)', description: 'The list without the first matching item' },
  { name: 'arrayMap', signature: 'arrayMap(list, (x) => …)', description: 'A new list with every item changed' },
  { name: 'arrayFilter', signature: 'arrayFilter(list, (x) => …)', description: 'A new list with only matching items' },
  { name: 'arrayReduce', signature: 'arrayReduce(list, (sum, x) => …, start)', description: 'Combines the items into one value' },
  { name: 'objectKeys', signature: 'objectKeys(object)', description: 'The object’s property names' },
  { name: 'objectValues', signature: 'objectValues(object)', description: 'The object’s values' },
  { name: 'objectSpread', signature: 'objectSpread(object, changes)', description: 'A copy of the object with changes applied' },
];

export interface ScriptRunResult {
  changes: Record<string, unknown>;
  error?: string;
}

/** Context for evaluating a condition/expression against variable values. */
export function makeEvalContext(scope: Record<string, unknown>, rng?: Rng): EvalContext {
  const fns = makeFunctions(rng);
  return {
    resolveIdentifier: (name) => {
      if (name in scope) return scope[name];
      throw new Error(`Unknown variable: ${name}`);
    },
    callFunction: (name, args) => {
      const fn = fns[name];
      if (!fn) throw new Error(`Unknown function: ${name}`);
      return fn(...args);
    },
  };
}

export const formatScriptError = (err: unknown) =>
  err instanceof ExpressionSyntaxError ? `Syntax error: ${err.message}` : (err as Error)?.message || String(err);

// Restricted interpreter, not JS: no loops or arbitrary calls, only the
// grammar in src/core/expression/ and the functions above. The sandboxing is
// that nothing else can ever run, unlike shadowing globals on `new Function`/`eval`.
export function runScript(code: string, readScope: Record<string, unknown>, rng?: Rng): ScriptRunResult {
  const live: Record<string, unknown> = { ...readScope };
  const changedNames = new Set<string>();
  const ctx = makeEvalContext(live, rng);

  const exec = (statements: Stmt[]) => {
    for (const stmt of statements) {
      if (stmt.kind === 'if') {
        exec(evaluate(stmt.test, ctx) ? stmt.then : stmt.otherwise ?? []);
        continue;
      }
      if (stmt.kind === 'expr') {
        evaluate(stmt.expr, ctx);
        continue;
      }
      // Assignment target must be a project-declared variable: no ad-hoc
      // script-local variables.
      if (!(stmt.name in live)) throw new Error(`Unknown variable: ${stmt.name}`);

      const rhs = evaluate(stmt.value, ctx);
      const current = live[stmt.name];
      if (stmt.op === '=') live[stmt.name] = rhs;
      else if (stmt.op === '+=') live[stmt.name] = (current as any) + (rhs as any);
      else if (stmt.op === '-=') live[stmt.name] = (current as number) - (rhs as number);
      else if (stmt.op === '*=') live[stmt.name] = (current as number) * (rhs as number);
      else if (stmt.op === '/=') live[stmt.name] = (current as number) / (rhs as number);
      changedNames.add(stmt.name);
    }
  };

  let error: string | undefined;
  try {
    exec(parseScript(code));
  } catch (err) {
    error = formatScriptError(err);
  }
  const changes: Record<string, unknown> = {};
  changedNames.forEach((name) => { changes[name] = live[name]; });
  return error ? { changes, error } : { changes };
}

/** A branch/choice condition. An empty condition always holds; a broken one
 *  never does (play continues) and onError says why. */
export function evaluateCondition(
  condition: string | undefined,
  scope: Record<string, unknown>,
  opts: { rng?: Rng; onError?: (message: string) => void } = {}
): boolean {
  if (!condition?.trim()) return true;
  try {
    return Boolean(evaluate(parseExpression(condition), makeEvalContext(scope, opts.rng)));
  } catch (err) {
    opts.onError?.(`Condition "${condition}": ${formatScriptError(err)}`);
    return false;
  }
}

const textValue = (v: unknown): string => {
  if (v && typeof v === 'object') {
    if (Array.isArray((v as ArrayValue).elements)) return (v as ArrayValue).elements.join(', ');
    if ('keys' in v) {
      return Object.entries((v as { keys: Record<string, { value: unknown }> }).keys).map(([k, e]) => `${k}: ${e.value}`).join(', ');
    }
    return JSON.stringify(v);
  }
  return String(v);
};

/** Fills `{{expression}}` in story text: {{gold}}, {{gold * 2}}, {{stats.hp}},
 *  {{items[0]}}, {{hp > 0 ? 'alive' : 'dead'}}. A broken one stays as typed. */
export function interpolateText(html: string, scope: Record<string, unknown>): string {
  if (!html) return '';
  return html.replace(/\{\{([^}]+)\}\}/g, (match, source: string) => {
    try {
      return textValue(evaluate(parseExpression(decodeEntities(source)), makeEvalContext(scope)));
    } catch {
      return match;
    }
  });
}
