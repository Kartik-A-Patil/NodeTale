import { Project, Variable, StoryNode, Asset, ValueChange, isStartNode, isSetNode } from '../../models/story';
import { questionsOf, valueTypeOf } from '../valueChanges';
import { createSimulator, resolveVisibleNode, valuesEqual, Simulator, Transition, Values } from '../sim/simulate';
import { mathRng, Rng, TraceLine } from './scriptInterpreter';

interface HistoryItem {
  nodeId: string;
  values: Values;
  /** The scene's choices as they were, so Back doesn't re-run its script. */
  choices: Transition[];
  /** What the player picked here. */
  choice?: string;
}

/** One scene in the story log. `index` is what rewindTo takes; -1 is now. */
export interface LogEntry {
  index: number;
  nodeId: string;
  label: string;
  choice?: string;
}

/** Everything needed to resume a playthrough later. Plain data, JSON-safe. */
export interface PlaySnapshot {
  nodeId: string;
  values: Values;
  history: HistoryItem[];
  choices: Transition[];
  taken: string[];
  startId: string | null;
}

export interface PlayError {
  nodeId: string;
  nodeLabel: string;
  message: string;
}

/** A question a "Set values" node asks the player. */
export interface PlayQuestion {
  /** Change id: the key for this answer. */
  id: string;
  question: string;
  variable: string;
  /** What to type: the variable's type (a list's item type for lists). */
  type: 'number' | 'string' | 'boolean';
}

/** A variable that changed because of the player's last choice. */
export interface VarChange {
  name: string;
  before: unknown;
  after: unknown;
}

export interface RuntimeState {
  currentNode: StoryNode | undefined;
  runtimeVars: Variable[];
  /** Variable values by name, for text interpolation. */
  values: Values;
  canGoBack: boolean;
  projectAssets: Asset[];
  errors: PlayError[];
  /** What the last choice changed (empty after Back/Restart). */
  changes: VarChange[];
  /** Counts choices taken, so the same change twice in a row is still news. */
  turn: number;
  /** What the engine did since the last choice (its effect, scripts, branches, jumps). */
  trace: TraceLine[];
  /** Set while the story waits for the player to answer these. */
  asking: PlayQuestion[] | null;
}

export interface StoryOption {
  label: string;
  targetId: string;
  edgeId: string;
  locked?: boolean;
  lockedReason?: string;
  /** Taken before in this playthrough. */
  visited?: boolean;
  /** Taken automatically after this many seconds. */
  timeout?: number;
}

const MAX_ERRORS = 20;

// Story playback: a thin stateful walk over the shared engine (core/sim/simulate),
// so Play Mode and every analysis view follow the exact same rules. No React;
// usePlayMode.ts re-renders on getState(). Snapshots `project` at construction.
export class StoryRuntime {
  private project: Project;
  private sim: Simulator;
  private rng: Rng;
  private currentNodeId: string | null = null;
  private initialStartNodeId: string | null = null;
  private history: HistoryItem[] = [];
  private values: Values;
  private choices: Transition[] = [];
  private errors: PlayError[] = [];
  private taken = new Set<string>();
  private changes: VarChange[] = [];
  private turn = 0;
  private trace: TraceLine[] = [];
  /** The "Set values" node waiting for answers, if any. */
  private awaiting: string | null = null;
  /** Starting values the current playthrough began with (debugger presets). */
  private overrides: Values = {};

  constructor(project: Project, startNodeId?: string | null, rng: Rng = mathRng) {
    this.project = project;
    this.sim = createSimulator(project);
    this.rng = rng;
    this.values = this.sim.initialValues();
    this.start(startNodeId);
  }

  private reportError(nodeId: string, message: string) {
    const label = this.sim.node(nodeId)?.node.data?.label || 'Untitled';
    console.warn(`[PlayMode] ${label}: ${message}`);
    this.errors = [...this.errors, { nodeId, nodeLabel: label, message }].slice(-MAX_ERRORS);
  }

  // Runs nodes, auto-advancing through condition/jump nodes, until landing on
  // a scene or a dead end. The visited set stops a loop of logic nodes from
  // hanging the thread.
  // A node the player stops at: a scene, or a "Set values" node with questions.
  private questionsAt(nodeId: string) {
    const node = this.sim.node(nodeId)?.node;
    return node && isSetNode(node) ? questionsOf(node.data.changes, this.sim.variables) : [];
  }
  private isStop(nodeId: string) {
    return this.sim.node(nodeId)?.node.type === 'elementNode' || this.questionsAt(nodeId).length > 0;
  }

  private enterNode(nodeId: string, trace: TraceLine[] = [], answered?: { nodeId: string; answers: Record<string, unknown> }) {
    this.trace = trace;
    this.awaiting = null;
    const visited = new Set<string>();
    let id: string | undefined = nodeId;

    while (id) {
      this.currentNodeId = id;
      if (visited.has(id)) {
        this.reportError(id, 'Logic loops back on itself without reaching a scene; stopped here.');
        this.choices = [];
        return;
      }
      visited.add(id);

      const node = this.sim.node(id)?.node;
      if (!node) {
        this.choices = [];
        return;
      }
      const isAnswered = answered?.nodeId === id;
      // A node with questions waits for answer(); nothing in it runs yet.
      if (!isAnswered && this.questionsAt(id).length) {
        this.awaiting = id;
        this.choices = [];
        return;
      }
      const result = this.sim.step(id, this.values, this.rng, trace, isAnswered ? answered.answers : undefined);
      result.errors.forEach((m) => this.reportError(node.id, m));
      this.values = result.after;

      if (node.type === 'elementNode') {
        this.choices = result.next;
        return;
      }
      const next: Transition | undefined = result.next[0];
      if (!next) {
        if (node.type === 'conditionNode') this.reportError(node.id, 'No branch matched and there is no connected Else; the story ends here.');
        else if (node.type === 'jumpNode') this.reportError(node.id, 'Jump has no target; the story ends here.');
        this.choices = [];
        return;
      }
      // The answered node's history entry (values before answering) is added by answer().
      if (!isAnswered) this.history.push({ nodeId: node.id, values: this.values, choices: [] });
      if (next.kind === 'jump') trace.push({ nodeId: node.id, source: 'jump', text: next.label, note: 'followed' });
      id = next.target;
    }
  }

  start(startNodeId?: string | null) {
    const board =
      this.project.boards.find((b) => b.id === this.project.activeBoardId) || this.project.boards[0];
    if (!board || board.nodes.length === 0) return;

    const startNode = startNodeId
      ? board.nodes.find((n) => n.id === startNodeId)
      : board.nodes.find(isStartNode);
    if (!startNode) return;

    this.initialStartNodeId = startNode.id;
    this.history = [];
    this.enterNode(startNode.id);
  }

  /** Take a choice by its connection id. Locked or unknown choices do nothing. */
  choose(edgeId: string) {
    const choice = this.choices.find((c) => c.edgeId === edgeId);
    if (!choice || choice.locked || !this.currentNodeId) return;
    this.history.push({ nodeId: this.currentNodeId, values: this.values, choices: this.choices, choice: this.labelOf(choice) });
    const before = this.values;
    const trace: TraceLine[] = [];
    const { values, error } = this.sim.follow(choice, this.values, this.rng, trace);
    trace.forEach((t) => { t.nodeId = this.currentNodeId!; });
    if (error) this.reportError(this.currentNodeId, error);
    this.values = values;
    this.enterNode(choice.target, trace);
    this.taken.add(edgeId);
    this.turn++;
    this.changes = this.sim.variables
      .filter((v) => !valuesEqual(before[v.name], this.values[v.name]))
      .map((v) => ({ name: v.name, before: before[v.name], after: this.values[v.name] }));
  }

  /** Answer the questions of the "Set values" node the story is waiting at, and go on. */
  answer(answers: Record<string, unknown>) {
    const nodeId = this.awaiting;
    if (!nodeId) return;
    const node = this.sim.node(nodeId)!.node;
    const changes = isSetNode(node) ? node.data.changes ?? [] : [];
    const summary = changes
      .filter((c: ValueChange) => c.ask !== undefined && c.id in answers)
      .map((c: ValueChange) => `${c.variable}: ${answers[c.id]}`)
      .join(', ');
    this.history.push({ nodeId, values: this.values, choices: [], choice: summary || undefined });
    const before = this.values;
    this.enterNode(nodeId, [], { nodeId, answers });
    this.turn++;
    this.changes = this.sim.variables
      .filter((v) => !valuesEqual(before[v.name], this.values[v.name]))
      .map((v) => ({ name: v.name, before: before[v.name], after: this.values[v.name] }));
  }

  /** Step back to the last scene the player saw (logic nodes are skipped). */
  back() {
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (i === 0 || this.isStop(this.history[i].nodeId)) return this.rewindTo(i);
    }
  }

  /** Return to a scene from the log, as it was then. Its script doesn't re-run. */
  rewindTo(index: number) {
    const item = this.history[index];
    if (!item) return;
    this.history = this.history.slice(0, index);
    this.currentNodeId = item.nodeId;
    this.values = item.values;
    this.choices = item.choices;
    this.changes = [];
    this.trace = [];
    this.awaiting = this.questionsAt(item.nodeId).length ? item.nodeId : null;
  }

  /** Debugger: change a variable mid-play. The scene's choices are re-checked
   *  against it; nothing re-runs. */
  setValue(name: string, value: unknown) {
    if (!this.currentNodeId || !(name in this.values)) return;
    this.values = { ...this.values, [name]: value };
    this.choices = this.sim.choices(this.currentNodeId, this.values);
  }

  getLog(): LogEntry[] {
    const label = (id: string) => this.sim.node(id)?.node.data?.label || 'Untitled';
    const past = this.history
      .map((h, index) => ({ index, nodeId: h.nodeId, label: label(h.nodeId), choice: h.choice }))
      .filter((e) => this.isStop(e.nodeId));
    return this.currentNodeId ? [...past, { index: -1, nodeId: this.currentNodeId, label: label(this.currentNodeId) }] : past;
  }

  snapshot(): PlaySnapshot | null {
    if (!this.currentNodeId) return null;
    return { nodeId: this.currentNodeId, values: this.values, history: this.history, choices: this.choices, taken: [...this.taken], startId: this.initialStartNodeId };
  }

  /** Resume a saved playthrough. False (and nothing changes) if the story no
   *  longer has a scene the save depends on. */
  restore(s: PlaySnapshot): boolean {
    const ids = [s.nodeId, ...s.history.map((h) => h.nodeId)];
    if (!ids.every((id) => this.sim.node(id))) return false;
    this.currentNodeId = s.nodeId;
    this.values = s.values;
    this.history = s.history;
    this.choices = s.choices;
    this.taken = new Set(s.taken);
    this.changes = [];
    this.awaiting = s.choices.length === 0 && this.questionsAt(s.nodeId).length ? s.nodeId : null;
    if (s.startId && this.sim.node(s.startId)) this.initialStartNodeId = s.startId;
    return true;
  }

  /** Start over; `overrides` sets starting values (a saved scenario), and is
   *  kept for later restarts until another is given. */
  restart(overrides?: Values) {
    if (!this.initialStartNodeId) return;
    if (overrides) this.overrides = overrides;
    this.history = [];
    this.values = this.sim.initialValues(this.overrides);
    this.errors = [];
    this.taken.clear();
    this.changes = [];
    this.enterNode(this.initialStartNodeId);
  }

  getOptions(): StoryOption[] {
    return this.choices
      .filter((c) => !c.hidden && c.edgeId)
      .map((c) => ({
        label: this.labelOf(c),
        targetId: c.target,
        edgeId: c.edgeId!,
        locked: c.locked,
        lockedReason: c.lockedReason,
        visited: this.taken.has(c.edgeId!),
        timeout: c.timeout,
      }));
  }

  // A choice into a condition/jump node names the scene the player really lands on.
  private labelOf(c: Transition): string {
    return c.customLabel ? c.label : resolveVisibleNode(this.sim, c.target, this.values)?.data?.label || c.label;
  }

  getState(): RuntimeState {
    return {
      currentNode: this.currentNodeId ? this.sim.node(this.currentNodeId)?.node : undefined,
      runtimeVars: this.sim.toVariables(this.values),
      values: this.values,
      canGoBack: this.history.length > 0,
      projectAssets: this.project.assets,
      errors: this.errors,
      changes: this.changes,
      turn: this.turn,
      trace: this.trace,
      asking: this.awaiting
        ? this.questionsAt(this.awaiting).map(({ change, variable }) => ({
            id: change.id,
            question: change.ask?.trim() || `${variable.name}?`,
            variable: variable.name,
            type: valueTypeOf(variable),
          }))
        : null,
    };
  }
}
