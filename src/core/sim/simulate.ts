import { Project, StoryNode, Board, Variable, Branch, isConditionNode } from '../../models/story';
import { executeNode } from '../nodes/nodeRegistry';
import { runScript, evaluateCondition, firstOutcomeRng, Rng } from '../runtime/scriptInterpreter';
import { extractScriptCode } from '../runtime/htmlScript';
import { DEFAULT_BRANCHES, branchLabel } from '../branch';
import { manualEdgeLabel, choiceRulesOf } from '../../utils/edgeLabel';

export type { ChoiceRules } from '../../utils/edgeLabel';

export { branchLabel };

// The story engine. `step` (enter a node) and `follow` (take a choice) are the
// only rules there are: Play Mode (StoryRuntime), the automatic analysis and
// the interactive walkthrough all run on them, so what they show is what Play
// mode does.

export type Values = Record<string, unknown>;

export interface Transition {
  target: string;
  /** Choice text (custom edge label, else the target scene's label) or the branch taken. */
  label: string;
  kind: 'choice' | 'branch' | 'jump';
  /** Choices: the connection this is. */
  edgeId?: string;
  /** Choices: `label` is the author's own text, not derived from the target. */
  customLabel?: boolean;
  /** Choices whose condition doesn't hold right now: they can't be taken. */
  locked?: boolean;
  /** Locked, and the author asked to hide it rather than show it greyed out. */
  hidden?: boolean;
  lockedReason?: string;
  /** Script that runs when this choice is taken. */
  effect?: string;
}

export interface StepResult {
  /** Variable values after entering the node (its script has run). */
  after: Values;
  /** Names whose value changed on entering. */
  changed: string[];
  /** Every problem met on entering, in order; `error` is them joined. */
  errors: string[];
  error?: string;
  /** Where the story can go next. Condition/jump nodes have at most one (they auto-advance). */
  next: Transition[];
  /** For condition nodes: the branch that was taken, if any. */
  branchTaken?: Branch;
}

export interface Simulator {
  startId: string | null;
  variables: Variable[];
  node: (id: string) => { node: StoryNode; board: Board } | undefined;
  initialValues: (overrides?: Values) => Values;
  toVariables: (values: Values) => Variable[];
  /** Enter a node. Without an rng, chance()/random() take their first outcome. */
  step: (nodeId: string, values: Values, rng?: Rng) => StepResult;
  /** Take a transition: runs a choice's effect. The values to enter `t.target` with. */
  follow: (t: Transition, values: Values, rng?: Rng) => { values: Values; error?: string };
}

export const valuesEqual = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function createSimulator(project: Project): Simulator {
  const index = new Map<string, { node: StoryNode; board: Board }>();
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

  // A scene's choices. Conditions get no rng: a choice must not flicker
  // between locked and open each time it is looked at.
  const choicesOf = (node: StoryNode, board: Board, values: Values, errors: string[]): Transition[] =>
    board.edges
      .filter((e) => e.source === node.id && index.has(e.target))
      .map((e): Transition => {
        const rules = choiceRulesOf(e);
        const open = evaluateCondition(rules.condition, values, { onError: (m) => errors.push(m) });
        const custom = manualEdgeLabel(e);
        return {
          target: e.target,
          label: custom || index.get(e.target)!.node.data?.label || 'Continue',
          kind: 'choice',
          edgeId: e.id,
          customLabel: !!custom,
          effect: rules.effect?.trim() || undefined,
          ...(open ? {} : {
            locked: true,
            hidden: !!rules.hideWhenLocked,
            lockedReason: rules.lockedText?.trim() || `Needs ${rules.condition!.trim()}`,
          }),
        };
      });

  const step = (nodeId: string, values: Values, rng: Rng = firstOutcomeRng): StepResult => {
    const ctx = index.get(nodeId);
    if (!ctx) return { after: values, changed: [], errors: ['Scene not found'], error: 'Scene not found', next: [] };
    const { node, board } = ctx;
    const errors: string[] = [];
    const result = executeNode(node, { board, values, rng, onError: (m) => errors.push(m) });

    let after = values;
    if (result.scriptContent !== undefined) {
      const code = scriptOf(nodeId, result.scriptContent);
      if (code) {
        const run = runScript(code, values, rng);
        if (run.error) errors.push(run.error);
        if (Object.keys(run.changes).length) after = { ...values, ...run.changes };
      }
    }
    const changed = variables.map((v) => v.name).filter((n) => !valuesEqual(values[n], after[n]));
    const done = (next: Transition[], branchTaken?: Branch): StepResult =>
      ({ after, changed, errors, error: errors.length ? errors.join('; ') : undefined, next, branchTaken });

    if (node.type === 'elementNode') return done(choicesOf(node, board, after, errors));
    if (isConditionNode(node)) {
      const edge = result.nextNodeId ? board.edges.find((e) => e.source === node.id && e.target === result.nextNodeId) : undefined;
      const branchTaken = edge ? (node.data.branches || DEFAULT_BRANCHES).find((b) => b.id === edge.sourceHandle) : undefined;
      const next = result.nextNodeId && index.has(result.nextNodeId)
        ? [{ target: result.nextNodeId, label: branchTaken ? branchLabel(branchTaken) : 'Branch', kind: 'branch' as const }]
        : [];
      return done(next, branchTaken);
    }
    const next = result.nextNodeId && index.has(result.nextNodeId)
      ? [{ target: result.nextNodeId, label: `Jump to ${index.get(result.nextNodeId)!.node.data?.label}`, kind: 'jump' as const }]
      : [];
    return done(next);
  };

  const follow = (t: Transition, values: Values, rng: Rng = firstOutcomeRng) => {
    if (!t.effect) return { values };
    const run = runScript(t.effect, values, rng);
    const after = Object.keys(run.changes).length ? { ...values, ...run.changes } : values;
    return run.error ? { values: after, error: `Choice "${t.label}": ${run.error}` } : { values: after };
  };

  return {
    startId: start?.id ?? null,
    variables,
    node: (id) => index.get(id),
    initialValues: (overrides = {}) => Object.fromEntries(variables.map((v) => [v.name, v.name in overrides ? overrides[v.name] : v.value])),
    toVariables,
    step,
    follow,
  };
}

// ---------- luck: exploring every outcome of chance()/random() ----------

/** Most outcomes explored for one step (dice in dice in dice multiply fast). */
export const MAX_OUTCOMES = 16;

// Small ranges are explored value by value (a d6 is six outcomes); larger
// ones by their low end, middle and high end.
const spread = (lo: number, hi: number): number[] =>
  hi - lo < 6 ? Array.from({ length: hi - lo + 1 }, (_, i) => lo + i) : [lo, Math.round((lo + hi) / 2), hi];

/**
 * Runs `run` once per combination of luck it can meet: each chance() as both
 * true and false, each random() over its spread. Replays from the start with a
 * forced prefix of picks, so `run` needs no knowledge of this.
 */
export function enumerateOutcomes<T>(run: (rng: Rng) => T, limit = MAX_OUTCOMES): T[] {
  const results: T[] = [];
  const pending: number[][] = [[]];
  while (pending.length && results.length < limit) {
    const forced = pending.pop()!;
    const picks: number[] = [];
    const pick = <V>(options: V[]): V => {
      const i = picks.length;
      if (i >= forced.length) for (let alt = options.length - 1; alt > 0; alt--) pending.push([...picks, alt]);
      const k = i < forced.length ? forced[i] : 0;
      picks.push(k);
      return options[k];
    };
    results.push(run({ int: (lo, hi) => pick(spread(lo, hi)), chance: () => pick([true, false]) }));
  }
  return results;
}

/** Every way entering `t.target` through `t` can turn out: effect outcomes x step outcomes. */
export function stepOutcomes(sim: Simulator, t: Transition, values: Values): { before: Values; result: StepResult }[] {
  return enumerateOutcomes((rng) => {
    const before = sim.follow(t, values, rng).values;
    return { before, result: sim.step(t.target, before, rng) };
  });
}

// A condition/jump node is a "logic check" — StoryRuntime skips straight
// through it, the player never sees it. A generous but finite bound: a real
// story won't chain this many in a row, and it also catches loops that
// `visited` alone wouldn't.
const MAX_RESOLVE_HOPS = 64;

/**
 * The scene a player actually lands on after taking this path: starting at
 * `nodeId`, follows the same auto-advance rule StoryRuntime uses to skip
 * condition/jump nodes (evaluating branches with the given values) until an
 * interactive (elementNode) scene, a dead end, or a cycle. Used to label a
 * choice by what it leads to, not by an invisible logic node's own name.
 */
export function resolveVisibleNode(sim: Simulator, nodeId: string, values: Values = sim.initialValues()): StoryNode | null {
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
  const expanded = new Set<string>();
  let visits = 0;
  let incomplete = false;

  if (!sim.startId) return { startId: null, byNode, incomplete, visits };

  // BFS over (scene, state). A repeated pair is a loop the story can repeat
  // forever with no new state, so it is explored once. Luck fans out: every
  // outcome of a chance()/random() is its own queue entry.
  const initial = sim.initialValues(overrides);
  const queue: { nodeId: string; values: Values; result: StepResult; route: string[] }[] =
    enumerateOutcomes((rng) => sim.step(sim.startId!, initial, rng)).map((result) => ({ nodeId: sim.startId!, values: initial, result, route: [] }));
  for (let head = 0; head < queue.length; head++) {
    if (visits >= MAX_VISITS) {
      incomplete = true;
      break;
    }
    const { nodeId, values, result, route } = queue[head];
    const visitKey = `${nodeId}|${keyOf(values)}|${keyOf(result.after)}`;
    if (seen.has(visitKey)) continue;
    seen.add(visitKey);
    visits++;

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
    for (const e of result.errors) if (!entry.errors.includes(e)) entry.errors.push(e);
    const node = sim.node(nodeId)?.node;
    if (node && isConditionNode(node)) {
      entry.branchCounts ??= {};
      const id = result.branchTaken?.id ?? 'none';
      entry.branchCounts[id] = (entry.branchCounts[id] ?? 0) + 1;
    }
    // Keep routes short in memory: only the tail is needed to show "how you get here".
    const nextRoute = route.length > 60 ? [...route.slice(-60), nodeId] : [...route, nodeId];
    for (const t of result.next) {
      if (t.locked) continue;
      // Taking the same way from the same state always fans out the same way.
      const wayKey = `${t.target}|${t.effect ?? ''}|${afterKey}`;
      if (expanded.has(wayKey)) continue;
      expanded.add(wayKey);
      for (const o of stepOutcomes(sim, t, result.after)) {
        queue.push({ nodeId: t.target, values: o.before, result: o.result, route: nextRoute });
      }
    }
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
