import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';

type TokenStream = string | Prism.Token | (string | Prism.Token)[];

// Prism token tree -> flat (from, to, class) ranges, with nested tokens
// carrying their parents' classes, as the display's nested spans do.
const collectTokens = (stream: TokenStream, start: number, classes: string[], out: Decoration[]): number => {
  if (typeof stream === 'string') return start + stream.length;
  if (Array.isArray(stream)) return stream.reduce<number>((pos, token) => collectTokens(token, pos, classes, out), start);

  const aliases = Array.isArray(stream.alias) ? stream.alias : stream.alias ? [stream.alias] : [];
  const tokenClasses = [...classes, 'token', stream.type, ...aliases];
  if (typeof stream.content === 'string') {
    out.push(Decoration.inline(start, start + stream.content.length, { class: tokenClasses.join(' ') }));
    return start + stream.content.length;
  }
  return collectTokens(stream.content, start, tokenClasses, out);
};

const findCodeDecorations = (doc: ProseMirrorNode) => {
  const decorations: Decoration[] = [];
  doc.descendants((node, position) => {
    if (node.type.name !== 'codeBlock') return true;
    const grammar = Prism.languages[node.attrs.language] ?? Prism.languages.javascript;
    collectTokens(Prism.tokenize(node.textContent, grammar), position + 1, [], decorations);
    return false;
  });
  return DecorationSet.create(doc, decorations);
};

const codeHighlightKey = new PluginKey<DecorationSet>('codeHighlight');

/** Prism colours in code blocks, matching what StoryText renders. */
export const codeHighlight = Extension.create({
  name: 'codeHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: codeHighlightKey,
        state: {
          init: (_config, state) => findCodeDecorations(state.doc),
          apply: (transaction, decorations) => transaction.docChanged
            ? findCodeDecorations(transaction.doc)
            : decorations.map(transaction.mapping, transaction.doc),
        },
        props: {
          decorations: (state) => codeHighlightKey.getState(state) ?? DecorationSet.empty,
        },
      }),
    ];
  },
});
