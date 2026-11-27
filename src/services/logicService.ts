import { Variable, VariableType } from '../models/story';
import { VARIABLE_PATTERN, decodeEntities } from '../utils/html';
import { parseExpression, parseScript } from '../core/expression/parser';
import type { Expr, Stmt } from '../core/expression/ast';
import { collectExprIdentifiers } from '../core/validation/identifierCollector';

/**
 * Syntax check for a logic block
 */
export interface SyntaxError {
  valid: boolean;
  errors: Array<{
    message: string;
    line: number;
    column: number;
  }>;
}

export const validateCodeSyntax = (code: string): SyntaxError => {
  const errors: SyntaxError['errors'] = [];

  if (!code || !code.trim()) {
    return { valid: true, errors };
  }

  try {
    // The story's own grammar, not JavaScript's: what parses here is what runs.
    parseScript(code);
    return { valid: true, errors };
  } catch (err) {
    const message = (err as Error).message || 'Unknown syntax error';
    const pos = Number(message.match(/position (\d+)/)?.[1] ?? 0);
    errors.push({ message, line: code.slice(0, pos).split('\n').length, column: 0 });
    return { valid: false, errors };
  }
};

/**
 * Validate variable references in text ({{variableName}} format)
 */
export const validateVariableReferences = (text: string, variables: Variable[]): SyntaxError => {
  const errors: SyntaxError['errors'] = [];

  if (!text) {
    return { valid: true, errors };
  }

  const known = new Set(variables.map((v) => v.name));

  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    const line = text.substring(0, match.index).split('\n').length;
    try {
      for (const name of collectExprIdentifiers(parseExpression(decodeEntities(match[1])))) {
        if (!known.has(name)) errors.push({ message: `Undefined variable: ${name}`, line, column: match.index });
      }
    } catch (err) {
      errors.push({ message: `Text expression {{${match[1].trim()}}} has a syntax error: ${(err as Error).message}`, line, column: match.index });
    }
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Flags `name = <literal>` where the literal can't be that variable's type
 * (e.g. `gold = "ten"`). Works on the parsed script, so `==` in an if, or a
 * value only known at play time (`random(1, 6)`, `hp - 5`), is never misread.
 */
export const validateTypeAssignments = (code: string, variables: Variable[]): SyntaxError => {
  const errors: SyntaxError['errors'] = [];
  let statements: Stmt[];
  try {
    statements = parseScript(code);
  } catch {
    return { valid: true, errors }; // syntax problems are validateCodeSyntax's to report
  }
  const types = new Map(variables.map((v) => [v.name, v.type]));
  const literalOf = (e: Expr): string | number | boolean | undefined =>
    e.kind === 'literal' ? e.value : e.kind === 'unary' && e.op === '-' && e.expr.kind === 'literal' && typeof e.expr.value === 'number' ? -e.expr.value : undefined;
  const expected: Partial<Record<VariableType, string>> = { [VariableType.NUMBER]: 'number', [VariableType.BOOLEAN]: 'boolean', [VariableType.STRING]: 'string' };

  const walk = (list: Stmt[]) => {
    for (const stmt of list) {
      if (stmt.kind === 'if') {
        walk(stmt.then);
        if (stmt.otherwise) walk(stmt.otherwise);
        continue;
      }
      if (stmt.kind !== 'assign' || stmt.op !== '=') continue;
      const want = expected[types.get(stmt.name) as VariableType];
      const value = literalOf(stmt.value);
      if (!want || value === undefined || typeof value === want) continue;
      errors.push({
        message: `Type mismatch: ${stmt.name} is ${want}, but assigned ${JSON.stringify(value)}`,
        line: code.slice(0, stmt.pos ?? 0).split('\n').length,
        column: 0,
      });
    }
  };
  walk(statements);
  return { valid: errors.length === 0, errors };
};
