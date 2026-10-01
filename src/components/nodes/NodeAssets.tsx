import { Music, X } from 'lucide-react';
import { Asset, AudioSettings } from '../../models/story';
import { AssetPreview } from '../AssetPreview';

const detachButton = 'nodrag inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-nt-ink-3 opacity-0 transition-opacity hover:bg-nt-raised hover:text-nt-danger focus-visible:opacity-100 group-hover:opacity-100';

export function NodeVisualAsset({ asset, onDetach }: { asset: Asset; onDetach: () => void }) {
  return (
    <figure className="group relative mb-2.5 overflow-hidden rounded-md border border-nt-line bg-nt-bg">
      <AssetPreview
        asset={asset}
        className="flex min-h-24 w-full items-center justify-center"
        imgClassName="block max-h-48 w-full object-cover"
      />
      <button
        type="button"
        onClick={onDetach}
        aria-label={`Detach ${asset.name}`}
        title="Detach from scene"
        className={`${detachButton} absolute right-1.5 top-1.5 bg-nt-surface/90 backdrop-blur`}
      >
        <X size={13} />
      </button>
    </figure>
  );
}

/** "Loop · 1.5s delay", or '' when the defaults apply. */
const audioMeta = ({ loop, delay }: AudioSettings) =>
  [loop && 'Loop', delay > 0 && `${Math.round(delay / 100) / 10}s delay`].filter(Boolean).join(' · ');

export function NodeAudioList({
  assets,
  settings,
  onConfigure,
  onDetach,
}: {
  assets: Asset[];
  settings?: Record<string, AudioSettings>;
  onConfigure: (asset: Asset) => void;
  onDetach: (asset: Asset) => void;
}) {
  return (
    <ul className="mt-2.5 flex flex-col border-t border-nt-line/60 pt-1.5">
      {assets.map((asset) => {
        const meta = audioMeta(settings?.[asset.id] ?? { loop: false, delay: 0 });
        return (
          <li key={asset.id} className="group flex items-center gap-1">
            <button
              type="button"
              onClick={() => onConfigure(asset)}
              title="Audio settings"
              className="nodrag flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-xs text-nt-ink-2 transition-colors hover:text-nt-ink"
            >
              <Music size={12} className="shrink-0 text-nt-ink-3 transition-colors group-hover:text-nt-accent" />
              <span className="min-w-0 truncate">{asset.name}</span>
              {meta && <span className="shrink-0 text-[10px] text-nt-ink-3">{meta}</span>}
            </button>
            <button type="button" onClick={() => onDetach(asset)} aria-label={`Detach ${asset.name}`} title="Detach from scene" className={detachButton}>
              <X size={12} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
