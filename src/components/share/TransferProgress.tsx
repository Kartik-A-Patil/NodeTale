import type { Progress } from '../../services/liveShare';

const mb = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/** "Sending 3 of 8 files · 4.2 of 8.9 MB", with a bar. */
export function TransferProgress({ progress, verb, finished }: { progress: Progress | null; verb: string; finished?: boolean }) {
  const ratio = finished ? 1 : progress && progress.total ? progress.done / progress.total : 0;
  return (
    <div role="status" aria-live="polite">
      <div className="h-1.5 overflow-hidden rounded-full bg-nt-raised">
        <div className="h-full rounded-full bg-nt-accent transition-[width] duration-200" style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      <p className="mt-2 text-xs text-nt-ink-3">
        {!progress
          ? 'Connecting…'
          : progress.fileCount === 0
            ? finished ? 'Story sent (no media).' : `${verb} the story…`
            : `${finished ? 'All' : `${verb} ${Math.min(progress.files + 1, progress.fileCount)} of`} ${progress.fileCount} ${progress.fileCount === 1 ? 'file' : 'files'} · ${mb(progress.done)} of ${mb(progress.total)}`}
      </p>
    </div>
  );
}
