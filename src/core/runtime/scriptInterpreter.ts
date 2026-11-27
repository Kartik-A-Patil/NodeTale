import { parseScript, parseExpression, ExpressionSyntaxError } from '../expression/parser';
import { evaluate, EvalContext, looseEqual } from '../expression/evaluator';
import { Stmt } from '../expression/ast';
import { ArrayValue, ObjectValue, VariableType, isArrayValue, isObjectValue } from '../../models/story';
import { VARIABLE_PATTERN, decodeEntities } from '../../utils/html';

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
  if (isArrayValue(v)) return v;
  throw new Error(`${fn}() needs a list, got ${JSON.stringify(v)}`);
};
const asObject = (v: unknown, fn: string): ObjectValue => {
  if (isObjectValue(v)) return v;
  throw new Error(`${fn}() needs an object, got ${JSON.stringify(v)}`);
};
const withElements = (list: ArrayValue, elements: unknown[]): ArrayValue => ({ ...list, elements: elements as ArrayValue['elements'] });
const typeOf = (value: unknown) =>
  typeof value === 'number' ? VariableType.NUMBER : typeof value === 'boolean' ? VariableType.BOOLEAN : VariableType.STRING;

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
      if (isArrayValue(v)) return v.elements.length;
      if (isObjectValue(v)) return Object.keys(v.keys).length;
      throw new Error(`len() needs a list, object or text, got ${JSON.stringify(v)}`);
    },
    has: (v: unknown, item: unknown) => {
      if (typeof v === 'string') return v.includes(String(item));
      if (isArrayValue(v)) return v.elements.some((e) => looseEqual(e, item));
      if (isObjectValue(v)) return String(item) in v.keys;
      throw new Error(`has() needs a list, object or text, got ${JSON.stringify(v)}`);
    },
    push: (list: unknown, ...items: unknown[]) => { const l = asList(list, 'push'); return withElements(l, [...l.elements, ...items]); },
    pop: (list: unknown) => { const l = asList(list, 'pop'); return withElements(l, l.elements.slice(0, -1)); },
    remove: (list: unknown, item: unknown) => {
      const l = asList(list, 'remove');
      const i = l.elements.findIndex((e) => looseEqual(e, item));
      return i < 0 ? l : withElements(l, l.elements.filter((_, j) => j !== i));
    },
    // Original helpers, kept so existing stories keep working.
    arrayMap: (list: unknown, f: (x: unknown, i: number) => unknown) => { const l = asList(list, 'arrayMap'); return withElements(l, l.elements.map(f)); },
    arrayFilter: (list: unknown, f: (x: unknown, i: number) => unknown) => { const l = asList(list, 'arrayFilter'); return withElements(l, l.elements.filter(f)); },
    arrayReduce: (list: unknown, f: (acc: unknown, x: unknown, i: number) => unknown, start: unknown) => asList(list, 'arrayReduce').elements.reduce<unknown>(f, start),
    arrayPush: (list: unknown, ...items: unknown[]) => { const l = asList(list, 'arrayPush'); return withElements(l, [...l.elements, ...items]); },
    arrayUnshift: (list: unknown, ...items: unknown[]) => { const l = asList(list, 'arrayUnshift'); return withElements(l, [...items, ...l.elements]); },
    arrayPop: (list: unknown) => { const l = asList(list, 'arrayPop'); return { array: withElements(l, l.elements.slice(0, -1)), popped: l.elements.at(-1) }; },
    arrayShift: (list: unknown) => { const l = asList(list, 'arrayShift'); return { array: withElements(l, l.elements.slice(1)), shifted: l.elements[0] }; },
    objectKeys: (o: unknown) => Object.keys(asObject(o, 'objectKeys').keys),
    objectValues: (o: unknown) => Object.values(asObject(o, 'objectValues').keys).map((e) => e.value),
    objectEntries: (o: unknown) => Object.entries(asObject(o, 'objectEntries').keys).map(([k, e]) => [k, e.value]),
    objectSpread: (o: unknown, changes: Record<string, unknown>) => {
      const obj = asObject(o, 'objectSpread');
      const keys = { ...obj.keys };
      for (const [k, value] of Object.entries(changes ?? {})) keys[k] = { type: typeOf(value), value: value as string | number | boolean };
      return { keys };
    },
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

/** One thing the engine did, for the Play Mode debugger. */
export interface TraceLine {
  nodeId?: string;
  source: 'script' | 'branch' | 'jump' | 'choice';
  /** Script line number (1-based), for script/choice lines. */
  line?: number;
  /** What ran: the script line, "If gold > 5", "Jump to Hall". */
  text: string;
  /** What came of it: "gold: 10 → 20", "true", "taken". */
  note: string;
  error?: boolean;
}

const show = (v: unknown): string => (typeof v === 'string' ? JSON.stringify(v) : textValue(v));

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
export function runScript(code: string, readScope: Record<string, unknown>, rng?: Rng, trace?: TraceLine[]): ScriptRunResult {
  const live: Record<string, unknown> = { ...readScope };
  const changedNames = new Set<string>();
  const ctx = makeEvalContext(live, rng);
  const lines = trace ? code.split('\n') : [];
  let running: Stmt | undefined;
  const lineOf = (stmt: Stmt) => (stmt.pos === undefined ? 1 : code.slice(0, stmt.pos).split('\n').length);
  const note = (stmt: Stmt, text: string, error?: boolean) => {
    const line = lineOf(stmt);
    trace!.push({ source: 'script', line, text: lines[line - 1]?.trim() ?? '', note: text, ...(error ? { error } : {}) });
  };

  const exec = (statements: Stmt[]) => {
    for (const stmt of statements) {
      running = stmt;
      if (stmt.kind === 'if') {
        const pass = !!evaluate(stmt.test, ctx);
        if (trace) note(stmt, pass ? 'true' : stmt.otherwise ? 'false → else' : 'false');
        exec(pass ? stmt.then : stmt.otherwise ?? []);
        continue;
      }
      if (stmt.kind === 'expr') {
        evaluate(stmt.expr, ctx);
        if (trace) note(stmt, 'ran');
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
      if (trace) note(stmt, `${stmt.name}: ${show(current)} → ${show(live[stmt.name])}`);
    }
  };

  let error: string | undefined;
  try {
    exec(parseScript(code));
  } catch (err) {
    error = formatScriptError(err);
    if (trace) {
      if (running) note(running, error, true);
      else trace.push({ source: 'script', text: lines[0]?.trim() ?? '', note: error, error: true });
    }
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
  if (isArrayValue(v)) return v.elements.join(', ');
  if (isObjectValue(v)) return Object.entries(v.keys).map(([k, e]) => `${k}: ${e.value}`).join(', ');
  return v && typeof v === 'object' ? JSON.stringify(v) : String(v);
};

/** Fills `{{expression}}` in story text: {{gold}}, {{gold * 2}}, {{stats.hp}},
 *  {{items[0]}}, {{hp > 0 ? 'alive' : 'dead'}}. A broken one stays as typed. */
export function interpolateText(html: string, scope: Record<string, unknown>): string {
  if (!html) return '';
  return html.replace(VARIABLE_PATTERN, (match, source: string) => {
    try {
      return textValue(evaluate(parseExpression(decodeEntities(source)), makeEvalContext(scope)));
    } catch {
      return match;
    }
  });
}
