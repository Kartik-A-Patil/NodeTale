import { Variable, VariableType, ArrayValue, ObjectValue } from '../models/story';
import { parseExpression, parseScript } from '../core/expression/parser';
import { collectExprIdentifiers } from '../core/validation/identifierCollector';

/**
 * Helper function to check if a value is an ObjectValue
 */
function isObjectValue(value: any): value is ObjectValue {
  return value !== null && 
         typeof value === 'object' && 
         'keys' in value && 
         typeof value.keys === 'object';
}

/**
 * Helper function to check if a value is an ArrayValue
 */
function isArrayValue(value: any): value is ArrayValue {
  return value !== null && 
         typeof value === 'object' && 
         'elementType' in value && 
         'elements' in value && 
         Array.isArray(value.elements);
}

/**
 * Helper function to throw a clear error for non-array values
 */
function assertArrayValue(value: any, functionName: string): asserts value is ArrayValue {
  if (!isArrayValue(value)) {
    const valueType = value === null ? 'null' : 
                     value === undefined ? 'undefined' : 
                     typeof value;
    throw new Error(
      `TypeError: ${functionName} can only be called on Array types. ` +
      `Received: ${valueType} (${JSON.stringify(value)}). ` +
      `Make sure the variable is defined as an Array in your project.`
    );
  }
}

/**
 * Array Methods - Support for array operations
 * Usage: arr.map((x) => x * 2), arr.filter((x) => x > 5), arr.reduce((acc, x) => acc + x, 0)
 */
export const arrayMap = (arr: ArrayValue, callback: (item: any, index: number) => any): ArrayValue => {
  assertArrayValue(arr, 'arrayMap');
  return {
    elementType: arr.elementType,
    elements: arr.elements.map(callback)
  };
};

export const arrayFilter = (arr: ArrayValue, predicate: (item: any, index: number) => boolean): ArrayValue => {
  assertArrayValue(arr, 'arrayFilter');
  return {
    elementType: arr.elementType,
    elements: arr.elements.filter(predicate)
  };
};

export const arrayReduce = (arr: ArrayValue, callback: (accumulator: any, item: any, index: number) => any, initialValue: any): any => {
  assertArrayValue(arr, 'arrayReduce');
  return arr.elements.reduce(callback, initialValue);
};

export const arrayPush = (arr: ArrayValue, ...items: any[]): ArrayValue => {
  assertArrayValue(arr, 'arrayPush');
  return {
    elementType: arr.elementType,
    elements: [...arr.elements, ...items]
  };
};

export const arrayPop = (arr: ArrayValue): { array: ArrayValue; popped: any } => {
  assertArrayValue(arr, 'arrayPop');
  const copy = [...arr.elements];
  const popped = copy.pop();
  return {
    array: { elementType: arr.elementType, elements: copy },
    popped
  };
};

export const arrayShift = (arr: ArrayValue): { array: ArrayValue; shifted: any } => {
  assertArrayValue(arr, 'arrayShift');
  const copy = [...arr.elements];
  const shifted = copy.shift();
  return {
    array: { elementType: arr.elementType, elements: copy },
    shifted
  };
};

export const arrayUnshift = (arr: ArrayValue, ...items: any[]): ArrayValue => {
  assertArrayValue(arr, 'arrayUnshift');
  return {
    elementType: arr.elementType,
    elements: [...items, ...arr.elements]
  };
};

/**
 * Helper function to throw a clear error for non-object values
 */
function assertObjectValue(value: any, functionName: string): asserts value is ObjectValue {
  if (!isObjectValue(value)) {
    const valueType = value === null ? 'null' : 
                     value === undefined ? 'undefined' : 
                     typeof value;
    throw new Error(
      `TypeError: ${functionName} can only be called on Object types. ` +
      `Received: ${valueType} (${JSON.stringify(value)}). ` +
      `Make sure the variable is defined as an Object in your project.`
    );
  }
}

/**
 * Object Methods - Support for object operations
 * Usage: Object.keys(obj), Object.values(obj), Object.entries(obj)
 */
export const objectKeys = (obj: ObjectValue): string[] => {
  assertObjectValue(obj, 'objectKeys');
  return Object.keys(obj.keys);
};

export const objectValues = (obj: ObjectValue): any[] => {
  assertObjectValue(obj, 'objectValues');
  return Object.values(obj.keys).map(v => v.value);
};

export const objectEntries = (obj: ObjectValue): Array<[string, any]> => {
  assertObjectValue(obj, 'objectEntries');
  return Object.entries(obj.keys).map(([key, val]) => [key, val.value]);
};

export const objectSpread = (obj: ObjectValue, overrides: Record<string, any>): ObjectValue => {
  assertObjectValue(obj, 'objectSpread');
  return {
    keys: {
      ...obj.keys,
      ...Object.entries(overrides).reduce((acc, [key, value]) => {
        const type = typeof value === 'number' ? VariableType.NUMBER : typeof value === 'boolean' ? VariableType.BOOLEAN : VariableType.STRING;
        acc[key] = { type, value };
        return acc;
      }, {} as any)
    }
  };
};

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

// Story text is HTML: `{{hp > 0}}` arrives as `{{hp &gt; 0}}`.
export const decodeEntities = (s: string) =>
  s.replace(/&(gt|lt|amp|quot|#39|apos|nbsp);/g, (_, e) => ({ gt: '>', lt: '<', amp: '&', quot: '"', '#39': "'", apos: "'", nbsp: ' ' })[e as string]!);

/**
 * Validate variable references in text ({{variableName}} format)
 */
export const validateVariableReferences = (text: string, variables: Variable[]): SyntaxError => {
  const errors: SyntaxError['errors'] = [];

  if (!text) {
    return { valid: true, errors };
  }

  const regex = /\{\{([^}]+)\}\}/g;
  let match;
  const known = new Set(variables.map((v) => v.name));

  while ((match = regex.exec(text)) !== null) {
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
