import { Variable, VariableType, ArrayValue, ObjectValue } from '../types';

export const evaluateCondition = (conditionStr: string | undefined, variables: Variable[]): boolean => {
  if (!conditionStr) return true;

  // Very basic parser: "variableName == value"
  // Supports ==, !=, >, <
  
  // 1. Find the variable
  const variable = variables.find(v => conditionStr.includes(v.name));
  if (!variable) return false;

  let operator = '';
  if (conditionStr.includes('==')) operator = '==';
  else if (conditionStr.includes('!=')) operator = '!=';
  else if (conditionStr.includes('>')) operator = '>';
  else if (conditionStr.includes('<')) operator = '<';

  if (!operator) return false;

  const parts = conditionStr.split(operator);
  const targetValueRaw = parts[1].trim();
  
  let targetValue: any = targetValueRaw;
  
  if (variable.type === VariableType.BOOLEAN) {
    targetValue = targetValueRaw === 'true';
  } else if (variable.type === VariableType.NUMBER) {
    targetValue = Number(targetValueRaw);
  } else {
    targetValue = targetValueRaw.replace(/['"]/g, '');
  }

  const currentValue = variable.value;

  switch (operator) {
    case '==': return currentValue === targetValue;
    case '!=': return currentValue !== targetValue;
    case '>': return Number(currentValue) > Number(targetValue);
    case '<': return Number(currentValue) < Number(targetValue);
    default: return false;
  }
};

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
 * Replace variable interpolations in text with their actual values.
 * Supports: {{varName}}, {{obj.key}}, {{arr[0]}}
 */
export const replaceVariablesInText = (text: string, variables: Variable[]): string => {
  if (!text) return '';
  let processed = text;
  
  // Match {{anything}} patterns
  const pattern = /\{\{([^}]+)\}\}/g;
  
  processed = processed.replace(pattern, (match, expression) => {
    const trimmed = expression.trim();
    
    // Check for array index access: varName[index]
    const arrayMatch = trimmed.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, varName, indexStr] = arrayMatch;
      const variable = variables.find(v => v.name === varName);
      if (!variable) return match; // Keep original if not found
      
      if (variable.type === VariableType.ARRAY && isArrayValue(variable.value)) {
        const index = parseInt(indexStr, 10);
        const element = variable.value.elements[index];
        return element !== undefined ? String(element) : match;
      }
      return match; // Not an array or out of bounds
    }
    
    // Check for object property access: varName.key
    const objectMatch = trimmed.match(/^(\w+)\.(\w+)$/);
    if (objectMatch) {
      const [, varName, key] = objectMatch;
      const variable = variables.find(v => v.name === varName);
      if (!variable) return match; // Keep original if not found
      
      if (variable.type === VariableType.OBJECT && isObjectValue(variable.value)) {
        const value = variable.value.keys[key];
        return value !== undefined ? String(value) : match;
      }
      return match; // Not an object or key doesn't exist
    }
    
    // Simple variable: varName
    const variable = variables.find(v => v.name === trimmed);
    if (!variable) return match; // Keep original if not found
    
    // Handle different types
    if (variable.type === VariableType.ARRAY && isArrayValue(variable.value)) {
      return JSON.stringify(variable.value.elements);
    }
    if (variable.type === VariableType.OBJECT && isObjectValue(variable.value)) {
      return JSON.stringify(variable.value.keys);
    }
    
    return String(variable.value);
  });
  
  return processed;
};

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
        acc[key] = { type: VariableType.STRING, value };
        return acc;
      }, {} as any)
    }
  };
};

/**
 * Syntax Validation - Check JavaScript code in nodes for syntax errors
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
    // Try to parse as function body
    new Function(code);
    return { valid: true, errors };
  } catch (err: any) {
    // Extract error info
    const errorMsg = err.message || 'Unknown syntax error';
    const lineMatch = errorMsg.match(/line (\d+)/i);
    const line = lineMatch ? parseInt(lineMatch[1]) : 1;

    errors.push({
      message: errorMsg.split('\n')[0], // Get first line of error
      line,
      column: 0
    });

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

  const regex = /\{\{([^}]+)\}\}/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const varName = match[1].trim();
    if (!variables.some(v => v.name === varName)) {
      errors.push({
        message: `Undefined variable: ${varName}`,
        line: text.substring(0, match.index).split('\n').length,
        column: match.index
      });
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
