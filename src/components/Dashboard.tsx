import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { getProjectSummaries, saveProject, loadProject, deleteProject, checkProjectNameExists } from '../services/storageService';
import { createExampleProject, importProjectFile } from '../services/projectImport';
import { Project, ProjectSummary } from '../models/story';
import { INITIAL_PROJECT } from '../constants';
import { exportProject } from '../utils/projectUtils';
import { shrinkCoverImage } from '../utils/coverImage';
import { getLastOpened, useLocalPref } from '../utils/localPrefs';
import { CreateProjectModal } from './modals/CreateProjectModal';
import { DeleteProjectModal } from './modals/DeleteProjectModal';
import { Toolbar, SortKey, ViewKey } from './dashboard/Toolbar';
import { FirstRun } from './dashboard/FirstRun';
import { ProjectCard, ProjectRow, ProjectItemProps } from './dashboard/ProjectCard';
import { buttonSecondary, focusRing } from './ui/styles';

type Status = { tone: 'info' | 'success' | 'error'; text: string } | null;

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

export default function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [lastOpened, setLastOpened] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [sort, setSort] = useLocalPref<SortKey>('nodetale:dashboard:sort', 'opened');
  const [view, setView] = useLocalPref<ViewKey>('nodetale:dashboard:view', 'grid');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [exampleBusy, setExampleBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    setProjects(await getProjectSummaries());
    setLastOpened(getLastOpened());
  }, []);

  useEffect(() => {
    reload().catch((err) => {
      setProjects([]);
      setStatus({ tone: 'error', text: `Couldn’t load your stories: ${errorText(err)}` });
    });
  }, [reload]);

  // "/" focuses search (unless already typing somewhere).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !t.closest('input, textarea, [contenteditable=true]')) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const visible = useMemo(() => {
    if (!projects) return [];
    const q = query.trim().toLowerCase();
    const matched = q
      ? projects.filter((p) => p.name.toLowerCase().includes(q) || p.stats?.boardNames.some((b) => b.toLowerCase().includes(q)))
      : [...projects];
    const byName = (a: ProjectSummary, b: ProjectSummary) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    const byEdited = (a: ProjectSummary, b: ProjectSummary) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0);
    const byOpened = (a: ProjectSummary, b: ProjectSummary) =>
      (lastOpened[b.id] ?? b.modifiedAt ?? 0) - (lastOpened[a.id] ?? a.modifiedAt ?? 0);
    return matched.sort(sort === 'name' ? byName : sort === 'modified' ? byEdited : byOpened);
  }, [projects, query, sort, lastOpened]);

  // ---------- actions ----------

  const open = useCallback((id: string) => navigate(`/${id}`), [navigate]);

  const createBlank = async (name: string, coverImage: string | null): Promise<string | null> => {
    if (await checkProjectNameExists(name)) return 'You already have a story with that name.';
    const boardId = crypto.randomUUID();
    const project: Project = {
      ...INITIAL_PROJECT,
      id: crypto.randomUUID(),
      name,
      boards: [{ ...INITIAL_PROJECT.boards[0], id: boardId }],
      activeBoardId: boardId,
      coverImage: coverImage || undefined,
    };
    await saveProject(project);
    setCreating(false);
    open(project.id);
    return null;
  };

  const addExample = async () => {
    setExampleBusy(true);
    setStatus({ tone: 'info', text: 'Adding the example story…' });
    try {
      const project = await createExampleProject();
      await reload();
      setStatus({ tone: 'success', text: `Added “${project.name}”.` });
    } catch (err) {
      setStatus({ tone: 'error', text: `Couldn’t add the example: ${errorText(err)}` });
    } finally {
      setExampleBusy(false);
    }
  };

  const importFile = async (file: File) => {
    setStatus({ tone: 'info', text: `Importing ${file.name}…` });
    try {
      const project = await importProjectFile(file);
      await reload();
      setStatus({ tone: 'success', text: `Imported “${project.name}”.` });
    } catch (err) {
      setStatus({ tone: 'error', text: `Couldn’t import ${file.name}: ${errorText(err)}` });
    }
  };

  /** Load the full project, apply a change, save, refresh the list. */
  const update = async (id: string, change: (p: Project) => Project) => {
    const project = await loadProject(id);
    if (!project) throw new Error('The story could not be loaded');
    await saveProject(change(project));
    await reload();
  };

  const rename = async (summary: ProjectSummary, name: string): Promise<string | null> => {
    if (name !== summary.name && (await checkProjectNameExists(name))) return 'Another story already has that name.';
    try {
      await update(summary.id, (p) => ({ ...p, name }));
      return null;
    } catch (err) {
      return errorText(err);
    }
  };

  const duplicate = async (summary: ProjectSummary) => {
    const project = await loadProject(summary.id);
    if (!project) return;
    let name = `${project.name} (Copy)`;
    for (let n = 2; await checkProjectNameExists(name); n++) name = `${project.name} (Copy ${n})`;
    await saveProject({ ...project, id: crypto.randomUUID(), name });
    await reload();
    setStatus({ tone: 'success', text: `Duplicated as “${name}”.` });
  };

  const exportJson = async (summary: ProjectSummary) => {
    const project = await loadProject(summary.id);
    if (project) exportProject(project);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const name = deleteTarget.name;
    await deleteProject(deleteTarget.id);
    setDeleteTarget(null);
    await reload();
    setStatus({ tone: 'success', text: `Deleted “${name}”.` });
  };

  const actionsFor = (p: ProjectSummary) => ({
    onOpen: () => open(p.id),
    onRename: () => setRenamingId(p.id),
    onDuplicate: () => duplicate(p),
    onExport: () => exportJson(p),
    onChangeCover: async (file: File) => {
      const coverImage = await shrinkCoverImage(file);
      await update(p.id, (proj) => ({ ...proj, coverImage }));
    },
    onRemoveCover: p.coverImage ? () => update(p.id, (proj) => ({ ...proj, coverImage: undefined })) : undefined,
    onDelete: () => setDeleteTarget(p),
  });

  // Arrow keys move between stories; F2 renames, Delete deletes.
  const onListKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const index = target.dataset.projectIndex;
    if (index === undefined) return;
    const i = Number(index);
    const items = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-project-index]') || [])];
    const columns = view === 'grid' ? items.filter((el) => el.offsetTop === items[0]?.offsetTop).length || 1 : 1;
    const move = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[e.key as string];
    if (move !== undefined) {
      e.preventDefault();
      items[Math.max(0, Math.min(items.length - 1, i + move))]?.focus();
    } else if (e.key === 'F2') {
      e.preventDefault();
      setRenamingId(visible[i]?.id ?? null);
    } else if (e.key === 'Delete') {
      e.preventDefault();
      if (visible[i]) setDeleteTarget(visible[i]);
    }
  };

  // ---------- render ----------

  const hasProjects = !!projects && projects.length > 0;
  const Item = view === 'grid' ? ProjectCard : ProjectRow;
  const itemProps = (p: ProjectSummary, index: number): ProjectItemProps => ({
    project: p,
    index,
    renaming: renamingId === p.id,
    onRenameSubmit: (name) => rename(p, name),
    onRenameDone: () => setRenamingId(null),
    actions: actionsFor(p),
  });

  return (
    <div className="min-h-screen bg-nt-bg text-nt-ink">
      <Toolbar
        ref={searchRef}
        query={query}
        onQuery={setQuery}
        sort={sort}
        onSort={setSort}
        view={view}
        onView={setView}
        showCollectionControls={hasProjects}
        onImport={importFile}
        onNewBlank={() => setCreating(true)}
        onNewExample={addExample}
        exampleBusy={exampleBusy}
      />

      <div role="status" aria-live="polite" className="mx-auto max-w-7xl px-4 sm:px-6">
        {status && (
          <div className={`mt-4 flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
            status.tone === 'error' ? 'border-nt-danger/50 bg-nt-danger/10 text-nt-ink' : 'border-nt-line bg-nt-surface text-nt-ink-2'
          }`}>
            <span className="flex-1">{status.text}</span>
            <button type="button" onClick={() => setStatus(null)} aria-label="Dismiss" className={`rounded p-1 text-nt-ink-3 hover:text-nt-ink ${focusRing}`}>
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {projects === null ? (
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading stories">
          <div className="mb-6 h-6 w-32 animate-pulse rounded bg-nt-surface" />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-5">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="overflow-hidden rounded-lg border border-nt-line bg-nt-surface">
                <div className="aspect-[16/10] animate-pulse bg-nt-raised/40" />
                <div className="space-y-2 p-4">
                  <div className="h-3.5 w-2/3 animate-pulse rounded bg-nt-raised" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-nt-raised/70" />
                </div>
              </div>
            ))}
          </div>
        </main>
      ) : !hasProjects ? (
        <main>
          <FirstRun onExample={addExample} exampleBusy={exampleBusy} onBlank={() => setCreating(true)} onImport={() => importRef.current?.click()} />
          <input ref={importRef} type="file" accept=".json,.zip" className="hidden" tabIndex={-1}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importFile(f); }} />
        </main>
      ) : (
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="mb-5 flex items-baseline gap-3">
            <h1 className="text-lg font-semibold text-nt-ink">Stories</h1>
            <span className="text-sm text-nt-ink-3">
              {query ? `${visible.length} of ${projects.length}` : projects.length}
            </span>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-lg border border-dashed border-nt-line px-6 py-12 text-center">
              <p className="text-sm text-nt-ink-2">No stories match “{query}”.</p>
              <button type="button" className={`${buttonSecondary} mt-4`} onClick={() => setQuery('')}>Clear search</button>
            </div>
          ) : (
            <div ref={listRef} onKeyDown={onListKeyDown}>
              {view === 'grid' ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-5">
                  {visible.map((p, i) => <Item key={p.id} {...itemProps(p, i)} />)}
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-nt-line">
                  <div aria-hidden className="hidden grid-cols-[88px_minmax(0,2fr)_minmax(0,1.4fr)_9rem_auto] gap-4 border-b border-nt-line bg-nt-surface px-3 py-2 text-xs font-medium text-nt-ink-3 md:grid">
                    <span />
                    <span>Name · boards</span>
                    <span>Size</span>
                    <span>Last edited</span>
                    <span className="w-8" />
                  </div>
                  <ul>{visible.map((p, i) => <Item key={p.id} {...itemProps(p, i)} />)}</ul>
                </div>
              )}
            </div>
          )}
        </main>
      )}

      <CreateProjectModal open={creating} onClose={() => setCreating(false)} onCreate={createBlank} />
      <DeleteProjectModal projectName={deleteTarget?.name ?? null} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
    </div>
  );
}
