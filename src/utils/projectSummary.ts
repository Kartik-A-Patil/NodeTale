// Builds the dashboard's lightweight ProjectSummary from a full project. Shared
// by the web storage adapter and the Electron main process, so it must stay
// pure (no DOM, no React) and cheap: it runs on every save.
//
// Types are structural (not imported from ../types) so the Electron main
// bundle doesn't pull in renderer-side modules.

interface SummaryNode {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  data?: { label?: string };
}
interface SummaryEdge {
  source: string;
  target: string;
}
interface SummaryBoard {
  id: string;
  name: string;
  nodes: SummaryNode[];
  edges: SummaryEdge[];
}
export interface SummarySource {
  id: string;
  name: string;
  modifiedAt?: number;
  coverImage?: string;
  activeBoardId?: string;
  boards?: SummaryBoard[];
  assets?: unknown[];
}

/** Node kinds in a thumbnail: 0 scene, 1 branch, 2 jump, 3 start. */
export type ThumbnailKind = 0 | 1 | 2 | 3;

export interface ProjectThumbnail {
  /** [x, y, kind], x/y normalized to 0..1 within the board's bounding box. */
  n: [number, number, ThumbnailKind][];
  /** Edges as index pairs into `n`. */
  e: [number, number][];
  /** Width / height of the board's bounding box, so it can be drawn undistorted. */
  aspect: number;
}

export interface ProjectStats {
  scenes: number;
  endings: number;
  boardNames: string[];
}

export interface ProjectSummaryData {
  id: string;
  name: string;
  modifiedAt?: number;
  coverImage?: string;
  boardCount: number;
  assetCount: number;
  stats?: ProjectStats;
  thumbnail?: ProjectThumbnail;
}

const FLOW_TYPES = new Set(['elementNode', 'conditionNode', 'jumpNode']);
const THUMBNAIL_MAX_NODES = 150;
const round = (v: number) => Math.round(v * 1000) / 1000;

function buildThumbnail(board: SummaryBoard | undefined): ProjectThumbnail | undefined {
  const nodes = (board?.nodes || []).filter((n) => FLOW_TYPES.has(n.type || '') && n.position);
  if (nodes.length === 0) return undefined;
  // Even stride keeps the overall shape of big boards.
  const stride = Math.max(1, Math.ceil(nodes.length / THUMBNAIL_MAX_NODES));
  const kept = nodes.filter((_, i) => i % stride === 0);
  const xs = kept.map((n) => n.position!.x);
  const ys = kept.map((n) => n.position!.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const index = new Map(kept.map((n, i) => [n.id, i]));
  return {
    n: kept.map((n) => [
      round((n.position!.x - minX) / w),
      round((n.position!.y - minY) / h),
      n.data?.label?.toLowerCase() === 'start' ? 3 : n.type === 'conditionNode' ? 1 : n.type === 'jumpNode' ? 2 : 0,
    ]),
    e: (board?.edges || [])
      .filter((e) => index.has(e.source) && index.has(e.target))
      .map((e) => [index.get(e.source)!, index.get(e.target)!]),
    aspect: round(Math.min(4, Math.max(0.25, (maxX - minX + 250) / (maxY - minY + 150)))),
  };
}

export function buildProjectSummary(project: SummarySource): ProjectSummaryData {
  const boards = Array.isArray(project.boards) ? project.boards : [];
  let scenes = 0;
  let endings = 0;
  for (const board of boards) {
    const withChoices = new Set(board.edges.map((e) => e.source));
    for (const node of board.nodes) {
      if (!FLOW_TYPES.has(node.type || '')) continue;
      scenes++;
      if (node.type === 'elementNode' && !withChoices.has(node.id)) endings++;
    }
  }
  const active = boards.find((b) => b.id === project.activeBoardId) || boards[0];
  return {
    id: project.id,
    name: project.name,
    modifiedAt: project.modifiedAt,
    coverImage: project.coverImage,
    boardCount: boards.length,
    assetCount: Array.isArray(project.assets) ? project.assets.length : 0,
    stats: { scenes, endings, boardNames: boards.map((b) => b.name) },
    thumbnail: buildThumbnail(active),
  };
}
