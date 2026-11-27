import { Branch, Project, isConditionNode } from '../../models/story';
import { StoryGraph } from '../graph/storyGraph';
import { StateAnalysis, branchLabel } from './simulate';

// Problems the simulation can see and the static graph can't: branches that
// no reachable combination of values ever takes, conditions where nothing
// matches, scenes that are connected but never reached with any values, and
// scripts that fail when they actually run.

export type ProblemKind = 'no-branch' | 'script-error' | 'branch-never' | 'unreached';

export interface Problem {
  kind: ProblemKind;
  severity: 'error' | 'warning';
  nodeId: string;
  title: string;
  detail: string;
}

const DEFAULT_BRANCHES: Branch[] = [
  { id: 'true', label: 'If', condition: 'true' },
  { id: 'false', label: 'Else', condition: '' },
];

const ORDER: Record<ProblemKind, number> = { 'no-branch': 0, 'script-error': 1, 'branch-never': 2, unreached: 3 };

export function findProblems(project: Project, graph: StoryGraph, analysis: StateAnalysis): Problem[] {
  const problems: Problem[] = [];
  const label = (id: string) => graph.nodes.get(id)?.label ?? 'Scene';

  for (const board of project.boards) {
    for (const node of board.nodes) {
      const entry = analysis.byNode.get(node.id);
      if (!entry) continue;

      for (const error of entry.errors) {
        problems.push({
          kind: 'script-error', severity: 'error', nodeId: node.id,
          title: `Script fails in “${label(node.id)}”`,
          detail: error,
        });
      }

      if (!isConditionNode(node) || !entry.branchCounts) continue;
      const counts = entry.branchCounts;
      if ((counts.none ?? 0) > 0) {
        problems.push({
          kind: 'no-branch', severity: 'error', nodeId: node.id,
          title: `No branch matches in “${label(node.id)}”`,
          detail: `${counts.none} of the states that reach it match no branch, so the story stops there. Add an Else branch or widen a condition.`,
        });
      }
      const branches = node.data.branches || DEFAULT_BRANCHES;
      const taken = branches.filter((b) => (counts[b.id] ?? 0) > 0);
      for (const b of branches) {
        if ((counts[b.id] ?? 0) > 0) continue;
        const onlyOther = taken.length === 1 ? taken[0] : null;
        problems.push({
          kind: 'branch-never', severity: 'warning', nodeId: node.id,
          title: `“${branchLabel(b)}” is never taken in “${label(node.id)}”`,
          detail: onlyOther
            ? `Every time the story gets here, “${branchLabel(onlyOther)}” matches first, so this branch and whatever follows it can’t be reached.`
            : 'No combination of values that reaches this scene takes this branch.',
        });
      }
    }
  }

  // Connected from Start in the graph, but the simulation never arrives.
  if (!analysis.incomplete) {
    for (const id of graph.order) {
      if (analysis.byNode.has(id)) continue;
      problems.push({
        kind: 'unreached', severity: 'warning', nodeId: id,
        title: `“${label(id)}” is never reached`,
        detail: 'It is connected to Start, but every route to it goes through a branch that these values never take.',
      });
    }
  }

  return problems.sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
}
