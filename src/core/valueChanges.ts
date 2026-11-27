import { Variable, VariableType, ValueChange, ValueOp, isArrayValue, isObjectValue } from '../models/story';

// The "Set values" node: each change is variable + operator + value (or a
// question for the player). Changes compile to ordinary script lines, so the
// engine, simulator, debugger trace and validator treat them like any logic block.

export interface OpInfo {
  op: ValueOp;
  label: string;
  /** False for operators that need no value (clear, flip). */
  needsValue: boolean;
}

/** What each type of variable can do. */
export const OPS_BY_TYPE: Partial<Record<VariableType, OpInfo[]>> = {
  [VariableType.NUMBER]: [
    { op: 'set', label: 'set to', needsValue: true },
    { op: 'add', label: 'add', needsValue: true },
    { op: 'subtract', label: 'subtract', needsValue: true },
    { op: 'multiply', label: 'multiply by', needsValue: true },
    { op: 'divide', label: 'divide by', needsValue: true },
  ],
  [VariableType.STRING]: [
    { op: 'set', label: 'set to', needsValue: true },
    { op: 'append', label: 'add to end', needsValue: true },
    { op: 'clear', label: 'clear', needsValue: false },
  ],
  [VariableType.BOOLEAN]: [
    { op: 'set', label: 'set to', needsValue: true },
    { op: 'flip', label: 'flip', needsValue: false },
  ],
  [VariableType.ARRAY]: [
    { op: 'push', label: 'add item', needsValue: true },
    { op: 'remove', label: 'remove item', needsValue: true },
    { op: 'clear', label: 'clear', needsValue: false },
  ],
  [VariableType.OBJECT]: [
    { op: 'setKey', label: 'set key', needsValue: true },
  ],
};

/** An object variable's keys, for the key picker. */
export const keysOf = (variable: Variable | undefined): string[] =>
  variable && isObjectValue(variable.value) ? Object.keys(variable.value.keys) : [];

export const opsFor = (variable: Variable | undefined): OpInfo[] => (variable ? OPS_BY_TYPE[variable.type] ?? [] : []);
export const opInfo = (variable: Variable | undefined, op: ValueOp): OpInfo | undefined => opsFor(variable).find((o) => o.op === op);

/** The kind of value a change takes: a list's items take the list's item type, an object key its own type. */
export const valueTypeOf = (variable: Variable, key?: string): VariableType.NUMBER | VariableType.STRING | VariableType.BOOLEAN => {
  if (variable.type === VariableType.OBJECT) {
    const keyType = isObjectValue(variable.value) && key ? variable.value.keys[key]?.type : undefined;
    return keyType === VariableType.NUMBER ? VariableType.NUMBER : keyType === VariableType.BOOLEAN ? VariableType.BOOLEAN : VariableType.STRING;
  }
  if (variable.type === VariableType.ARRAY) {
    const itemType = isArrayValue(variable.value) ? variable.value.elementType : VariableType.STRING;
    return itemType === VariableType.NUMBER ? VariableType.NUMBER : itemType === VariableType.BOOLEAN ? VariableType.BOOLEAN : VariableType.STRING;
  }
  return variable.type === VariableType.NUMBER ? VariableType.NUMBER : variable.type === VariableType.BOOLEAN ? VariableType.BOOLEAN : VariableType.STRING;
};

/** A value (typed in the editor or by the player) as a literal of the right type, or null if it isn't one. */
export function literalFor(variable: Variable, raw: unknown, key?: string): string | null {
  const type = valueTypeOf(variable, key);
  if (type === VariableType.NUMBER) {
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
    return Number.isFinite(n) ? String(n) : null;
  }
  if (type === VariableType.BOOLEAN) return raw === true || raw === 'true' ? 'true' : raw === false || raw === 'false' ? 'false' : null;
  return raw === undefined || raw === null ? null : JSON.stringify(String(raw));
}

/** The questions a node asks the player, in order. */
export const questionsOf = (changes: ValueChange[] | undefined, variables: Variable[]) =>
  (changes ?? []).flatMap((c) => {
    const variable = variables.find((v) => v.name === c.variable);
    const info = opInfo(variable, c.op);
    const keyOk = c.op !== 'setKey' || keysOf(variable).includes(c.key ?? '');
    return variable && info?.needsValue && keyOk && c.ask !== undefined ? [{ change: c, variable }] : [];
  });

/**
 * Script lines for a node's changes. `answers` holds the player's answers by
 * change id; a question without an answer (as in the simulator, which can't
 * know what a player will type) is skipped, as is any incomplete change.
 */
export function compileChanges(changes: ValueChange[] | undefined, variables: Variable[], answers?: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const c of changes ?? []) {
    const variable = variables.find((v) => v.name === c.variable);
    const info = opInfo(variable, c.op);
    if (!variable || !info) continue;
    const name = variable.name;
    let value: string | null = null;
    if (c.op === 'setKey' && !keysOf(variable).includes(c.key ?? '')) continue;
    if (info.needsValue) {
      value = literalFor(variable, c.ask !== undefined ? answers?.[c.id] : c.value, c.key);
      if (value === null) continue;
    }
    switch (c.op) {
      case 'set': lines.push(`${name} = ${value}`); break;
      case 'add': lines.push(`${name} += ${value}`); break;
      case 'subtract': lines.push(`${name} -= ${value}`); break;
      case 'multiply': lines.push(`${name} *= ${value}`); break;
      case 'divide': lines.push(`${name} /= ${value}`); break;
      case 'append': lines.push(`${name} = ${name} + ${value}`); break;
      case 'flip': lines.push(`${name} = !${name}`); break;
      case 'push': lines.push(`${name} = push(${name}, ${value})`); break;
      case 'remove': lines.push(`${name} = remove(${name}, ${value})`); break;
      case 'setKey': lines.push(`${name} = objectSpread(${name}, { ${JSON.stringify(c.key)}: ${value} })`); break;
      case 'clear': lines.push(variable.type === VariableType.ARRAY ? `${name} = arrayFilter(${name}, (x) => false)` : `${name} = ""`); break;
    }
  }
  return lines.join('\n');
}
