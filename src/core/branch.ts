import { Branch } from '../models/story';

// A condition node with no branches yet behaves like a fresh If/Else — this
// mirrors what the node itself falls back to when rendering (ConditionNode)
// and running (StoryRuntime), so every reader of `branches` agrees on it.
export const DEFAULT_BRANCHES: Branch[] = [
  { id: 'true', label: 'If', condition: 'true' },
  { id: 'false', label: 'Else', condition: '' },
];

/** Display text for a branch: "If health > 0", or bare "Else" with no condition. */
export const branchLabel = (b: Branch): string => (b.label === 'Else' || !b.condition ? b.label : `${b.label} ${b.condition}`);
