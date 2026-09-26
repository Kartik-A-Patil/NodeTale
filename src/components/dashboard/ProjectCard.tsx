import { memo } from 'react';
import { ProjectSummary } from '../../types';
import { formatRelativeTime } from '../../utils/localPrefs';
import { focusRing } from '../ui/styles';
import { GraphThumbnail } from './GraphThumbnail';
import { EditableTitle } from './EditableTitle';
import { ProjectActions, ProjectActionsMenu } from './ProjectActionsMenu';

export interface ProjectItemProps {
  project: ProjectSummary;
  index: number;
  renaming: boolean;
  onRenameSubmit: (name: string) => Promise<string | null>;
  onRenameDone: () => void;
  actions: ProjectActions;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const projectStatsText = (p: ProjectSummary) =>
  p.stats
    ? [plural(p.stats.scenes, 'scene'), plural(p.stats.endings, 'ending'), plural(p.boardCount, 'board')].join(' · ')
    : plural(p.boardCount, 'board');

const editedText = (p: ProjectSummary) => (p.modifiedAt ? `Edited ${formatRelativeTime(p.modifiedAt)}` : 'Not saved yet');

// Canvas-like dot grid behind thumbnails, echoing the editor.
const dotGrid = 'bg-nt-bg bg-[radial-gradient(oklch(var(--nt-line))_1px,transparent_1px)] bg-[length:14px_14px]';

/** Stretched "open" button: the whole item is clickable; keyboard focus lands here. */
const OpenButton = ({ project, index, onOpen, rounded }: { project: ProjectSummary; index: number; onOpen: () => void; rounded: string }) => (
  <button
    type="button"
    data-project-index={index}
    onClick={onOpen}
    aria-label={`Open ${project.name}. ${projectStatsText(project)}. ${editedText(project)}`}
    className={`absolute inset-0 z-0 ${rounded} ${focusRing} focus-visible:outline-offset-0`}
  />
);

export const ProjectCard = memo(({ project, index, renaming, onRenameSubmit, onRenameDone, actions }: ProjectItemProps) => (
  <article className="group relative flex flex-col rounded-lg border border-nt-line bg-nt-surface transition-colors duration-150 hover:border-nt-line-strong">
    <OpenButton project={project} index={index} onOpen={actions.onOpen} rounded="rounded-lg" />
    <div className={`pointer-events-none relative aspect-[16/10] overflow-hidden rounded-t-[7px] border-b border-nt-line ${dotGrid}`}>
      {project.coverImage && <img src={project.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />}
      <div className="absolute inset-0 p-4">
        <GraphThumbnail thumbnail={project.thumbnail} />
      </div>
    </div>
    <div className="flex items-start gap-1 py-3 pl-4 pr-2">
      <div className="pointer-events-none min-w-0 flex-1">
        <h3 className={`relative ${renaming ? 'pointer-events-auto z-10' : ''}`}>
          <EditableTitle name={project.name} editing={renaming} onSubmit={onRenameSubmit} onDone={onRenameDone}
            className="block truncate text-sm font-semibold text-nt-ink" />
        </h3>
        <p className="mt-1 truncate text-xs text-nt-ink-3">{projectStatsText(project)}</p>
        <p className="mt-0.5 text-xs text-nt-ink-3">{editedText(project)}</p>
      </div>
      <div className="relative z-10">
        <ProjectActionsMenu name={project.name} actions={actions} />
      </div>
    </div>
  </article>
));

export const ProjectRow = memo(({ project, index, renaming, onRenameSubmit, onRenameDone, actions }: ProjectItemProps) => (
  <li className="group relative grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-4 border-b border-nt-line px-3 py-2.5 transition-colors duration-150 last:border-b-0 hover:bg-nt-surface md:grid-cols-[88px_minmax(0,2fr)_minmax(0,1.4fr)_9rem_auto]">
    <OpenButton project={project} index={index} onOpen={actions.onOpen} rounded="rounded-md" />
    <div className={`pointer-events-none relative h-[52px] overflow-hidden rounded border border-nt-line ${dotGrid}`}>
      {project.coverImage && <img src={project.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />}
      <div className="absolute inset-0 p-1.5"><GraphThumbnail thumbnail={project.thumbnail} size="row" /></div>
    </div>
    <div className="pointer-events-none min-w-0">
      <div className={`relative ${renaming ? 'pointer-events-auto z-10' : ''}`}>
        <EditableTitle name={project.name} editing={renaming} onSubmit={onRenameSubmit} onDone={onRenameDone}
          className="block truncate text-sm font-semibold text-nt-ink" />
      </div>
      <p className="mt-0.5 truncate text-xs text-nt-ink-3 md:hidden">{projectStatsText(project)} · {editedText(project)}</p>
      <p className="mt-0.5 hidden truncate text-xs text-nt-ink-3 md:block">{project.stats?.boardNames.join(', ')}</p>
    </div>
    <p className="pointer-events-none hidden truncate text-xs text-nt-ink-2 md:block">{projectStatsText(project)}</p>
    <p className="pointer-events-none hidden text-xs text-nt-ink-3 md:block">{editedText(project)}</p>
    <div className="relative z-10">
      <ProjectActionsMenu name={project.name} actions={actions} />
    </div>
  </li>
));
