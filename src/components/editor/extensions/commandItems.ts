import type { Editor, Range } from '@tiptap/core';
import type { LucideIcon } from 'lucide-react';
import {
  Braces, Code, Heading1, Heading2, Heading3, List, ListOrdered, Minus, Pilcrow, Quote, SquareFunction, KeyRound,
} from 'lucide-react';
import { CODE_COLORS, variableTypeInfo } from '../../variableTypes';
import type { Variable } from '../../../models/story';
import { SCRIPT_FUNCTIONS } from '../../../core/runtime/scriptInterpreter';

export interface CommandItem {
  id: string;
  title: string;
  hint?: string;
  icon?: LucideIcon;
  /** Icon colour (by kind, like a code editor); neutral when unset. */
  color?: string;
  keywords?: string[];
  run: (editor: Editor, range: Range) => void;
}

const block = (run: (editor: Editor) => void) => (editor: Editor, range: Range) => {
  editor.chain().focus().deleteRange(range).run();
  run(editor);
};

export const SLASH_COMMANDS: CommandItem[] = [
  { id: 'text', title: 'Text', hint: 'Plain paragraph', icon: Pilcrow, keywords: ['paragraph'], run: block((e) => e.chain().focus().setParagraph().run()) },
  { id: 'h1', title: 'Heading 1', hint: 'Large section title', icon: Heading1, keywords: ['title'], run: block((e) => e.chain().focus().setHeading({ level: 1 }).run()) },
  { id: 'h2', title: 'Heading 2', hint: 'Medium heading', icon: Heading2, keywords: ['subtitle'], run: block((e) => e.chain().focus().setHeading({ level: 2 }).run()) },
  { id: 'h3', title: 'Heading 3', hint: 'Small heading', icon: Heading3, run: block((e) => e.chain().focus().setHeading({ level: 3 }).run()) },
  { id: 'bullet', title: 'Bulleted list', hint: 'Simple list', icon: List, keywords: ['ul'], run: block((e) => e.chain().focus().toggleBulletList().run()) },
  { id: 'ordered', title: 'Numbered list', hint: 'Ordered steps', icon: ListOrdered, keywords: ['ol'], run: block((e) => e.chain().focus().toggleOrderedList().run()) },
  { id: 'quote', title: 'Quote', hint: 'Dialogue or aside', icon: Quote, keywords: ['blockquote'], run: block((e) => e.chain().focus().toggleBlockquote().run()) },
  { id: 'code', title: 'Logic block', hint: 'Code that runs in play mode', icon: Code, keywords: ['code', 'script'], run: block((e) => e.chain().focus().toggleCodeBlock().run()) },
  { id: 'divider', title: 'Divider', hint: 'Scene break', icon: Minus, keywords: ['hr', 'rule'], run: block((e) => e.chain().focus().setHorizontalRule().run()) },
  { id: 'variable', title: 'Variable', hint: 'Insert {{ variable }}', icon: Braces, run: block((e) => e.chain().focus().insertContent('{{').run()) },
];

const matches = (item: CommandItem, query: string) => {
  const q = query.trim().toLowerCase();
  return !q || [item.title, item.id, ...(item.keywords ?? [])].some((text) => text.toLowerCase().includes(q));
};

export const filterCommands = (items: CommandItem[], query: string) => items.filter((item) => matches(item, query));

export const variableCommands = (variables: Variable[], query: string): CommandItem[] =>
  filterCommands(
    variables.map((variable) => ({
      id: variable.id,
      title: variable.name,
      hint: variableTypeInfo(variable.type).label.toLowerCase(),
      icon: variableTypeInfo(variable.type).icon,
      color: variableTypeInfo(variable.type).color,
      // Trailing space ends the `{{` suggestion (it would still match `{{name}}`).
      run: (editor, range) => editor.chain().focus().insertContentAt(range, `{{${variable.name}}} `).run(),
    })),
    query,
  );

const insertAt = (text: string) => (editor: Editor, range: Range) => {
  editor.chain().focus().insertContentAt(range, text).run();
};

const CODE_LIMIT = 8;

/**
 * Completions for the word being typed in a logic block: project variables,
 * the script functions, and true/false. Prefix matches come first.
 */
export const codeCompletions = (variables: Variable[], prefix: string): CommandItem[] => {
  const q = prefix.toLowerCase();
  const all: CommandItem[] = [
    ...variables.map((v) => {
      const info = variableTypeInfo(v.type);
      return { id: `var:${v.id}`, title: v.name, hint: info.label.toLowerCase(), icon: info.icon, color: info.color, run: insertAt(v.name) };
    }),
    ...SCRIPT_FUNCTIONS.map((fn) => ({ id: `fn:${fn.name}`, title: fn.name, hint: fn.signature.slice(fn.name.length), icon: SquareFunction, color: CODE_COLORS.function, run: insertAt(`${fn.name}(`) })),
    ...['true', 'false'].map((word) => ({ id: `kw:${word}`, title: word, hint: 'keyword', icon: KeyRound, color: CODE_COLORS.keyword, run: insertAt(word) })),
  ];
  const starts = all.filter((item) => item.title.toLowerCase().startsWith(q));
  const contains = all.filter((item) => !item.title.toLowerCase().startsWith(q) && item.title.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, CODE_LIMIT);
};
