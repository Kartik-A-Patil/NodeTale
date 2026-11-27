import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FocusEvent } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import { sanitizeHtml } from '../utils/html';
import { draggedAssetId } from '../utils/nodeAssets';
import { useEditor as useStoryEditor } from '../editor/EditorContext';
import { variableHighlight } from './editor/extensions/variableHighlight';
import { codeHighlight } from './editor/extensions/codeHighlight';
import { SuggestionMenu } from './editor/extensions/suggestionMenu';
import { codeCompletions, filterCommands, SLASH_COMMANDS, variableCommands } from './editor/extensions/commandItems';
import { CodeCompletion } from './editor/extensions/codeCompletion';
import { EditorBubbleMenu } from './editor/EditorBubbleMenu';
import { SuggestionPopup, isMenuEscape, useSuggestion } from './editor/SuggestionPopup';
import type { EditStart } from './editor/StoryText';

const SAVE_DEBOUNCE_MS = 300;

export interface RichTextEditorProps {
  initialValue: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** Escape with no menu open. Defaults to leaving the editor (blur). */
  onEscape?: () => void;
  /** An asset dragged from the sidebar was dropped onto the text. */
  onAssetDrop?: (assetId: string) => void;
  /** Double-click that opened the editor: caret goes there, scroll is kept. */
  startAt?: EditStart;
  placeholder?: string;
}

const RichTextEditor = ({
  initialValue,
  onChange,
  onBlur,
  onAssetDrop,
  onEscape,
  startAt,
  placeholder = 'Write the scene… type / for blocks, {{ for variables',
}: RichTextEditorProps) => {
  const { variables } = useStoryEditor();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValueRef = useRef<string | null>(null);
  // Latest props for callbacks captured once by the editor/extensions.
  const latest = useRef({ onChange, onBlur, onAssetDrop, variables });
  latest.current = { onChange, onBlur, onAssetDrop, variables };

  const slash = useSuggestion();
  const variableMenu = useSuggestion();
  const completion = useSuggestion();
  // Menus portal next to the editor: into its <dialog> when expanded (the top
  // layer hides anything outside it), otherwise onto the body so canvas zoom
  // doesn't scale them.
  const [popupContainer, setPopupContainer] = useState<HTMLElement | null>(null);
  const wrapperRef = useCallback((el: HTMLDivElement | null) => {
    if (el) setPopupContainer(el.closest('dialog') ?? document.body);
  }, []);

  const flushChange = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = null;

    if (pendingValueRef.current === null) return;
    const value = pendingValueRef.current;
    pendingValueRef.current = null;
    latest.current.onChange(value ? sanitizeHtml(value) : '');
  }, []);

  const scheduleChange = useCallback((value: string) => {
    pendingValueRef.current = value;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(flushChange, SAVE_DEBOUNCE_MS);
  }, [flushChange]);

  const [extensions] = useState(() => [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      // Logic blocks are JavaScript; the class lets Prism colour them in StoryText.
      codeBlock: { defaultLanguage: 'javascript' },
      // No phantom empty paragraph after a final code block: StoryText wouldn't
      // show it, so the node would grow a line on entering edit mode.
      trailingNode: false,
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
    }),
    TextStyle,
    Color,
    Placeholder.configure({ placeholder }),
    variableHighlight,
    codeHighlight,
    SuggestionMenu.extend({ name: 'slashMenu' }).configure({
      char: '/',
      items: (query) => filterCommands(SLASH_COMMANDS, query),
      ...slash.handlers,
    }),
    SuggestionMenu.extend({ name: 'variableMenu' }).configure({
      char: '{{',
      allowedPrefixes: null,
      items: (query) => variableCommands(latest.current.variables, query),
      ...variableMenu.handlers,
    }),
    CodeCompletion.configure({
      items: (prefix) => codeCompletions(latest.current.variables, prefix),
      ...completion.handlers,
    }),
  ]);

  const editor = useEditor({
    extensions,
    content: sanitizeHtml(initialValue || ''),
    // Keep typed spaces (StoryText renders with the same rules); newlines become spaces.
    parseOptions: { preserveWhitespace: true },
    editorProps: {
      attributes: {
        class: 'tiptap nt-prose markdown-content',
        role: 'textbox',
        'aria-label': 'Story content',
        'aria-multiline': 'true',
      },
      handleDrop: (_view, event) => {
        const assetId = draggedAssetId(event.dataTransfer);
        if (!assetId) return false;
        latest.current.onAssetDrop?.(assetId);
        return true;
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      scheduleChange(currentEditor.isEmpty ? '' : currentEditor.getHTML());
    },
  });

  // Before paint, so the swap from StoryText shows no scroll jump. The start
  // point is read once: it only describes the click that opened this editor.
  const startRef = useRef(startAt);
  useLayoutEffect(() => {
    // StrictMode destroys the first instance and useEditor hands out a new one.
    if (!editor || editor.isDestroyed) return;
    const start = startRef.current;
    const scroller = editor.view.dom.parentElement;
    if (start && scroller) scroller.scrollTop = start.scrollTop;
    const pos = start && editor.view.posAtCoords({ left: start.x, top: start.y })?.pos;
    editor.commands.focus(pos ?? 'end', { scrollIntoView: !start });
  }, [editor]);

  useEffect(() => () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    flushChange();
  }, [flushChange]);

  const handleBlurCapture = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Element && (event.currentTarget.contains(next) || next.closest('[data-editor-popup]'))) return;

    flushChange();
    latest.current.onBlur?.();
  };

  return (
    <div
      ref={wrapperRef}
      className="nt-story-editor nodrag nowheel relative flex h-full w-full flex-col"
      onBlurCapture={handleBlurCapture}
      onKeyDown={(event) => {
        event.stopPropagation();
        // ProseMirror swallows Escape (so a <dialog> never sees it); the / and {{
        // menus close on their own Escape, and the link field handles its own.
        if (event.key === 'Escape' && event.target === editor?.view.dom && !isMenuEscape(event.nativeEvent)) {
          if (onEscape) onEscape();
          else editor.commands.blur();
        }
      }}
      onPaste={(event) => event.stopPropagation()}
      onCopy={(event) => event.stopPropagation()}
      onCut={(event) => event.stopPropagation()}
      // The editor owns drops while editing; don't let the node attach twice.
      onDrop={(event) => event.stopPropagation()}
    >
      <EditorContent editor={editor} className="h-full w-full cursor-text overflow-auto" />
      {editor && popupContainer && <EditorBubbleMenu editor={editor} container={popupContainer} />}
      <SuggestionPopup state={slash.state} keyHandler={slash.keyHandler} container={popupContainer} />
      <SuggestionPopup state={completion.state} keyHandler={completion.keyHandler} container={popupContainer} mono />
      <SuggestionPopup
        state={variableMenu.state}
        keyHandler={variableMenu.keyHandler}
        mono
        container={popupContainer}
        emptyText={variables.length ? undefined : 'No variables yet. Add them in the Variables panel.'}
      />
    </div>
  );
};

export { RichTextEditor };
