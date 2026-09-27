import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow, useStore } from 'reactflow';
import {
  MousePointer2, Hand, Undo2, Redo2, PlusCircle, GitFork, ArrowRightCircle, MessageSquare, LayoutTemplate,
  Wand2, AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal,
  AlignEndHorizontal, AlignHorizontalSpaceAround, AlignVerticalSpaceAround, Search, Flag, Minus, Plus, Maximize,
  Map as MapIcon, Grid3x3, Lock, Unlock,
} from 'lucide-react';
import { NodeTypeKey } from '../../core/nodes/nodeRegistry';
import { AlignMode } from '../../core/layout/arrange';
import { htmlToText } from '../../utils/html';
import { island, menuItem, menuPanel, toolButton, toolButtonActive, usePopover } from './usePopover';

export interface FindableNode {
  id: string;
  label: string;
  content?: string;
}

interface BoardDockProps {
  isPanMode: boolean;
  onPanMode: (pan: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAdd: (type: NodeTypeKey) => void;
  selectionCount: number;
  onArrange: (scope: 'board' | 'selection') => void;
  onAlign: (mode: AlignMode) => void;
  onDistribute: (axis: 'horizontal' | 'vertical') => void;
  findOpen: boolean;
  onFindOpen: (open: boolean) => void;
  findable: FindableNode[];
  onFocusNode: (id: string) => void;
  startId: string | null;
  minimap: boolean;
  onMinimap: (on: boolean) => void;
  snap: boolean;
  onSnap: (on: boolean) => void;
  locked: boolean;
  onLocked: (on: boolean) => void;
}

const ADD: { type: NodeTypeKey; label: string; icon: typeof PlusCircle; payload: string }[] = [
  { type: 'elementNode', label: 'Scene', icon: PlusCircle, payload: 'New Element' },
  { type: 'conditionNode', label: 'Branch', icon: GitFork, payload: 'Logic Check' },
  { type: 'jumpNode', label: 'Jump', icon: ArrowRightCircle, payload: 'Jump' },
  { type: 'commentNode', label: 'Comment', icon: MessageSquare, payload: '' },
  { type: 'sectionNode', label: 'Section', icon: LayoutTemplate, payload: 'New Section' },
];

const divider = <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-nt-line" />;

function FindPopover({ findable, onFocusNode, onClose, startId }: { findable: FindableNode[]; onFocusNode: (id: string) => void; onClose: () => void; startId: string | null }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const texts = useMemo(() => new Map(findable.map((n) => [n.id, n.content ? htmlToText(n.content).replace(/\s+/g, ' ') : ''])), [findable]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return findable
      .filter((n) => n.label.toLowerCase().includes(q) || texts.get(n.id)!.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, findable, texts]);
  const go = (id: string) => { onFocusNode(id); onClose(); };
  const snippet = (id: string) => {
    const text = texts.get(id)!;
    const i = text.toLowerCase().indexOf(query.trim().toLowerCase());
    return i < 0 ? text.slice(0, 60) : `${i > 20 ? '…' : ''}${text.slice(Math.max(0, i - 20), i + 50)}`;
  };

  return (
    <div className={`${menuPanel} bottom-12 left-1/2 w-80 -translate-x-1/2 p-2`}>
      <input autoFocus value={query} placeholder="Find a scene by name or text" aria-label="Find a scene"
        onChange={(e) => { setQuery(e.target.value); setActive(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active].id); }
          if (e.key === 'Escape') onClose();
        }}
        className="h-9 w-full rounded-md border border-nt-line-strong bg-nt-bg px-3 text-sm text-nt-ink placeholder:text-nt-ink-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-nt-focus" />
      {query.trim() && (
        <ul role="listbox" aria-label="Matching scenes" className="mt-1 max-h-72 overflow-y-auto">
          {results.length === 0 && <li className="px-2 py-3 text-sm text-nt-ink-3">No scene matches “{query.trim()}”.</li>}
          {results.map((n, i) => (
            <li key={n.id} role="option" aria-selected={i === active}>
              <button type="button" onClick={() => go(n.id)} onMouseEnter={() => setActive(i)}
                className={`w-full rounded-md px-2 py-1.5 text-left ${i === active ? 'bg-nt-raised' : ''}`}>
                <span className="block truncate text-sm text-nt-ink">{n.label}</span>
                {texts.get(n.id) && <span className="block truncate text-xs text-nt-ink-3">{snippet(n.id)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {startId && (
        <button type="button" onClick={() => go(startId)} className={`${menuItem} mt-1 rounded-md px-2`}>
          <Flag size={14} /> Go to Start
        </button>
      )}
    </div>
  );
}

// Board editing tools, floating at the bottom of the canvas (Flow view only).
export const BoardDock = memo((p: BoardDockProps) => {
  const { zoomIn, zoomOut, fitView, zoomTo } = useReactFlow();
  const zoomPercent = useStore((s) => Math.round(s.transform[2] * 100));
  const arrange = usePopover();
  // Find's open state is lifted (Ctrl+F opens it), so outside-click closes it here.
  const findRef = useRef<HTMLDivElement>(null);
  const { findOpen, onFindOpen } = p;
  useEffect(() => {
    if (!findOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!findRef.current?.contains(e.target as Node)) onFindOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [findOpen, onFindOpen]);

  const alignItem = (mode: AlignMode, label: string, Icon: typeof AlignStartVertical) => (
    <button role="menuitem" className={menuItem} disabled={p.selectionCount < 2} onClick={() => { arrange.setOpen(false); p.onAlign(mode); }}>
      <Icon size={14} /> {label}
    </button>
  );

  return (
    <div role="toolbar" aria-label="Board tools"
      className={`absolute bottom-4 left-1/2 z-30 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-0.5 overflow-visible p-1 ${island}`}>
      <button type="button" className={`${toolButton} ${!p.isPanMode ? toolButtonActive : ''}`} aria-pressed={!p.isPanMode} onClick={() => p.onPanMode(false)} title="Select (V)" aria-label="Select tool">
        <MousePointer2 size={16} />
      </button>
      <button type="button" className={`${toolButton} ${p.isPanMode ? toolButtonActive : ''}`} aria-pressed={p.isPanMode} onClick={() => p.onPanMode(true)} title="Pan (H)" aria-label="Pan tool">
        <Hand size={16} />
      </button>
      {divider}
      <button type="button" className={toolButton} onClick={p.onUndo} disabled={!p.canUndo} title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 size={16} /></button>
      <button type="button" className={toolButton} onClick={p.onRedo} disabled={!p.canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo"><Redo2 size={16} /></button>
      {divider}
      {ADD.map((a) => (
        <button key={a.type} type="button" className={`${toolButton} cursor-grab active:cursor-grabbing`} disabled={p.locked}
          title={`Add ${a.label} (click, or drag onto the board)`} aria-label={`Add ${a.label}`}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/reactflow/type', a.type);
            e.dataTransfer.setData('application/reactflow/payload', JSON.stringify({ label: a.payload }));
            e.dataTransfer.effectAllowed = 'move';
          }}
          onClick={() => p.onAdd(a.type)}>
          <a.icon size={16} />
        </button>
      ))}
      {divider}

      <div ref={arrange.ref} className="relative">
        <button type="button" className={`${toolButton} ${arrange.open ? toolButtonActive : ''}`} aria-haspopup="menu" aria-expanded={arrange.open}
          disabled={p.locked} onClick={() => arrange.setOpen((o) => !o)} title="Arrange & align" aria-label="Arrange and align">
          <Wand2 size={16} />
        </button>
        {arrange.open && (
          <div role="menu" className={`${menuPanel} bottom-12 left-1/2 w-60 -translate-x-1/2`}>
            <button role="menuitem" className={menuItem} onClick={() => { arrange.setOpen(false); p.onArrange('board'); }}>
              <Wand2 size={14} /> Tidy up the whole board
            </button>
            <button role="menuitem" className={menuItem} disabled={p.selectionCount < 2} onClick={() => { arrange.setOpen(false); p.onArrange('selection'); }}>
              <Wand2 size={14} /> Tidy up the selection
            </button>
            <div className="my-1 h-px bg-nt-line" />
            <p className="px-3 py-1 text-xs text-nt-ink-3">{p.selectionCount < 2 ? 'Select 2 or more to align' : `Align ${p.selectionCount} selected`}</p>
            {alignItem('left', 'Left edges', AlignStartVertical)}
            {alignItem('center', 'Centres (vertical line)', AlignCenterVertical)}
            {alignItem('right', 'Right edges', AlignEndVertical)}
            {alignItem('top', 'Top edges', AlignStartHorizontal)}
            {alignItem('middle', 'Middles (horizontal line)', AlignCenterHorizontal)}
            {alignItem('bottom', 'Bottom edges', AlignEndHorizontal)}
            <div className="my-1 h-px bg-nt-line" />
            <button role="menuitem" className={menuItem} disabled={p.selectionCount < 3} onClick={() => { arrange.setOpen(false); p.onDistribute('horizontal'); }}>
              <AlignHorizontalSpaceAround size={14} /> Space evenly across
            </button>
            <button role="menuitem" className={menuItem} disabled={p.selectionCount < 3} onClick={() => { arrange.setOpen(false); p.onDistribute('vertical'); }}>
              <AlignVerticalSpaceAround size={14} /> Space evenly down
            </button>
          </div>
        )}
      </div>

      <div ref={findRef} className="relative">
        <button type="button" className={`${toolButton} ${p.findOpen ? toolButtonActive : ''}`} aria-expanded={p.findOpen}
          onClick={() => p.onFindOpen(!p.findOpen)} title="Find (Ctrl+F)" aria-label="Find a scene">
          <Search size={16} />
        </button>
        {p.findOpen && <FindPopover findable={p.findable} onFocusNode={p.onFocusNode} startId={p.startId} onClose={() => p.onFindOpen(false)} />}
      </div>
      {divider}

      <button type="button" className={toolButton} onClick={() => zoomOut({ duration: 200 })} title="Zoom out" aria-label="Zoom out"><Minus size={16} /></button>
      <button type="button" className={`${toolButton} w-12 font-mono text-xs`} onClick={() => zoomTo(1, { duration: 200 })} title="Reset to 100%" aria-label={`Zoom ${zoomPercent}%, reset to 100%`}>
        {zoomPercent}%
      </button>
      <button type="button" className={toolButton} onClick={() => zoomIn({ duration: 200 })} title="Zoom in" aria-label="Zoom in"><Plus size={16} /></button>
      <button type="button" className={toolButton} onClick={() => fitView({ duration: 300, padding: 0.15 })} title="Fit the board" aria-label="Fit the board"><Maximize size={16} /></button>
      {divider}
      <button type="button" className={`${toolButton} ${p.minimap ? toolButtonActive : ''}`} aria-pressed={p.minimap} onClick={() => p.onMinimap(!p.minimap)} title="Minimap" aria-label="Minimap"><MapIcon size={16} /></button>
      <button type="button" className={`${toolButton} ${p.snap ? toolButtonActive : ''}`} aria-pressed={p.snap} onClick={() => p.onSnap(!p.snap)} title="Snap to grid" aria-label="Snap to grid"><Grid3x3 size={16} /></button>
      <button type="button" className={`${toolButton} ${p.locked ? 'bg-nt-accent/15 text-nt-accent' : ''}`} aria-pressed={p.locked} onClick={() => p.onLocked(!p.locked)}
        title={p.locked ? 'Unlock the board' : 'Lock the board (no moving, connecting or adding)'} aria-label={p.locked ? 'Unlock the board' : 'Lock the board'}>
        {p.locked ? <Lock size={16} /> : <Unlock size={16} />}
      </button>
    </div>
  );
});
