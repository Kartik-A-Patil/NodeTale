import { Project, AppNode, Board, Variable, Branch, isConditionNode } from '../../types';
import { executeNode } from '../nodes/nodeRegistry';
import { runScript } from '../runtime/scriptInterpreter';
import { extractScriptCode } from '../runtime/htmlScript';
import { DEFAULT_BRANCHES, branchLabel } from '../branch';

export { branchLabel };

// Story state simulation. `step` applies exactly the runtime's rules (it calls
// the same executeNode / runScript as StoryRuntime), and both the automatic
// analysis and the interactive walkthrough are built on it, so what they show
// is what Play mode would do.

export type Values = Record<string, unknown>;

export interface Transition {
  target: string;
  /** Choice text (the target scene's label, as Play shows it) or the branch taken. */
  label: string;
  kind: 'choice' | 'branch' | 'jump';
}

export interface StepResult {
  /** Variable values after entering the node (its script has run). */
  after: Values;
  /** Names whose value changed on entering. */
  changed: string[];
  error?: string;
  /** Where the story can go next. Condition/jump nodes have at most one (they auto-advance). */
  next: Transition[];
  /** For condition nodes: the branch that was taken, if any. */
  branchTaken?: Branch;
}

export interface Simulator {
  startId: string | null;
  variables: Variable[];
  node: (id: string) => { node: AppNode; board: Board } | undefined;
  initialValues: (overrides?: Values) => Values;
  step: (nodeId: string, values: Values) => StepResult;
}

export const valuesEqual = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function createSimulator(project: Project): Simulator {
  const index = new Map<string, { node: AppNode; board: Board }>();
  for (const board of project.boards) for (const node of board.nodes) if (!index.has(node.id)) index.set(node.id, { node, board });
  const active = project.boards.find((b) => b.id === project.activeBoardId) || project.boards[0];
  const start = active?.nodes.find((n) => n.type !== 'commentNode' && n.data?.label?.toLowerCase() === 'start');
  const variables = project.variables;

  // Extracting a scene's script parses its HTML; do it once per scene, not per visit.
  const scripts = new Map<string, string>();
  const scriptOf = (nodeId: string, html: string) => {
    let code = scripts.get(nodeId);
    if (code === undefined) scripts.set(nodeId, (code = extractScriptCode(html)));
    return code;
  };

  const toVariables = (values: Values): Variable[] => variables.map((v) => ({ ...v, value: (values[v.name] ?? v.value) as Variable['value'] }));

  const step = (nodeId: string, values: Values): StepResult => {
    const ctx = index.get(nodeId);
    if (!ctx) return { after: values, changed: [], next: [], error: 'Scene not found' };
    const { node, board } = ctx;
    const result = executeNode(node, { board, runtimeVars: toVariables(values) });

    let after = values;
    let error: string | undefined;
    if (result.scriptContent !== undefined) {
      const code = scriptOf(nodeId, result.scriptContent);
      if (code) {
        const run = runScript(code, values);
        error = run.error;
        if (Object.keys(run.changes).length) after = { ...values, ...run.changes };
      }
    }
    const changed = variables.map((v) => v.name).filter((n) => !valuesEqual(values[n], after[n]));

    if (node.type === 'elementNode') {
      const next = board.edges
        .filter((e) => e.source === node.id && index.has(e.target))
        .map((e): Transition => ({ target: e.target, label: index.get(e.target)!.node.data?.label || 'Continue', kind: 'choice' }));
      return { after, changed, error, next };
    }
    if (isConditionNode(node)) {
      const edge = result.nextNodeId ? board.edges.find((e) => e.source === node.id && e.target === result.nextNodeId) : undefined;
      const branchTaken = edge ? (node.data.branches || DEFAULT_BRANCHES).find((b) => b.id === edge.sourceHandle) : undefined;
      const next = result.nextNodeId && index.has(result.nextNodeId)
        ? [{ target: result.nextNodeId, label: branchTaken ? branchLabel(branchTaken) : 'Branch', kind: 'branch' as const }]
        : [];
      return { after, changed, error, next, branchTaken };
    }
    const next = result.nextNodeId && index.has(result.nextNodeId)
      ? [{ target: result.nextNodeId, label: `Jump to ${index.get(result.nextNodeId)!.node.data?.label}`, kind: 'jump' as const }]
      : [];
    return { after, changed, error, next };
  };

  return {
    startId: start?.id ?? null,
    variables,
    node: (id) => index.get(id),
    initialValues: (overrides = {}) => Object.fromEntries(variables.map((v) => [v.name, v.name in overrides ? overrides[v.name] : v.value])),
    step,
  };
}

// A condition/jump node is a "logic check" — StoryRuntime skips straight
// through it, the player never sees it. A generous but finite bound: a real
// story won't chain this many in a row, and it also catches loops that
// `visited` alone wouldn't (a cycle through 3+ distinct nodes still
// terminates once `visited` has seen them all, but this is the belt to that
// suspenders in case that reasoning is ever wrong).
const MAX_RESOLVE_HOPS = 64;

/**
 * The scene a player actually lands on after taking this path: starting at
 * `nodeId`, follows the same auto-advance rule StoryRuntime uses to skip
 * condition/jump nodes (evaluating branches with the given values) until an
 * interactive (elementNode) scene, a dead end, or a cycle. Used to label a
 * choice by what it leads to, not by an invisible logic node's own name.
 */
export function resolveVisibleNode(sim: Simulator, nodeId: string, values: Values = sim.initialValues()): AppNode | null {
  let current = sim.node(nodeId)?.node ?? null;
  const visited = new Set<string>();
  let hops = 0;
  while (current && current.type !== 'elementNode') {
    if (visited.has(current.id) || hops++ > MAX_RESOLVE_HOPS) return null;
    visited.add(current.id);
    const result = sim.step(current.id, values);
    values = result.after;
    const nextId = result.next[0]?.target;
    current = nextId ? sim.node(nextId)?.node ?? null : null;
  }
  return current;
}

// ---------- automatic analysis: explore every (scene, state) the story can reach ----------

export interface NodeStates {
  /** Distinct states on arriving here (after the scene's script ran). */
  states: Values[];
  /** More distinct states exist than were kept (see MAX_STATES_PER_NODE). */
  truncated: boolean;
  /** For each kept state, how the story got here: node ids from Start. */
  routes: string[][];
  /** Condition nodes: how many arriving states took each branch id (and 'none'). */
  branchCounts?: Record<string, number>;
  errors: string[];
}

export interface StateAnalysis {
  startId: string | null;
  byNode: Map<string, NodeStates>;
  /** Exploration stopped early (MAX_VISITS); results cover what was explored. */
  incomplete: boolean;
  visits: number;
}

export const MAX_STATES_PER_NODE = 40;
export const MAX_VISITS = 25_000;

const keyOf = (values: Values) => JSON.stringify(values);

export function analyzeStates(project: Project, overrides?: Values): StateAnalysis {
  const sim = createSimulator(project);
  const byNode = new Map<string, NodeStates>();
  const seen = new Set<string>();
  let visits = 0;
  let incomplete = false;

  if (!sim.startId) return { startId: null, byNode, incomplete, visits };

  // BFS over (scene, state). A repeated pair is a loop the story can repeat
  // forever with no new state, so it is explored once.
  const queue: { nodeId: string; values: Values; route: string[] }[] = [
    { nodeId: sim.startId, values: sim.initialValues(overrides), route: [] },
  ];
  for (let head = 0; head < queue.length; head++) {
    if (visits >= MAX_VISITS) {
      incomplete = true;
      break;
    }
    const { nodeId, values, route } = queue[head];
    const visitKey = `${nodeId}|${keyOf(values)}`;
    if (seen.has(visitKey)) continue;
    seen.add(visitKey);
    visits++;

    const result = sim.step(nodeId, values);
    let entry = byNode.get(nodeId);
    if (!entry) byNode.set(nodeId, (entry = { states: [], truncated: false, routes: [], errors: [] }));
    const afterKey = keyOf(result.after);
    if (!entry.states.some((s) => keyOf(s) === afterKey)) {
      if (entry.states.length < MAX_STATES_PER_NODE) {
        entry.states.push(result.after);
        entry.routes.push([...route, nodeId]);
      } else {
        entry.truncated = true;
      }
    }
    if (result.error && !entry.errors.includes(result.error)) entry.errors.push(result.error);
    const node = sim.node(nodeId)?.node;
    if (node && isConditionNode(node)) {
      entry.branchCounts ??= {};
      const id = result.branchTaken?.id ?? 'none';
      entry.branchCounts[id] = (entry.branchCounts[id] ?? 0) + 1;
    }
    // Keep routes short in memory: only the tail is needed to show "how you get here".
    const nextRoute = route.length > 60 ? [...route.slice(-60), nodeId] : [...route, nodeId];
    for (const t of result.next) queue.push({ nodeId: t.target, values: result.after, route: nextRoute });
  }

  return { startId: sim.startId, byNode, incomplete, visits };
}

// ---------- summaries for display ----------

export interface ValueSummary {
  /** Short human description: "5–15", "true or false", "\"sword\" or \"bow\"", "always 3". */
  text: string;
  /** Every state agrees on this value. */
  fixed: boolean;
  distinct: unknown[];
}

/** Compact display of any variable value, including list/object shapes. */
export function formatValue(v: unknown, max = 24): string {
  const clip = (t: string) => (t.length > max ? `${t.slice(0, max - 1)}…` : t);
  if (typeof v === 'string') return `“${clip(v)}”`;
  if (v && typeof v === 'object') {
    if ('elements' in v && Array.isArray((v as { elements: unknown[] }).elements)) {
      return clip(`[${(v as { elements: unknown[] }).elements.map((e) => (typeof e === 'string' ? `“${e}”` : String(e))).join(', ')}]`);
    }
    if ('keys' in v) {
      const keys = (v as { keys: Record<string, { value: unknown }> }).keys;
      return clip(`{${Object.entries(keys).map(([k, e]) => `${k}: ${typeof e.value === 'string' ? `“${e.value}”` : String(e.value)}`).join(', ')}}`);
    }
    return clip(JSON.stringify(v));
  }
  return String(v);
}

const show = (v: unknown): string => formatValue(v, 18);

export function summarizeValues(values: unknown[], truncated = false): ValueSummary {
  const distinct: unknown[] = [];
  for (const v of values) if (!distinct.some((d) => valuesEqual(d, v))) distinct.push(v);
  const more = truncated ? ' (or more)' : '';
  if (distinct.length === 0) return { text: '—', fixed: false, distinct };
  if (distinct.length === 1) return { text: `${show(distinct[0])}${more}`, fixed: !truncated, distinct };
  if (distinct.every((d) => typeof d === 'number')) {
    const nums = distinct as number[];
    const min = Math.min(...nums), max = Math.max(...nums);
    return { text: distinct.length > 3 ? `${min} – ${max}${more}` : `${nums.sort((a, b) => a - b).join(', ')}${more}`, fixed: false, distinct };
  }
  if (distinct.length <= 3) return { text: `${distinct.map(show).join(' or ')}${more}`, fixed: false, distinct };
  return { text: `${distinct.length} different values${more}`, fixed: false, distinct };
}
