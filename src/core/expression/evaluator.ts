import { Expr } from './ast';

export interface EvalContext {
  resolveIdentifier: (name: string) => unknown;
  callFunction?: (name: string, args: unknown[]) => unknown;
}

// Variables keep lists/objects in their editor shapes ({elementType, elements}
// and {keys: {name: {type, value}}}); reading into them unwraps to the item.
const isList = (v: unknown): v is { elements: unknown[] } =>
  !!v && typeof v === 'object' && Array.isArray((v as { elements?: unknown }).elements);
const isRecord = (v: unknown): v is { keys: Record<string, { value: unknown }> } =>
  !!v && typeof v === 'object' && typeof (v as { keys?: unknown }).keys === 'object' && !isList(v);

function readKey(target: unknown, key: string | number): unknown {
  if (isList(target)) {
    if (key === 'length') return target.elements.length;
    const i = Number(key);
    if (Number.isInteger(i) && i >= 0 && i < target.elements.length) return target.elements[i];
    throw new Error(`List has no item ${key}`);
  }
  if (isRecord(target)) {
    if (String(key) in target.keys) return target.keys[String(key)].value;
    throw new Error(`Object has no key "${key}"`);
  }
  if (typeof target === 'string' && key === 'length') return target.length;
  if (target && typeof target === 'object' && String(key) in target) return (target as Record<string, unknown>)[String(key)];
  throw new Error(`Cannot read "${key}" of ${target === undefined ? 'nothing' : JSON.stringify(target)}`);
}

// Authors aren't programmers: "5" == 5 should hold, and two lists with the
// same items are the same list.
export function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'string') return b.trim() !== '' && Number(b) === a;
  if (typeof a === 'string' && typeof b === 'number') return a.trim() !== '' && Number(a) === b;
  if (a && b && typeof a === 'object' && typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

export function evaluate(expr: Expr, ctx: EvalContext): unknown {
  switch (expr.kind) {
    case 'literal':
      return expr.value;

    case 'identifier':
      return ctx.resolveIdentifier(expr.name);

    case 'unary': {
      const value = evaluate(expr.expr, ctx);
      return expr.op === '!' ? !value : -(value as number);
    }

    case 'binary': {
      if (expr.op === '&&') return evaluate(expr.left, ctx) && evaluate(expr.right, ctx);
      if (expr.op === '||') return evaluate(expr.left, ctx) || evaluate(expr.right, ctx);

      const left = evaluate(expr.left, ctx);
      const right = evaluate(expr.right, ctx);

      switch (expr.op) {
        case '+': return (left as any) + (right as any);
        case '-': return (left as number) - (right as number);
        case '*': return (left as number) * (right as number);
        case '/': return (left as number) / (right as number);
        case '%': return (left as number) % (right as number);
        case '==': return looseEqual(left, right);
        case '!=': return !looseEqual(left, right);
        case '>': return Number(left) > Number(right);
        case '<': return Number(left) < Number(right);
        case '>=': return Number(left) >= Number(right);
        case '<=': return Number(left) <= Number(right);
      }
      throw new Error(`Unsupported operator: ${(expr as any).op}`);
    }

    case 'ternary':
      return evaluate(expr.test, ctx) ? evaluate(expr.then, ctx) : evaluate(expr.otherwise, ctx);

    case 'member':
      return readKey(evaluate(expr.object, ctx), expr.property);

    case 'index': {
      const key = evaluate(expr.index, ctx);
      return readKey(evaluate(expr.object, ctx), typeof key === 'number' ? key : String(key));
    }

    case 'call': {
      if (!ctx.callFunction) throw new Error(`Function calls are not supported: ${expr.callee}(...)`);
      const args = expr.args.map(a => evaluate(a, ctx));
      return ctx.callFunction(expr.callee, args);
    }

    case 'arrow': {
      const { params, body } = expr;
      return (...args: unknown[]) => {
        const childCtx: EvalContext = {
          ...ctx,
          resolveIdentifier: (name) => {
            const idx = params.indexOf(name);
            return idx !== -1 ? args[idx] : ctx.resolveIdentifier(name);
          },
        };
        return evaluate(body, childCtx);
      };
    }

    case 'object': {
      const result: Record<string, unknown> = {};
      for (const [key, valueExpr] of expr.entries) {
        result[key] = evaluate(valueExpr, ctx);
      }
      return result;
    }
  }
}
