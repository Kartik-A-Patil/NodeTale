import { Project, ProjectSummary, StoryNode } from '../models/story';
import { getStorageAdapter } from './storage';
import { COVER_SIZE_LIMIT, shrinkCoverImage } from '../utils/coverImage';

// The same oversized cover can be autosaved repeatedly before the project reloads.
// Cache its resized form to avoid decoding and resizing it for each save.
const shrunkCovers = new Map<string, string>();
// Keep writes for one project in invocation order. Cover resizing happens
// before the adapter write and can take long enough for autosaves to overlap;
// without a queue, an older snapshot can overwrite a newer one.
const projectSaveQueues = new Map<string, Promise<void>>();

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

// AI chat apps paste `data-start="12" data-end="40"` onto every tag; it does
// nothing in a story and was ~15% of a typical saved project.
const PASTE_ATTRS = / data-(?:start|end)="\d+"/g;
const whole = (n: number | null | undefined) => (typeof n === 'number' ? Math.round(n) : undefined);

/** A node as it should be stored: whole-pixel geometry, no paste debris. */
const compactNode = (node: StoryNode): StoryNode => {
  const content = (node.data as { content?: unknown }).content;
  const cleaned = typeof content === 'string' && content.includes(' data-start=') ? content.replace(PASTE_ATTRS, '') : content;
  const { width, height, ...rest } = node;
  return {
    ...rest,
    position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
    ...(whole(width) !== undefined ? { width: whole(width) } : {}),
    ...(whole(height) !== undefined ? { height: whole(height) } : {}),
    data: cleaned === content ? node.data : { ...node.data, content: cleaned },
  } as StoryNode;
};

/** Single storage shape for a project, used by every save and every export. */
export const compactProject = (project: Project): Project => ({
  ...project,
  boards: project.boards.map((board) => ({ ...board, nodes: board.nodes.map(compactNode) })),
});

// Wrappers that map 1:1 to StorageAdapter methods

export const saveProject = async (project: Project): Promise<void> => {
  // Single chokepoint for every save path (create, import, example, cover
  // change, autosave), so oversized covers — including ones already stored —
  // get shrunk on their next save.
  const previousSave = projectSaveQueues.get(project.id) ?? Promise.resolve();
  const nextSave = previousSave
    .catch(() => undefined)
    .then(async () => getStorageAdapter().saveProject(await withSmallCover(compactProject(project))));
  projectSaveQueues.set(project.id, nextSave);

  try {
    await nextSave;
  } finally {
    if (projectSaveQueues.get(project.id) === nextSave) {
      projectSaveQueues.delete(project.id);
    }
  }
};

export const loadProject = async (projectIdOrName: string): Promise<Project | null> => {
  return getStorageAdapter().loadProject(projectIdOrName);
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
