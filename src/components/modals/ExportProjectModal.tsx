import { useEffect, useState } from 'react';
import { FileArchive, FileJson, Images } from 'lucide-react';
import { Project } from '../../models/story';
import { exportProject, exportProjectAsZip } from '../../utils/projectUtils';
import { Dialog } from '../ui/NativeDialog';
import { buttonPrimary, buttonSecondary, focusRing } from '../ui/styles';

interface ExportProjectModalProps {
  /** The project to export (taken from the live canvas when opened); null when closed. */
  project: Project | null;
  onClose: () => void;
}

type Format = 'zip-assets' | 'zip' | 'json';

const FORMATS: { id: Format; title: string; detail: string; icon: typeof FileArchive }[] = [
  { id: 'zip-assets', title: 'Everything (.zip)', detail: 'Story plus every image, sound and video. Best for backups and sharing.', icon: Images },
  { id: 'zip', title: 'Story only (.zip)', detail: 'Boards, scenes and variables without media. Much smaller.', icon: FileArchive },
  { id: 'json', title: 'Story file (.json)', detail: 'A single text file of the story structure, for tools or version control.', icon: FileJson },
];

// The one export: formats are choices inside it rather than separate buttons.
export function ExportProjectModal({ project, onClose }: ExportProjectModalProps) {
  const [format, setFormat] = useState<Format>('zip-assets');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (project) { setBusy(false); setError(''); } }, [project]);

  const run = async () => {
    if (!project) return;
    setBusy(true);
    setError('');
    try {
      if (format === 'json') exportProject(project);
      else await exportProjectAsZip(project, format === 'zip-assets');
      onClose();
    } catch (err) {
      setError(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={project !== null}
      onClose={onClose}
      title="Export story"
      description="Exported files can be imported again from the dashboard."
      onSubmit={(e) => { e.preventDefault(); run(); }}
      actions={
        <>
          <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" className={buttonPrimary} disabled={busy}>{busy ? 'Exporting…' : 'Export'}</button>
        </>
      }
    >
      <fieldset>
        <legend className="sr-only">Format</legend>
        <div className="space-y-2">
          {FORMATS.map((f) => (
            <label key={f.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-nt-focus ${
                format === f.id ? 'border-nt-accent bg-nt-accent/10' : 'border-nt-line hover:border-nt-line-strong'
              }`}>
              <input type="radio" name="export-format" value={f.id} checked={format === f.id} onChange={() => setFormat(f.id)} className={`sr-only ${focusRing}`} />
              <f.icon size={18} aria-hidden className={`mt-0.5 shrink-0 ${format === f.id ? 'text-nt-accent' : 'text-nt-ink-3'}`} />
              <span>
                <span className="block text-sm font-medium text-nt-ink">{f.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-nt-ink-3">{f.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p role="alert" className="mt-3 text-sm text-nt-danger">{error}</p>}
    </Dialog>
  );
}
