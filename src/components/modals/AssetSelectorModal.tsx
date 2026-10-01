import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Film, Image as ImageIcon, Music, Search, X } from 'lucide-react';
import { Asset, Project } from '../../models/story';
import { AssetPreview } from '../AssetPreview';
import { isVisualAsset } from '../../utils/nodeAssets';
import { toolButton } from '../editor/editorStyles';

interface AssetSelectorModalProps {
  project: Project;
  currentAssets: string[];
  onSelect: (asset: Asset) => void;
  onClose: () => void;
}

type Filter = 'all' | Asset['type'];
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
];
const TYPE_ICON = { image: ImageIcon, video: Film, audio: Music } as const;

// Pick an asset to attach to a scene: searchable, filterable, with thumbnails.
export const AssetSelectorModal = ({ project, currentAssets, onSelect, onClose }: AssetSelectorModalProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const folderName = useMemo(() => new Map((project.folders || []).map((f) => [f.id, f.name])), [project.folders]);
  const hasVisual = currentAssets.some((id) => {
    const asset = project.assets.find((a) => a.id === id);
    return asset && isVisualAsset(asset);
  });

  const q = query.trim().toLowerCase();
  const assets = project.assets.filter((asset) =>
    (filter === 'all' || asset.type === filter) && (!q || asset.name.toLowerCase().includes(q)));

  return (
    <dialog
      ref={ref}
      aria-label="Attach an asset"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="nt-dialog w-[min(44rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-nt-line bg-nt-surface p-0 text-nt-ink shadow-2xl"
    >
      <header className="flex items-center justify-between border-b border-nt-line py-2 pl-5 pr-2">
        <h2 className="text-sm font-semibold">Attach an asset</h2>
        <button type="button" onClick={onClose} className={toolButton} aria-label="Close"><X size={16} /></button>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-nt-line px-5 py-3">
        <label className="flex h-8 min-w-48 flex-1 items-center gap-2 rounded-lg border border-nt-line bg-nt-bg px-2.5 focus-within:border-nt-line-strong">
          <Search size={14} className="shrink-0 text-nt-ink-3" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search assets"
            aria-label="Search assets"
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-nt-ink outline-none placeholder:text-nt-ink-3"
          />
        </label>
        <div role="radiogroup" aria-label="Asset type" className="flex rounded-lg border border-nt-line bg-nt-bg p-0.5">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={filter === id}
              onClick={() => setFilter(id)}
              className="rounded-md px-2.5 py-1 text-xs text-nt-ink-3 transition-colors hover:text-nt-ink aria-checked:bg-nt-raised aria-checked:text-nt-ink"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[min(60vh,32rem)] overflow-y-auto p-4">
        {assets.length === 0 ? (
          <p className="py-12 text-center text-sm text-nt-ink-3">
            {project.assets.length === 0 ? 'No assets yet. Upload files from the Assets panel.' : 'No assets match your search.'}
          </p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
            {assets.map((asset) => {
              const attached = currentAssets.includes(asset.id);
              const replaces = !attached && hasVisual && isVisualAsset(asset);
              const Icon = TYPE_ICON[asset.type];
              return (
                <li key={asset.id}>
                  <button
                    type="button"
                    disabled={attached}
                    onClick={() => onSelect(asset)}
                    className="group flex w-full flex-col overflow-hidden rounded-lg border border-nt-line bg-nt-bg text-left transition-colors hover:border-nt-accent/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-nt-focus disabled:cursor-default disabled:hover:border-nt-line"
                  >
                    <span className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-nt-raised/60">
                      {asset.type === 'audio'
                        ? <Music size={22} className="text-nt-ink-3" />
                        : <AssetPreview asset={asset} className="h-full w-full" imgClassName="h-full w-full object-cover" />}
                      {attached && (
                        <span className="absolute inset-0 flex items-center justify-center gap-1 bg-nt-bg/90 text-xs font-medium text-nt-ink">
                          <Check size={13} className="text-nt-success" /> Attached
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1.5 px-2.5 pb-0.5 pt-2 text-xs text-nt-ink">
                      <Icon size={12} className="shrink-0 text-nt-ink-3" />
                      <span className="truncate">{asset.name}</span>
                    </span>
                    <span className="truncate px-2.5 pb-2 text-[11px] text-nt-ink-3">
                      {replaces ? 'Replaces the current visual' : folderName.get(asset.parentId ?? '') ?? 'Project root'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </dialog>
  );
};
