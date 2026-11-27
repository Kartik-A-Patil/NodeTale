import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import {
  Bold, Check, ChevronDown, Code, Italic, Link2, Strikethrough, Underline, Unlink,
} from 'lucide-react';
import { editorPopup } from './editorStyles';

const BLOCK_TYPES = [
  { label: 'Text', isActive: (e: Editor) => e.isActive('paragraph'), run: (e: Editor) => e.chain().focus().setParagraph().run() },
  { label: 'Heading 1', isActive: (e: Editor) => e.isActive('heading', { level: 1 }), run: (e: Editor) => e.chain().focus().setHeading({ level: 1 }).run() },
  { label: 'Heading 2', isActive: (e: Editor) => e.isActive('heading', { level: 2 }), run: (e: Editor) => e.chain().focus().setHeading({ level: 2 }).run() },
  { label: 'Heading 3', isActive: (e: Editor) => e.isActive('heading', { level: 3 }), run: (e: Editor) => e.chain().focus().setHeading({ level: 3 }).run() },
  { label: 'Bulleted list', isActive: (e: Editor) => e.isActive('bulletList'), run: (e: Editor) => e.chain().focus().toggleBulletList().run() },
  { label: 'Numbered list', isActive: (e: Editor) => e.isActive('orderedList'), run: (e: Editor) => e.chain().focus().toggleOrderedList().run() },
  { label: 'Quote', isActive: (e: Editor) => e.isActive('blockquote'), run: (e: Editor) => e.chain().focus().toggleBlockquote().run() },
];

// Picked to stay readable on the dark node surface. `null` clears the colour.
const TEXT_COLORS: { label: string; value: string | null }[] = [
  { label: 'Default', value: null },
  { label: 'Orange', value: '#f59e5b' },
  { label: 'Red', value: '#f87171' },
  { label: 'Yellow', value: '#facc15' },
  { label: 'Green', value: '#4ade80' },
  { label: 'Blue', value: '#60a5fa' },
  { label: 'Purple', value: '#c084fc' },
  { label: 'Grey', value: '#a8a29e' },
];

/** Adds https:// to bare domains; the Link extension itself rejects unsafe schemes. */
const normalizeHref = (value: string) => (/^[a-z][a-z\d+.-]*:|^[/#]/i.test(value) ? value : `https://${value}`);

type Panel = 'none' | 'block' | 'color' | 'link';

const ToolButton = ({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    aria-pressed={active}
    onClick={onClick}
    className={`inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-md px-1.5 text-xs transition-colors hover:bg-nt-raised hover:text-nt-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-nt-focus ${active ? 'bg-nt-raised text-nt-accent' : 'text-nt-ink-2'}`}
  >
    {children}
  </button>
);

const Divider = () => <span aria-hidden className="mx-0.5 h-4 w-px bg-nt-line" />;

export function EditorBubbleMenu({ editor, container }: { editor: Editor; container: HTMLElement }) {
  const [panel, setPanel] = useState<Panel>('none');
  const [href, setHref] = useState('');

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: BLOCK_TYPES.find((type) => type.isActive(e))?.label ?? 'Text',
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      link: e.getAttributes('link').href as string | undefined,
      color: e.getAttributes('textStyle').color as string | undefined,
    }),
  });

  const toggle = (next: Panel) => setPanel((current) => (current === next ? 'none' : next));

  const openLink = () => {
    setHref(state.link ?? '');
    toggle('link');
  };

  const applyLink = () => {
    const value = href.trim();
    const chain = editor.chain().focus().extendMarkRange('link');
    if (value) chain.setLink({ href: normalizeHref(value) }).run();
    else chain.unsetLink().run();
    setPanel('none');
  };

  return (
    <BubbleMenu
      editor={editor}
      appendTo={container}
      className="z-[70]"
      options={{ placement: 'top', offset: 8, flip: true, shift: { padding: 8 }, onHide: () => setPanel('none') }}
      // Code blocks are logic, not prose: no formatting toolbar there.
      shouldShow={({ editor: e, from, to }) => from !== to && e.isEditable && !e.isActive('codeBlock')}
    >
      <div
        data-editor-popup
        role="toolbar"
        aria-label="Text formatting"
        className={`relative ${editorPopup}`}
        // Keep the text selection while clicking buttons; inputs still take focus.
        onMouseDown={(event) => {
          if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
        }}
      >
        {panel === 'link' ? (
          <form
            className="flex items-center gap-1 p-1"
            onSubmit={(event) => {
              event.preventDefault();
              applyLink();
            }}
          >
            <Link2 size={14} className="ml-1.5 shrink-0 text-nt-ink-3" />
            <input
              autoFocus
              value={href}
              onChange={(event) => setHref(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setPanel('none');
                  editor.commands.focus();
                }
              }}
              placeholder="Paste or type a link"
              aria-label="Link address"
              className="h-7 w-56 bg-transparent px-1 text-sm text-nt-ink outline-none placeholder:text-nt-ink-3"
            />
            <ToolButton label="Apply link" onClick={applyLink}><Check size={14} /></ToolButton>
            {state.link && (
              <ToolButton label="Remove link" onClick={() => { setHref(''); editor.chain().focus().extendMarkRange('link').unsetLink().run(); setPanel('none'); }}>
                <Unlink size={14} />
              </ToolButton>
            )}
          </form>
        ) : (
          <div className="flex items-center gap-0.5 p-1">
            <ToolButton label="Turn into" active={panel === 'block'} onClick={() => toggle('block')}>
              <span className="whitespace-nowrap px-0.5 font-medium">{state.block}</span>
              <ChevronDown size={12} />
            </ToolButton>
            <Divider />
            <ToolButton label="Bold (Ctrl+B)" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={14} /></ToolButton>
            <ToolButton label="Italic (Ctrl+I)" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={14} /></ToolButton>
            <ToolButton label="Underline (Ctrl+U)" active={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline size={14} /></ToolButton>
            <ToolButton label="Strikethrough" active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={14} /></ToolButton>
            <ToolButton label="Inline code" active={state.code} onClick={() => editor.chain().focus().toggleCode().run()}><Code size={14} /></ToolButton>
            <Divider />
            <ToolButton label="Link" active={!!state.link} onClick={openLink}><Link2 size={14} /></ToolButton>
            <ToolButton label="Text colour" active={panel === 'color'} onClick={() => toggle('color')}>
              <span className="text-sm font-semibold leading-none" style={{ color: state.color }}>A</span>
              <span aria-hidden className="h-1 w-3 rounded-full" style={{ background: state.color ?? 'currentColor' }} />
            </ToolButton>
          </div>
        )}

        {panel === 'block' && (
          <div className={`absolute left-0 top-full mt-1 w-44 p-1 ${editorPopup}`}>
            {BLOCK_TYPES.map((type) => (
              <button
                key={type.label}
                type="button"
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-nt-ink-2 hover:bg-nt-raised hover:text-nt-ink"
                onClick={() => { type.run(editor); setPanel('none'); }}
              >
                {type.label}
                {state.block === type.label && <Check size={14} className="text-nt-accent" />}
              </button>
            ))}
          </div>
        )}

        {panel === 'color' && (
          <div className={`absolute right-0 top-full mt-1 grid grid-cols-4 gap-1 p-2 ${editorPopup}`} aria-label="Text colour">
            {TEXT_COLORS.map(({ label, value }) => (
              <button
                key={label}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={(state.color ?? null) === value}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-nt-line text-sm font-semibold hover:bg-nt-raised aria-pressed:border-nt-accent"
                style={{ color: value ?? undefined }}
                onClick={() => {
                  const chain = editor.chain().focus();
                  (value ? chain.setColor(value) : chain.unsetColor()).run();
                  setPanel('none');
                }}
              >
                A
              </button>
            ))}
          </div>
        )}
      </div>
    </BubbleMenu>
  );
}
