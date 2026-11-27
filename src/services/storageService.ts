import { Project, ProjectSummary, StoryNode, StoryEdge, DEFAULT_Z_INDEX, DEFAULT_EDGE_STROKE } from '../models/story';
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
const whole = (n: unknown) => (typeof n === 'number' ? Math.round(n) : undefined);
const isEmpty = (v: unknown) =>
  v === undefined || v === null || v === '' || v === false ||
  (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 0);
const withoutEmpty = <T extends object>(o: T, keep: string[] = []): T =>
  Object.fromEntries(Object.entries(o).filter(([k, v]) => keep.includes(k) || !isEmpty(v))) as T;

/** A node as it should be stored: whole-pixel geometry, no copies, no defaults, no paste debris. */
const compactNode = (node: StoryNode): StoryNode => {
  const { id, type, parentNode, extent } = node;
  const data = { ...node.data } as Record<string, unknown>;
  if (typeof data.content === 'string' && data.content.includes(' data-start=')) data.content = data.content.replace(PASTE_ATTRS, '');
  // Audio settings for assets no longer on the scene.
  if (data.audioSettings && typeof data.audioSettings === 'object') {
    const assets = new Set(Array.isArray(data.assets) ? data.assets : []);
    data.audioSettings = Object.fromEntries(Object.entries(data.audioSettings).filter(([assetId]) => assets.has(assetId)));
  }
  const width = whole(node.width);
  const height = whole(node.height);
  const zIndex = node.zIndex === DEFAULT_Z_INDEX[type] ? undefined : node.zIndex;
  // The editor mirrors width/height/zIndex into style on load; only differences are worth keeping.
  const style = withoutEmpty(Object.fromEntries(Object.entries(node.style ?? {}).filter(([k, v]) =>
    !((k === 'width' && whole(v) === width) || (k === 'height' && whole(v) === height) || (k === 'zIndex' && (v === node.zIndex || v === DEFAULT_Z_INDEX[type]))))));
  return withoutEmpty({
    id, type,
    position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
    // label/content are always present, and an emptied branch list must stay
    // empty (missing means "use the default If/Else"); the rest only when set.
    data: withoutEmpty(data, ['label', 'content', 'branches']),
    parentNode, extent, width, height, zIndex, style,
  }, ['data']) as unknown as StoryNode;
};

/** An edge as it should be stored: only what the author changed (see toCanvasEdge for the defaults). */
const compactEdge = (edge: StoryEdge, sourceType: string | undefined): StoryEdge => {
  const data = withoutEmpty({ ...edge.data }) as Record<string, unknown>;
  delete data.autoResolvedLabel;
  if (data.pathType === 'bezier') delete data.pathType;
  const custom = (data.manualLabel || data.labelEnabled) && edge.label?.trim();
  const ownStyle = edge.style && !(Object.keys(edge.style).length === 1 && edge.style.stroke === DEFAULT_EDGE_STROKE);
  return withoutEmpty({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    // Only a condition's branches route by handle; other edges float.
    sourceHandle: sourceType === 'conditionNode' ? edge.sourceHandle : undefined,
    type: edge.type === 'floating' ? undefined : edge.type,
    label: custom ? edge.label : undefined,
    style: ownStyle ? edge.style : undefined,
    data: withoutEmpty(data),
  });
};

/** Single storage shape for a project, used by every save and every export. */
export const compactProject = (project: Project): Project => ({
  ...project,
  // Blob URLs die with the page; assets are read from storage by id.
  assets: project.assets.map((a) => (a.url.startsWith('blob:') ? { ...a, url: '' } : a)),
  boards: project.boards.map((board) => {
    const types = new Map(board.nodes.map((n) => [n.id, n.type]));
    return { ...board, nodes: board.nodes.map(compactNode), edges: board.edges.map((e) => compactEdge(e, types.get(e.source))) };
  }),
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
