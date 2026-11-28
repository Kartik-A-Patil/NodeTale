import { Project } from '../models/story';
import { compactProject, deleteProject, saveProject } from './storageService';
import { hashString } from '../utils/contentHash';
import { readPref, writePref } from '../utils/localPrefs';
import { shortId } from '../utils/id';

// Safety copies around live sessions. One backup per story, replaced each
// time, so they don't pile up on the dashboard; media isn't copied (a backup
// refers to the same stored files).

const BACKUPS = 'nodetale:backupOf';       // story id -> its backup's id
const SYNCED = 'nodetale:sessionSynced:';  // story id -> fingerprint when its last session ended

const when = () => new Date().toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** What the story says, ignoring where you were looking and when it was saved. */
export const fingerprint = (p: Project) => {
  const { modifiedAt: _m, activeBoardId: _a, ...rest } = compactProject(p);
  return hashString(JSON.stringify(rest));
};

/** Save "Story (label, 28 Nov, 14:05)" as its own story, replacing this story's previous backup. */
export async function backUp(project: Project, label: string): Promise<Project> {
  const map = readPref<Record<string, string>>(BACKUPS, {});
  const previous = map[project.id];
  const copy: Project = { ...project, id: shortId(), name: `${project.name} (${label}, ${when()})`, modifiedAt: Date.now() };
  await saveProject(copy);
  if (previous) await deleteProject(previous).catch(() => {});
  writePref(BACKUPS, { ...map, [project.id]: copy.id });
  return copy;
}

/** Remember what the story was when a session left it (to spot edits made alone later). */
export const markSynced = (project: Project) => writePref(SYNCED + project.id, fingerprint(project));

/** Was this copy edited since its last session ended (or is there no record of one)? */
export const editedSinceSession = (project: Project) => readPref<string | null>(SYNCED + project.id, null) !== fingerprint(project);
