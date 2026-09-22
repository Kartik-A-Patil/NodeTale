import { Expr } from './ast';

export interface EvalContext {
  resolveIdentifier: (name: string) => unknown;
  callFunction?: (name: string, args: unknown[]) => unknown;
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
        case '==': return left === right;
        case '!=': return left !== right;
        case '>': return Number(left) > Number(right);
        case '<': return Number(left) < Number(right);
        case '>=': return Number(left) >= Number(right);
        case '<=': return Number(left) <= Number(right);
      }
      throw new Error(`Unsupported operator: ${(expr as any).op}`);
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
