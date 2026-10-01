import { Extension } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { CommandItem } from './commandItems';
import type { SuggestionState } from './suggestionMenu';

interface CodeCompletionOptions {
  items: (prefix: string) => CommandItem[];
  onChange: (state: SuggestionState | null) => void;
  onKeyDown: (event: KeyboardEvent) => boolean;
}

/** The identifier being typed at the cursor inside a code block, if any. */
const wordAtCursor = (state: EditorState): { text: string; from: number; to: number } | null => {
  const { selection } = state;
  if (!selection.empty) return null;
  const { $from } = selection;
  if ($from.parent.type.name !== 'codeBlock') return null;
  const line = $from.parent.textBetween(0, $from.parentOffset).split('\n').pop() ?? '';
  // Not inside a string literal (an odd number of quotes before the cursor).
  if ((line.match(/"/g)?.length ?? 0) % 2 === 1) return null;
  const match = /[A-Za-z_$][\w$]*$/.exec(line);
  if (!match) return null;
  return { text: match[0], from: $from.pos - match[0].length, to: $from.pos };
};

// Autocomplete while typing in a logic block, like a code editor: opens as you
// type a name, follows the cursor, closes on Escape or when nothing matches.
// Rendering is the same React popup the / and {{ menus use.
export const CodeCompletion = Extension.create<CodeCompletionOptions>({
  name: 'codeCompletion',
  // Before the code block's own Enter/Tab handling.
  priority: 200,

  addOptions: () => ({ items: () => [], onChange: () => {}, onKeyDown: () => false }),

  addProseMirrorPlugins() {
    const { items, onChange, onKeyDown } = this.options;
    const editor = this.editor;
    let open = false;
    let dismissed = false;
    // What was last reported. View updates also come from non-edits (e.g. the
    // editor re-applying its props on a React render); reporting those would
    // re-render the editor and loop.
    let shown = '';

    const close = () => {
      if (open) onChange(null);
      open = false;
      shown = '';
    };

    return [
      new Plugin({
        key: new PluginKey('codeCompletion'),
        view: () => ({
          update: (view, prevState) => {
            const typed = !prevState.doc.eq(view.state.doc);
            if (typed) dismissed = false;
            const word = wordAtCursor(view.state);
            // Opens only on typing; once open it follows the cursor.
            if (!word || dismissed || (!typed && !open)) return close();
            const key = `${word.from}:${word.text}`;
            if (open && key === shown) return;
            const list = items(word.text);
            if (!list.length || (list.length === 1 && list[0].title === word.text)) return close();
            open = true;
            shown = key;
            onChange({
              items: list,
              select: (item) => { close(); item.run(editor, { from: word.from, to: word.to }); },
              clientRect: () => {
                const c = view.coordsAtPos(word.from);
                return new DOMRect(c.left, c.top, 0, c.bottom - c.top);
              },
            });
          },
          destroy: close,
        }),
        props: {
          handleKeyDown: (_view, event) => {
            if (!open) return false;
            if (event.key === 'Escape') {
              onKeyDown(event);
              dismissed = true;
              close();
              return true;
            }
            return onKeyDown(event);
          },
        },
      }),
    ];
  },
});
