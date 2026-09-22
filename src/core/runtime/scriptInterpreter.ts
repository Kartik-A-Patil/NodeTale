import { parseScript, ExpressionSyntaxError } from '../expression/parser';
import { evaluate, EvalContext } from '../expression/evaluator';
import {
  arrayMap, arrayFilter, arrayReduce, arrayPush, arrayPop, arrayShift, arrayUnshift,
  objectKeys, objectValues, objectEntries, objectSpread,
} from '../../services/logicService';

// The only functions a node script can call — no window/document/process/
// require/fs/ipcRenderer or any Node/Electron API.
const WHITELISTED_FUNCTIONS: Record<string, (...args: any[]) => unknown> = {
  arrayMap, arrayFilter, arrayReduce, arrayPush, arrayPop, arrayShift, arrayUnshift,
  objectKeys, objectValues, objectEntries, objectSpread,
};

export interface ScriptRunResult {
  changes: Record<string, unknown>;
  error?: string;
}

// Restricted interpreter, not JS: no loops/if-else/arbitrary calls, only the
// grammar in src/core/expression/ and the whitelist above — the sandboxing is
// that nothing else can ever run, unlike shadowing globals on `new Function`/`eval`.
export function runScript(code: string, readScope: Record<string, unknown>): ScriptRunResult {
  const live: Record<string, unknown> = { ...readScope };
  const changedNames = new Set<string>();

  const ctx: EvalContext = {
    resolveIdentifier: (name) => {
      if (name in live) return live[name];
      throw new Error(`Unknown variable: ${name}`);
    },
    callFunction: (name, args) => {
      const fn = WHITELISTED_FUNCTIONS[name];
      if (!fn) throw new Error(`Unknown function: ${name}`);
      return fn(...args);
    },
  };

  try {
    const statements = parseScript(code);

    for (const stmt of statements) {
      if (stmt.kind !== 'assign') {
        evaluate(stmt.expr, ctx);
        continue;
      }

      // Assignment target must be a project-declared variable — no ad-hoc
      // script-local variables.
      if (!(stmt.name in live)) {
        throw new Error(`Unknown variable: ${stmt.name}`);
      }

      const rhs = evaluate(stmt.value, ctx);
      if (stmt.op === '=') {
        live[stmt.name] = rhs;
      } else {
        const current = live[stmt.name];
        if (stmt.op === '+=') live[stmt.name] = (current as any) + (rhs as any);
        else if (stmt.op === '-=') live[stmt.name] = (current as number) - (rhs as number);
        else if (stmt.op === '*=') live[stmt.name] = (current as number) * (rhs as number);
        else if (stmt.op === '/=') live[stmt.name] = (current as number) / (rhs as number);
      }
      changedNames.add(stmt.name);
    }
  } catch (err) {
    const message = err instanceof ExpressionSyntaxError ? `Syntax error: ${err.message}` : (err as Error)?.message || String(err);
    const changes: Record<string, unknown> = {};
    changedNames.forEach((name) => { changes[name] = live[name]; });
    return { changes, error: message };
  }

  const changes: Record<string, unknown> = {};
  changedNames.forEach((name) => { changes[name] = live[name]; });
  return { changes };
}
