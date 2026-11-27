import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Pause, Play } from 'lucide-react';
import { Asset, AudioSettings } from '../../models/story';
import { useAssetUrl } from '../../hooks/useAssetUrl';
import { Dialog } from '../ui/NativeDialog';
import { Switch } from '../ui/switch';
import { buttonPrimary, buttonSecondary, input } from '../ui/styles';

interface AudioSettingsModalProps {
  asset: Asset;
  settings: AudioSettings;
  onSave: (settings: AudioSettings) => void;
  onClose: () => void;
}

const formatTime = (time: number) => `${Math.floor(time / 60)}:${Math.floor(time % 60).toString().padStart(2, '0')}`;

// How a scene's sound plays: preview it, loop it, delay its start.
// Portaled out of the canvas node so dragging the seek bar can't drag the node.
export function AudioSettingsModal({ asset, settings, onSave, onClose }: AudioSettingsModalProps) {
  const { url: storageUrl, isLoading } = useAssetUrl(asset.id, asset.type);
  const src = storageUrl || asset.url || null;
  const audioRef = useRef<HTMLAudioElement>(null);

  const [loop, setLoop] = useState(settings.loop);
  const [delaySeconds, setDelaySeconds] = useState(String(settings.delay / 1000));
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else void audio.play();
    setPlaying(!playing);
  };

  const save = () => {
    const seconds = Number.parseFloat(delaySeconds);
    onSave({ loop, delay: Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : 0 });
    onClose();
  };

  return createPortal(
    <Dialog
      open
      onClose={onClose}
      title="Audio settings"
      description={<span className="block truncate" title={asset.name}>{asset.name}</span>}
      onSubmit={(e) => { e.preventDefault(); save(); }}
      actions={
        <>
          <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" className={buttonPrimary}>Save</button>
        </>
      }
    >
      <div className="flex items-center gap-3 rounded-lg border border-nt-line bg-nt-bg p-3">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!src || isLoading}
          aria-label={playing ? 'Pause preview' : 'Play preview'}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nt-raised text-nt-ink transition-colors hover:bg-nt-accent hover:text-nt-accent-ink disabled:opacity-50"
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={time}
          aria-label="Seek"
          onChange={(e) => {
            const next = Number(e.target.value);
            if (audioRef.current) audioRef.current.currentTime = next;
            setTime(next);
          }}
          className="h-1 min-w-0 flex-1 cursor-pointer accent-nt-accent"
        />
        <span className="shrink-0 font-mono text-xs tabular-nums text-nt-ink-3">{formatTime(time)} / {formatTime(duration)}</span>
        {src && (
          <audio
            ref={audioRef}
            src={src}
            loop={loop}
            onEnded={() => setPlaying(false)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          />
        )}
      </div>

      <div className="mt-4 divide-y divide-nt-line">
        <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
          <span>
            <span className="block text-sm font-medium text-nt-ink">Loop</span>
            <span className="block text-xs text-nt-ink-3">Start again when it ends</span>
          </span>
          <Switch checked={loop} onCheckedChange={setLoop} aria-label="Loop" />
        </label>
        <label className="flex items-center justify-between gap-4 py-3">
          <span>
            <span className="block text-sm font-medium text-nt-ink">Start delay</span>
            <span className="block text-xs text-nt-ink-3">Wait before it starts playing</span>
          </span>
          <span className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={0.1}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(e.target.value)}
              aria-label="Start delay in seconds"
              className={`${input} w-20 text-right tabular-nums`}
            />
            <span className="text-xs text-nt-ink-3">sec</span>
          </span>
        </label>
      </div>
    </Dialog>,
    document.body,
  );
}
