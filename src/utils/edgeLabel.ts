import { Branch } from '../models/story';
import { DEFAULT_BRANCHES, branchLabel } from '../core/branch';

// The minimal shape needed from an edge's endpoints — not full ReactFlow
// StoryNode — so this works equally from the canvas (FloatingEdge, which
// only has trimmed geometry) and from the edge context menu (which has the
// full node). One source of truth for what an edge's label defaults to.
export interface AutoLabelSource {
  type?: string;
  branches?: Branch[];
}
export interface AutoLabelTarget {
  label?: string;
}

/**
 * The label an edge shows when it isn't a custom one: for a branch out of a
 * condition node, the branch's own text ("If health > 0", "Else"); otherwise
 * the target scene's title, matching what the edge actually leads to.
 */
export function autoEdgeLabel(
  source: AutoLabelSource | null | undefined,
  target: AutoLabelTarget | null | undefined,
  sourceHandleId?: string | null
): string {
  if (source?.type === 'conditionNode') {
    const branch = (source.branches || DEFAULT_BRANCHES).find((b) => b.id === sourceHandleId);
    if (branch) return branchLabel(branch);
  }
  return target?.label || 'Untitled';
}

/** The author's custom label for an edge, or null when it uses the auto label
 *  (same rule FloatingEdge uses, so Play Mode shows exactly what the canvas shows). */
export function manualEdgeLabel(edge: { label?: string; data?: Record<string, unknown> }): string | null {
  return edge.data?.manualLabel && typeof edge.label === 'string' && edge.label.trim() ? edge.label : null;
}
