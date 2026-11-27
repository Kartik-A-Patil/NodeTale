import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { VARIABLE_PATTERN, VARIABLE_TOKEN_CLASS } from '../../../utils/html';

const variableHighlightKey = new PluginKey<DecorationSet>('variableHighlight');

const findVariableDecorations = (document: Parameters<typeof DecorationSet.create>[0]) => {
  const decorations: Decoration[] = [];

  document.descendants((node, position, parent) => {
    if (!node.isText || parent?.type.name === 'codeBlock') return;

    const text = node.text ?? '';
    for (const match of text.matchAll(VARIABLE_PATTERN)) {
      const token = match[0];
      const start = match.index;
      if (start === undefined) continue;

      decorations.push(Decoration.inline(
        position + start,
        position + start + token.length,
        {
          class: VARIABLE_TOKEN_CLASS,
          'data-variable': token.slice(2, -2).trim(),
        },
      ));
    }
  });

  return DecorationSet.create(document, decorations);
};

export const variableHighlight = Extension.create({
  name: 'variableHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: variableHighlightKey,
        state: {
          init: (_config, state) => findVariableDecorations(state.doc),
          apply: (transaction, decorations) => transaction.docChanged
            ? findVariableDecorations(transaction.doc)
            : decorations.map(transaction.mapping, transaction.doc),
        },
        props: {
          decorations: (state) => variableHighlightKey.getState(state) ?? DecorationSet.empty,
        },
      }),
    ];
  },
});
