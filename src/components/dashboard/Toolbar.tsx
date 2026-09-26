import { forwardRef, useEffect, useRef, useState } from 'react';
import { Search, LayoutGrid, List, Upload, Plus, ChevronDown, X } from 'lucide-react';
import nodetaleLogo from '../../assets/logo.png';
import { buttonPrimary, buttonSecondary, focusRing, input } from '../ui/styles';

export type SortKey = 'opened' | 'modified' | 'name';
export type ViewKey = 'grid' | 'list';

interface ToolbarProps {
  query: string;
  onQuery: (q: string) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  view: ViewKey;
  onView: (v: ViewKey) => void;
  showCollectionControls: boolean;
  onImport: (file: File) => void;
  onNewBlank: () => void;
  onNewExample: () => void;
  exampleBusy: boolean;
}

export const Toolbar = forwardRef<HTMLInputElement, ToolbarProps>(function Toolbar(
  { query, onQuery, sort, onSort, view, onView, showCollectionControls, onImport, onNewBlank, onNewExample, exampleBusy },
  searchRef
) {
  const importRef = useRef<HTMLInputElement>(null);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!newMenuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!newMenuRef.current?.contains(e.target as Node)) setNewMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [newMenuOpen]);

  return (
    <header className="sticky top-0 z-20 border-b border-nt-line bg-nt-bg/95">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-3 px-4 py-3.5 sm:flex-nowrap sm:px-6">
        <div className="mr-auto flex items-center gap-2.5">
          <img src={nodetaleLogo} alt="" className="h-7 w-auto" />
          <span className="sr-only">NodeTale</span>
        </div>

        {showCollectionControls && (
          <>
            {/* Own full-width row on phones; inline beside the logo from sm up. */}
            <div className="relative order-last w-full sm:order-none sm:mr-auto sm:w-auto sm:max-w-xs sm:flex-1">
              <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-nt-ink-3" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { onQuery(''); e.currentTarget.blur(); } }}
                placeholder="Search stories"
                aria-label="Search stories"
                className={`${input} pl-9 pr-8 [&::-webkit-search-cancel-button]:hidden`}
              />
              {query ? (
                <button type="button" onClick={() => onQuery('')} aria-label="Clear search"
                  className={`absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-nt-ink-3 hover:text-nt-ink ${focusRing}`}>
                  <X size={14} />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-nt-line px-1.5 font-mono text-[11px] text-nt-ink-3">/</kbd>
              )}
            </div>

            <label className="hidden items-center gap-2 text-xs text-nt-ink-3 md:flex">
              <span>Sort</span>
              <select value={sort} onChange={(e) => onSort(e.target.value as SortKey)}
                className={`h-9 rounded-md border border-nt-line-strong bg-nt-bg px-2.5 text-sm text-nt-ink-2 hover:border-nt-ink-3 ${focusRing}`}>
                <option value="opened">Recently opened</option>
                <option value="modified">Last edited</option>
                <option value="name">Name</option>
              </select>
            </label>

            <div role="radiogroup" aria-label="Layout" className="hidden rounded-md border border-nt-line bg-nt-bg p-0.5 sm:flex">
              {([['grid', LayoutGrid, 'Grid'], ['list', List, 'List']] as const).map(([key, Icon, label]) => (
                <button key={key} type="button" role="radio" aria-checked={view === key} aria-label={label} title={label}
                  onClick={() => onView(key)}
                  className={`flex h-8 w-8 items-center justify-center rounded transition-colors duration-150 ${focusRing} ${view === key ? 'bg-nt-raised text-nt-ink' : 'text-nt-ink-3 hover:text-nt-ink-2'}`}>
                  <Icon size={15} />
                </button>
              ))}
            </div>
          </>
        )}

        <button type="button" className={buttonSecondary} onClick={() => importRef.current?.click()}>
          <Upload size={15} aria-hidden /> <span className="hidden sm:inline">Import</span>
        </button>
        <input ref={importRef} type="file" accept=".json,.zip" className="hidden" tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) onImport(file);
          }} />

        <div ref={newMenuRef} className="relative flex">
          <button type="button" className={`${buttonPrimary} rounded-r-none`} onClick={onNewBlank}>
            <Plus size={16} aria-hidden /> <span className="whitespace-nowrap">New<span className="hidden sm:inline"> story</span></span>
          </button>
          <button type="button" aria-label="More ways to start" aria-haspopup="menu" aria-expanded={newMenuOpen}
            onClick={() => setNewMenuOpen((o) => !o)}
            className={`${buttonPrimary} rounded-l-none border-l border-nt-accent-ink/25 px-2`}>
            <ChevronDown size={15} />
          </button>
          {newMenuOpen && (
            <div role="menu" className="absolute right-0 top-11 z-30 w-60 overflow-hidden rounded-lg border border-nt-line bg-nt-surface py-1 shadow-2xl"
              onKeyDown={(e) => { if (e.key === 'Escape') setNewMenuOpen(false); }}>
              <button role="menuitem" autoFocus className="block w-full px-3 py-2 text-left hover:bg-nt-raised focus-visible:bg-nt-raised focus-visible:outline-none"
                onClick={() => { setNewMenuOpen(false); onNewBlank(); }}>
                <span className="block text-sm text-nt-ink">Blank story</span>
                <span className="block text-xs text-nt-ink-3">A Start scene on an empty board</span>
              </button>
              <button role="menuitem" disabled={exampleBusy} className="block w-full px-3 py-2 text-left hover:bg-nt-raised focus-visible:bg-nt-raised focus-visible:outline-none disabled:opacity-60"
                onClick={() => { setNewMenuOpen(false); onNewExample(); }}>
                <span className="block text-sm text-nt-ink">{exampleBusy ? 'Adding example…' : 'Example story'}</span>
                <span className="block text-xs text-nt-ink-3">A short mystery with branches and media</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
});
