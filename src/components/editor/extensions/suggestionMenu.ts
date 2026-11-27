import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import type { CommandItem } from './commandItems';

/** What the popup needs to render; null while the menu is closed. */
export interface SuggestionState {
  items: CommandItem[];
  select: (item: CommandItem) => void;
  clientRect: () => DOMRect | null;
}

interface SuggestionMenuOptions {
  char: string;
  /** Characters allowed right before `char`; null allows any (so `a{{` works). */
  allowedPrefixes: string[] | null;
  items: (query: string) => CommandItem[];
  onChange: (state: SuggestionState | null) => void;
  onKeyDown: (event: KeyboardEvent) => boolean;
}

// One typed-trigger menu (`/` for blocks, `{{` for variables). Rendering stays
// in React: the plugin only reports state through onChange.
export const SuggestionMenu = Extension.create<SuggestionMenuOptions>({
  name: 'suggestionMenu',

  addOptions: () => ({
    char: '/',
    allowedPrefixes: [' '],
    items: () => [],
    onChange: () => {},
    onKeyDown: () => false,
  }),

  addProseMirrorPlugins() {
    const { char, allowedPrefixes, items, onChange, onKeyDown } = this.options;
    const report = (props: { items: CommandItem[]; command: (item: CommandItem) => void; clientRect?: (() => DOMRect | null) | null }) =>
      onChange({ items: props.items, select: props.command, clientRect: () => props.clientRect?.() ?? null });

    return [
      Suggestion<CommandItem, CommandItem>({
        editor: this.editor,
        pluginKey: new PluginKey(this.name),
        char,
        allowedPrefixes,
        items: ({ query }) => items(query),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => ({
          onStart: report,
          onUpdate: report,
          onExit: () => onChange(null),
          onKeyDown: ({ event }) => onKeyDown(event),
        }),
      }),
    ];
  },
});
