import { Project, ProjectSummary } from '../types';
import { getStorageAdapter } from './storage';
import { COVER_SIZE_LIMIT, shrinkCoverImage } from '../utils/coverImage';

// Big cover -> shrunk cover. The editor keeps the project it loaded in state, so
// an old oversized cover arrives here again on every autosave until reload;
// this makes the repeat cost a Map lookup instead of a re-decode.
// ponytail: unbounded, but holds at most one entry per oversized cover seen this session.
const shrunkCovers = new Map<string, string>();

const withSmallCover = async (project: Project): Promise<Project> => {
  const cover = project.coverImage;
  if (!cover || cover.length <= COVER_SIZE_LIMIT || !cover.startsWith('data:image/')) return project;
  let small = shrunkCovers.get(cover);
  if (!small) {
    small = await shrinkCoverImage(cover);
    shrunkCovers.set(cover, small);
  }
  return { ...project, coverImage: small };
};

// Wrappers that map 1:1 to StorageAdapter methods

export const saveProject = async (project: Project): Promise<void> => {
  // Single chokepoint for every save path (create, import, example, cover
  // change, autosave), so oversized covers — including ones already stored —
  // get shrunk on their next save.
  return getStorageAdapter().saveProject(await withSmallCover(project));
};

export const loadProject = async (projectIdOrName: string): Promise<Project | null> => {
  return getStorageAdapter().loadProject(projectIdOrName);
};

export const getAllProjects = async (): Promise<Project[]> => {
  return getStorageAdapter().getAllProjects();
};

export const getProjectSummaries = async (): Promise<ProjectSummary[]> => {
  return getStorageAdapter().getProjectSummaries();
};

export const deleteProject = async (projectId: string): Promise<void> => {
  return getStorageAdapter().deleteProject(projectId);
};

export const checkProjectNameExists = async (name: string): Promise<boolean> => {
  // Summaries are enough for a name check — no need to load every full project.
  const summaries = await getStorageAdapter().getProjectSummaries();
  return summaries.some(p => p.name === name);
};
