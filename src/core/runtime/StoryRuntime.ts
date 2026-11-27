import { Project, Variable, StoryNode, Asset, isStartNode } from '../../models/story';
import { createSimulator, resolveVisibleNode, valuesEqual, Simulator, Transition, Values } from '../sim/simulate';
import { mathRng, Rng } from './scriptInterpreter';

interface HistoryItem {
  nodeId: string;
  values: Values;
  /** The scene's choices as they were, so Back doesn't re-run its script. */
  choices: Transition[];
}

export interface PlayError {
  nodeId: string;
  nodeLabel: string;
  message: string;
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
}

export interface StoryOption {
  label: string;
  targetId: string;
  edgeId: string;
  locked?: boolean;
  lockedReason?: string;
  /** Taken before in this playthrough. */
  visited?: boolean;
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
  private enterNode(nodeId: string) {
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
      const result = this.sim.step(id, this.values, this.rng);
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
      this.history.push({ nodeId: node.id, values: this.values, choices: [] });
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
    this.history.push({ nodeId: this.currentNodeId, values: this.values, choices: this.choices });
    const before = this.values;
    const { values, error } = this.sim.follow(choice, this.values, this.rng);
    if (error) this.reportError(this.currentNodeId, error);
    this.values = values;
    this.enterNode(choice.target);
    this.taken.add(edgeId);
    this.turn++;
    this.changes = this.sim.variables
      .filter((v) => !valuesEqual(before[v.name], this.values[v.name]))
      .map((v) => ({ name: v.name, before: before[v.name], after: this.values[v.name] }));
  }

  back() {
    const history = [...this.history];
    // Skip logic nodes back to the last scene the player saw.
    while (history.length) {
      const item = history.pop()!;
      if (this.sim.node(item.nodeId)?.node.type !== 'elementNode' && history.length) continue;
      this.history = history;
      this.currentNodeId = item.nodeId;
      this.values = item.values;
      this.choices = item.choices;
      this.changes = [];
      return;
    }
  }

  restart() {
    if (!this.initialStartNodeId) return;
    this.history = [];
    this.values = this.sim.initialValues();
    this.errors = [];
    this.taken.clear();
    this.changes = [];
    this.enterNode(this.initialStartNodeId);
  }

  getOptions(): StoryOption[] {
    return this.choices
      .filter((c) => !c.hidden && c.edgeId)
      .map((c) => {
        // A choice into a condition/jump node names the scene the player really lands on.
        const label = c.customLabel ? c.label : resolveVisibleNode(this.sim, c.target, this.values)?.data?.label || c.label;
        return { label, targetId: c.target, edgeId: c.edgeId!, locked: c.locked, lockedReason: c.lockedReason, visited: this.taken.has(c.edgeId!) };
      });
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
    };
  }
}
