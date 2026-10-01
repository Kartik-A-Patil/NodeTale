import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { EditorAction } from '../editor/shortcuts/types';
import { ShortcutKbd } from './ui/kbd';
import { island } from './editor/editorStyles';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: EditorAction[];
}

const CATEGORY_ORDER: EditorAction['category'][] = ['Edit', 'Story', 'View', 'File'];

// Every editor command and its shortcut: this is also the app's shortcut reference.
export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, actions }) => {
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Grouped by category; `results` is the same order flattened, for arrow keys.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = actions.filter((a) => a.enabled !== false && (!q || a.label.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)));
    return CATEGORY_ORDER
      .map((category) => ({ category, items: matching.filter((a) => a.category === category) }))
      .filter((g) => g.items.length > 0);
  }, [actions, query]);
  const results = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setHighlighted(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  if (!isOpen) return null;

  const run = (action: EditorAction | undefined) => {
    if (!action) return;
    onClose();
    action.run();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(results[highlighted]); }
  };

  return (
    <div role="dialog" aria-label="Command palette" className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 pt-[14vh]" onClick={onClose}>
      <div className={`w-full max-w-lg overflow-hidden ${island} shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b border-nt-line px-3.5">
          <Search size={16} className="shrink-0 text-nt-ink-3" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search commands and shortcuts"
            aria-label="Search commands"
            className="h-12 flex-1 bg-transparent text-sm text-nt-ink outline-none placeholder:text-nt-ink-3"
          />
        </div>
        <div ref={listRef} role="listbox" className="max-h-[min(60vh,26rem)] overflow-y-auto p-1.5">
          {results.length === 0 && <p className="px-3 py-8 text-center text-sm text-nt-ink-3">No matching commands.</p>}
          {groups.map((group) => (
            <div key={group.category} role="group" aria-label={group.category} className="pb-1">
              <div className="px-2.5 pb-1 pt-2 text-xs text-nt-ink-3">{group.category}</div>
              {group.items.map((action) => {
                const index = results.indexOf(action);
                const keys = Array.isArray(action.keys) ? action.keys[0] : action.keys;
                return (
                  <div
                    key={action.id}
                    role="option"
                    aria-selected={index === highlighted}
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => run(action)}
                    className="flex h-9 cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 text-sm text-nt-ink-2 aria-selected:bg-nt-raised aria-selected:text-nt-ink"
                  >
                    <span className="truncate">{action.label}</span>
                    {keys && <ShortcutKbd keys={keys} />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
