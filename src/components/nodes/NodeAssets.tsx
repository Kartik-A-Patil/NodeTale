import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Repeat, SlidersHorizontal, X } from 'lucide-react';
import { Asset, AudioSettings } from '../../models/story';
import { AssetPreview } from '../AssetPreview';
import { useAssetUrl } from '../../hooks/useAssetUrl';

const hoverButton = 'nodrag inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-nt-ink-3 opacity-0 transition-opacity hover:bg-nt-raised hover:text-nt-ink focus-visible:opacity-100 group-hover:opacity-100';

/** The scene's picture, flush under the header: edge to edge, no inner frame. */
export function NodeVisualAsset({ asset, onDetach }: { asset: Asset; onDetach: () => void }) {
  return (
    <figure className="group relative -mx-2.5 -mt-2 mb-2 overflow-hidden border-b border-nt-line/40 bg-nt-bg">
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
        className={`${hoverButton} absolute right-1.5 top-1.5 h-6 w-6 bg-nt-surface/90 hover:text-nt-danger`}
      >
        <X size={13} />
      </button>
    </figure>
  );
}

// One preview at a time across the whole canvas: starting another stops this one.
let nowPlaying: { audio: HTMLAudioElement; stop: () => void } | null = null;

/** ▶ to listen without leaving the canvas. */
function PreviewButton({ asset }: { asset: Asset }) {
  const { url } = useAssetUrl(asset.id, 'audio');
  const [playing, setPlaying] = useState(false);
  const mine = useRef<HTMLAudioElement | null>(null);

  // Scrolling the node away (or deleting it) ends its preview.
  useEffect(() => () => {
    if (nowPlaying && nowPlaying.audio === mine.current) nowPlaying.stop();
  }, []);

  const toggle = () => {
    if (playing) return nowPlaying?.stop();
    const src = url || asset.url;
    if (!src) return;
    nowPlaying?.stop();
    const audio = new Audio(src);
    mine.current = audio;
    const stop = () => {
      audio.pause();
      setPlaying(false);
      if (nowPlaying?.audio === audio) nowPlaying = null;
    };
    audio.onended = stop;
    nowPlaying = { audio, stop };
    audio.play().then(() => setPlaying(true)).catch(stop);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? `Stop ${asset.name}` : `Play ${asset.name}`}
      title={playing ? 'Stop' : 'Listen'}
      className={`nodrag inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${playing ? 'bg-nt-accent text-nt-bg' : 'bg-nt-raised text-nt-ink-2 hover:text-nt-ink'}`}
    >
      {playing ? <Pause size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" className="translate-x-px" />}
    </button>
  );
}

/** A scene's sounds: listen, see loop/delay at a glance, open settings, detach. */
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
    <ul className="mt-2 flex flex-col gap-0.5">
      {assets.map((asset) => {
        const { loop, delay } = settings?.[asset.id] ?? { loop: false, delay: 0 };
        return (
          <li key={asset.id} className="group flex h-7 items-center gap-1.5 rounded-md bg-nt-bg/60 pl-1 pr-0.5 text-xs">
            <PreviewButton asset={asset} />
            <button
              type="button"
              onClick={() => onConfigure(asset)}
              title="Audio settings"
              className="nodrag min-w-0 flex-1 truncate text-left text-nt-ink-2 transition-colors hover:text-nt-ink"
            >
              {asset.name}
            </button>
            {loop && <Repeat size={11} className="shrink-0 text-nt-ink-3" aria-label="Loops" />}
            {delay > 0 && <span className="shrink-0 font-mono text-[10px] text-nt-ink-3" title="Starts after">+{Math.round(delay / 100) / 10}s</span>}
            <button type="button" onClick={() => onConfigure(asset)} aria-label={`Settings for ${asset.name}`} title="Loop and delay" className={hoverButton}>
              <SlidersHorizontal size={11} />
            </button>
            <button type="button" onClick={() => onDetach(asset)} aria-label={`Detach ${asset.name}`} title="Detach from scene" className={`${hoverButton} hover:text-nt-danger`}>
              <X size={11} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
