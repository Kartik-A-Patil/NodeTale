import { Variable, VariableType } from '../models/story';
import { VARIABLE_PATTERN, decodeEntities } from '../utils/html';
import { parseExpression, parseScript } from '../core/expression/parser';
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
 * Validate variable assignments with type checking
 */
export const validateTypeAssignments = (code: string, variables: Variable[]): SyntaxError => {
  const errors: SyntaxError['errors'] = [];

  if (!code) {
    return { valid: true, errors };
  }

  // Loosely scan for assignments and flag obvious literal mismatches.
  const assignmentRegex = /(\w+)(?:\.\w+|\[[^\]]+\])?\s*(\+?=|-?=|\*=|\/=|=)\s*([^;\n]*)/g;
  const lines = code.split('\n');

  lines.forEach((line, lineIndex) => {
    let match;
    while ((match = assignmentRegex.exec(line)) !== null) {
      const [, name, operator, rawValue] = match;
      const variable = variables.find((v) => v.name === name);
      if (!variable) continue; // Ignore unknown variables here

      // Only strict-check simple "=" assignments to primitives. Compound/object/array ops are allowed.
      if (operator !== '=') continue;

      const value = rawValue
        .replace(/;\s*$/, '')
        .replace(/\/\/.*$/, '')
        .trim();

      if (!value) continue;

      const isBoolLiteral = value === 'true' || value === 'false';
      const isNumberLiteral = !isNaN(Number(value)) && !value.match(/^['"]/);
      const isStringLiteral = value.startsWith("'") || value.startsWith('"');

      if (variable.type === VariableType.BOOLEAN && !isBoolLiteral) {
        errors.push({
          message: `Type mismatch: ${name} is boolean, but assigned ${value}`,
          line: lineIndex + 1,
          column: match.index
        });
      } else if (variable.type === VariableType.NUMBER && !isNumberLiteral) {
        errors.push({
          message: `Type mismatch: ${name} is number, but assigned ${value}`,
          line: lineIndex + 1,
          column: match.index
        });
      } else if (variable.type === VariableType.STRING && isNumberLiteral && !isStringLiteral) {
        errors.push({
          message: `Type mismatch: ${name} is string, but assigned numeric literal ${value}`,
          line: lineIndex + 1,
          column: match.index
        });
      }
    }
  });

  return { valid: errors.length === 0, errors };
};
