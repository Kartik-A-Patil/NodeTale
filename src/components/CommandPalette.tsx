import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { EditorAction } from '../editor/shortcuts/types';
import { formatShortcut } from '../editor/shortcuts/format';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: EditorAction[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, actions }) => {
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const enabled = actions.filter((a) => a.enabled !== false);
    if (!query.trim()) return enabled;
    const q = query.trim().toLowerCase();
    return enabled.filter((a) => a.label.toLowerCase().includes(q) || a.category.toLowerCase().includes(q));
  }, [actions, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setHighlighted(0);
      // Focus after the modal mounts.
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  if (!isOpen) return null;

  const runHighlighted = () => {
    const action = results[highlighted];
    if (action) {
      action.run();
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      runHighlighted();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#18181b] border border-zinc-700 rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800">
          <Search size={16} className="text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent outline-none text-sm text-zinc-200 placeholder-zinc-600"
          />
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 && (
            <div className="px-3 py-6 text-center text-zinc-600 text-xs">No matching commands.</div>
          )}
          {results.map((action, i) => (
            <div
              key={action.id}
              onMouseEnter={() => setHighlighted(i)}
              onClick={() => { action.run(); onClose(); }}
              className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer ${
                i === highlighted ? 'bg-orange-500/10 text-orange-400' : 'text-zinc-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={`text-[10px] uppercase tracking-wider ${i === highlighted ? 'text-orange-400/70' : 'text-zinc-600'}`}>{action.category}</span>
                {action.label}
              </span>
              {action.keys && (
                <span className={`text-xs font-mono ${i === highlighted ? 'text-orange-400/70' : 'text-zinc-500'}`}>
                  {formatShortcut(Array.isArray(action.keys) ? action.keys[0] : action.keys)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
