import type { LucideIcon } from 'lucide-react';
import { Braces, Hash, List, ToggleLeft, Type } from 'lucide-react';
import { VariableType } from '../models/story';

/** How each variable type is shown everywhere: its icon, name, hint and code colour (--nt-code-* in index.css). */
export const VARIABLE_TYPES: { type: VariableType; label: string; hint: string; icon: LucideIcon; color: string }[] = [
  { type: VariableType.BOOLEAN, label: 'True / false', hint: 'A flag: has the key, met the guard', icon: ToggleLeft, color: 'var(--nt-code-keyword)' },
  { type: VariableType.NUMBER, label: 'Number', hint: 'Gold, health, a counter', icon: Hash, color: 'var(--nt-code-number)' },
  { type: VariableType.STRING, label: 'Text', hint: 'A name or a word', icon: Type, color: 'var(--nt-code-string)' },
  { type: VariableType.ARRAY, label: 'List', hint: 'An inventory, visited places', icon: List, color: 'var(--nt-code-list)' },
  { type: VariableType.OBJECT, label: 'Object', hint: 'Named values, like player stats', icon: Braces, color: 'var(--nt-code-object)' },
];

export const variableTypeInfo = (type: VariableType) => VARIABLE_TYPES.find((t) => t.type === type) ?? VARIABLE_TYPES[0];

/** Colours for non-variable completions, in the same code-editor palette. */
export const CODE_COLORS = { function: 'var(--nt-code-function)', keyword: 'var(--nt-code-keyword)' };
