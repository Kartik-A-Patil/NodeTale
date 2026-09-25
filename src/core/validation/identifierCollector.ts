import { Expr, Stmt } from '../expression/ast';

// Collects the names of identifiers a condition/script expression *reads* as a
// variable reference — excluding names bound locally by an enclosing arrow
// function's own parameters (e.g. the `x` in `arrayMap(items, x => x * 2)` is
// not a project variable).
export function collectExprIdentifiers(expr: Expr, bound: Set<string> = new Set(), out: Set<string> = new Set()): Set<string> {
  switch (expr.kind) {
    case 'literal':
      break;
    case 'identifier':
      if (!bound.has(expr.name)) out.add(expr.name);
      break;
    case 'unary':
      collectExprIdentifiers(expr.expr, bound, out);
      break;
    case 'binary':
      collectExprIdentifiers(expr.left, bound, out);
      collectExprIdentifiers(expr.right, bound, out);
      break;
    case 'call':
      // expr.callee is a function name (array/object helper), not a variable.
      expr.args.forEach((a) => collectExprIdentifiers(a, bound, out));
      break;
    case 'arrow': {
      const innerBound = new Set(bound);
      expr.params.forEach((p) => innerBound.add(p));
      collectExprIdentifiers(expr.body, innerBound, out);
      break;
    }
    case 'object':
      expr.entries.forEach(([, v]) => collectExprIdentifiers(v, bound, out));
      break;
  }
  return out;
}

// Same, but for a full script (sequence of statements). An assignment's target
// (`health = ...`) is also treated as a variable reference — it has to exist.
export function collectScriptIdentifiers(statements: Stmt[]): Set<string> {
  const out = new Set<string>();
  for (const stmt of statements) {
    if (stmt.kind === 'assign') {
      out.add(stmt.name);
      collectExprIdentifiers(stmt.value, new Set(), out);
    } else {
      collectExprIdentifiers(stmt.expr, new Set(), out);
    }
  }
  return out;
}
