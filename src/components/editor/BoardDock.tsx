import { memo, useMemo, useState } from 'react';
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
import { dropdownItem, dropdownLabel, dropdownPanel, island, menuItem, toolButton, toolButtonActive } from './editorStyles';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { ShortcutKbd } from '../ui/kbd';
import { KEYS } from '../../editor/shortcuts/keymap';
import type { ShortcutKeys } from '../../editor/shortcuts/types';
import { Hint } from './Hint';

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

const ADD: { type: NodeTypeKey; label: string; icon: typeof PlusCircle; payload: string; keys: ShortcutKeys }[] = [
  { type: 'elementNode', label: 'Scene', icon: PlusCircle, payload: 'New Element', keys: KEYS.addScene },
  { type: 'conditionNode', label: 'Branch', icon: GitFork, payload: 'Logic Check', keys: KEYS.addBranch },
  { type: 'jumpNode', label: 'Jump', icon: ArrowRightCircle, payload: 'Jump', keys: KEYS.addJump },
  { type: 'commentNode', label: 'Comment', icon: MessageSquare, payload: '', keys: KEYS.addComment },
  { type: 'sectionNode', label: 'Section', icon: LayoutTemplate, payload: 'New Section', keys: KEYS.addSection },
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
    <div>
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
  const alignItem = (mode: AlignMode, label: string, Icon: typeof AlignStartVertical) => (
    <DropdownMenuItem className={dropdownItem} disabled={p.selectionCount < 2} onSelect={() => p.onAlign(mode)}>
      <Icon size={14} /> {label}
    </DropdownMenuItem>
  );

  return (
    <div role="toolbar" aria-label="Board tools"
      className={`absolute bottom-4 left-1/2 z-30 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-0.5 overflow-visible p-1 ${island}`}>
      <Hint label="Select" keys={KEYS.toolSelect}>
        <button type="button" className={`${toolButton} ${!p.isPanMode ? toolButtonActive : ''}`} aria-pressed={!p.isPanMode} onClick={() => p.onPanMode(false)} aria-label="Select tool">
          <MousePointer2 size={16} />
        </button>
      </Hint>
      <Hint label="Pan" keys={KEYS.toolPan}>
        <button type="button" className={`${toolButton} ${p.isPanMode ? toolButtonActive : ''}`} aria-pressed={p.isPanMode} onClick={() => p.onPanMode(true)} aria-label="Pan tool">
          <Hand size={16} />
        </button>
      </Hint>
      {divider}
      <Hint label="Undo" keys={KEYS.undo}>
        <button type="button" className={toolButton} onClick={p.onUndo} disabled={!p.canUndo} aria-label="Undo"><Undo2 size={16} /></button>
      </Hint>
      <Hint label="Redo" keys={KEYS.redo}>
        <button type="button" className={toolButton} onClick={p.onRedo} disabled={!p.canRedo} aria-label="Redo"><Redo2 size={16} /></button>
      </Hint>
      {divider}
      {ADD.map((a) => (
        <Hint key={a.type} label={`Add a ${a.label.toLowerCase()} (or drag it onto the board)`} keys={a.keys}>
        <button type="button" className={`${toolButton} cursor-grab active:cursor-grabbing`} disabled={p.locked}
          aria-label={`Add ${a.label}`}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/reactflow/type', a.type);
            e.dataTransfer.setData('application/reactflow/payload', JSON.stringify({ label: a.payload }));
            e.dataTransfer.effectAllowed = 'move';
          }}
          onClick={() => p.onAdd(a.type)}>
          <a.icon size={16} />
        </button>
        </Hint>
      ))}
      {divider}

      <DropdownMenu>
        <Hint label="Arrange & align">
          <DropdownMenuTrigger asChild>
            <button type="button" className={toolButton} disabled={p.locked} aria-label="Arrange and align">
              <Wand2 size={16} />
            </button>
          </DropdownMenuTrigger>
        </Hint>
        <DropdownMenuContent side="top" align="center" className={`w-60 ${dropdownPanel}`}>
            <DropdownMenuItem className={dropdownItem} onSelect={() => p.onArrange('board')}>
              <Wand2 size={14} /> Tidy up the whole board
              <ShortcutKbd keys={KEYS.tidyBoard} className="ml-auto" />
            </DropdownMenuItem>
            <DropdownMenuItem className={dropdownItem} disabled={p.selectionCount < 2} onSelect={() => p.onArrange('selection')}>
              <Wand2 size={14} /> Tidy up the selection
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-nt-line" />
            <DropdownMenuLabel className={dropdownLabel}>{p.selectionCount < 2 ? 'Select 2 or more to align' : `Align ${p.selectionCount} selected`}</DropdownMenuLabel>
            {alignItem('left', 'Left edges', AlignStartVertical)}
            {alignItem('center', 'Centres (vertical line)', AlignCenterVertical)}
            {alignItem('right', 'Right edges', AlignEndVertical)}
            {alignItem('top', 'Top edges', AlignStartHorizontal)}
            {alignItem('middle', 'Middles (horizontal line)', AlignCenterHorizontal)}
            {alignItem('bottom', 'Bottom edges', AlignEndHorizontal)}
            <DropdownMenuSeparator className="bg-nt-line" />
            <DropdownMenuItem className={dropdownItem} disabled={p.selectionCount < 3} onSelect={() => p.onDistribute('horizontal')}>
              <AlignHorizontalSpaceAround size={14} /> Space evenly across
            </DropdownMenuItem>
            <DropdownMenuItem className={dropdownItem} disabled={p.selectionCount < 3} onSelect={() => p.onDistribute('vertical')}>
              <AlignVerticalSpaceAround size={14} /> Space evenly down
            </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover open={p.findOpen} onOpenChange={p.onFindOpen}>
        <Hint label="Find a scene" keys={KEYS.find}>
          <PopoverTrigger asChild>
            <button type="button" className={`${toolButton} ${p.findOpen ? toolButtonActive : ''}`} aria-label="Find a scene">
              <Search size={16} />
            </button>
          </PopoverTrigger>
        </Hint>
        <PopoverContent side="top" align="center" sideOffset={8} className={`w-80 p-2 ${dropdownPanel}`}>
          <FindPopover findable={p.findable} onFocusNode={p.onFocusNode} startId={p.startId} onClose={() => p.onFindOpen(false)} />
        </PopoverContent>
      </Popover>
      {divider}

      <Hint label="Zoom out" keys={KEYS.zoomOut}>
        <button type="button" className={toolButton} onClick={() => zoomOut({ duration: 200 })} aria-label="Zoom out"><Minus size={16} /></button>
      </Hint>
      <Hint label="Reset to 100%">
        <button type="button" className={`${toolButton} w-12 font-mono text-xs`} onClick={() => zoomTo(1, { duration: 200 })} aria-label={`Zoom ${zoomPercent}%, reset to 100%`}>
          {zoomPercent}%
        </button>
      </Hint>
      <Hint label="Zoom in" keys={KEYS.zoomIn}>
        <button type="button" className={toolButton} onClick={() => zoomIn({ duration: 200 })} aria-label="Zoom in"><Plus size={16} /></button>
      </Hint>
      <Hint label="Fit the board" keys={KEYS.fitView}>
        <button type="button" className={toolButton} onClick={() => fitView({ duration: 300, padding: 0.15 })} aria-label="Fit the board"><Maximize size={16} /></button>
      </Hint>
      {divider}
      <Hint label="Minimap" keys={KEYS.minimap}>
        <button type="button" className={`${toolButton} ${p.minimap ? toolButtonActive : ''}`} aria-pressed={p.minimap} onClick={() => p.onMinimap(!p.minimap)} aria-label="Minimap"><MapIcon size={16} /></button>
      </Hint>
      <Hint label="Snap to grid">
        <button type="button" className={`${toolButton} ${p.snap ? toolButtonActive : ''}`} aria-pressed={p.snap} onClick={() => p.onSnap(!p.snap)} aria-label="Snap to grid"><Grid3x3 size={16} /></button>
      </Hint>
      <Hint label={p.locked ? 'Unlock the board' : 'Lock the board (no moving, connecting or adding)'} keys={KEYS.lock}>
      <button type="button" className={`${toolButton} ${p.locked ? 'bg-nt-accent/15 text-nt-accent' : ''}`} aria-pressed={p.locked} onClick={() => p.onLocked(!p.locked)}
        aria-label={p.locked ? 'Unlock the board' : 'Lock the board'}>
        {p.locked ? <Lock size={16} /> : <Unlock size={16} />}
      </button>
      </Hint>
    </div>
  );
});
