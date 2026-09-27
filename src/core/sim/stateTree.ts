import { Branch } from '../../models/story';
import { Simulator, Transition, Values } from './simulate';

// The story as a tree of *states*: every node is a scene together with the
// variable values the story has when it gets there on that path. The same
// scene appears once per distinct state, so the tree shows how choices change
// the numbers and which branch a condition really takes.

export interface StateTreeNode {
  /** Unique within the tree (path of child indices). */
  key: string;
  nodeId: string;
  /**
   * scene: first time this (scene, values) pair is reached.
   * join:  reached again with identical values from another path (not repeated).
   * loop:  this path returns to a scene with the same values it already had, so it would repeat forever.
   * more:  the tree size budget ran out below here.
   */
  kind: 'scene' | 'join' | 'loop' | 'more';
  /** How the story got here from the parent (choice text / branch taken / jump). */
  via?: Transition;
  /** Values on arriving, and after the scene's script ran. */
  before: Values;
  after: Values;
  changed: string[];
  error?: string;
  /** Condition scenes: the branch these values take. */
  branchTaken?: Branch;
  /** Condition scene where no branch matched: the story stops. */
  noBranch: boolean;
  /** A scene with no way forward. */
  isEnding: boolean;
  /** For join/loop: key of the node this repeats. */
  repeats?: string;
  /** How many times this scene appears on the path so far, including here (1 = first visit). */
  visit: number;
  children: StateTreeNode[];
}

export interface StateTree {
  root: StateTreeNode | null;
  /** Scene nodes in the tree (stubs not counted). */
  size: number;
  truncated: boolean;
  byKey: Map<string, StateTreeNode>;
}

const stateKey = (values: Values) => JSON.stringify(values);

export const DEFAULT_TREE_BUDGET = 500;

/**
 * Breadth-first from Start, so shallow states are always present and the
 * budget cuts off the deepest parts first.
 */
export function buildStateTree(sim: Simulator, initial: Values, budget = DEFAULT_TREE_BUDGET): StateTree {
  const byKey = new Map<string, StateTreeNode>();
  if (!sim.startId) return { root: null, size: 0, truncated: false, byKey };

  const firstSeen = new Map<string, string>(); // `${nodeId}|${state}` -> tree key
  let size = 0;
  let truncated = false;

  const make = (key: string, nodeId: string, before: Values, via: Transition | undefined, onPath: Map<string, string>, visit: number) => {
    const result = sim.step(nodeId, before);
    const visitKey = `${nodeId}|${stateKey(result.after)}`;
    const node = sim.node(nodeId)?.node;
    const isCondition = node?.type === 'conditionNode';
    const base = {
      key, nodeId, via, before, after: result.after, changed: result.changed, error: result.error,
      branchTaken: result.branchTaken,
      visit,
      noBranch: isCondition && !result.branchTaken,
      isEnding: !isCondition && result.next.length === 0,
      children: [] as StateTreeNode[],
    };
    let treeNode: StateTreeNode;
    if (onPath.has(visitKey)) treeNode = { ...base, kind: 'loop', repeats: onPath.get(visitKey) };
    else if (firstSeen.has(visitKey)) treeNode = { ...base, kind: 'join', repeats: firstSeen.get(visitKey) };
    else {
      treeNode = { ...base, kind: 'scene' };
      firstSeen.set(visitKey, key);
      size++;
    }
    byKey.set(key, treeNode);
    return { treeNode, next: result.next, visitKey };
  };

  const rootMade = make('0', sim.startId, initial, undefined, new Map(), 1);
  const queue: { parent: StateTreeNode; next: Transition[]; onPath: Map<string, string>; visits: Map<string, number> }[] = [
    { parent: rootMade.treeNode, next: rootMade.next, onPath: new Map([[rootMade.visitKey, '0']]), visits: new Map([[sim.startId, 1]]) },
  ];

  for (let head = 0; head < queue.length; head++) {
    const { parent, next, onPath, visits } = queue[head];
    for (let i = 0; i < next.length; i++) {
      if (size >= budget) {
        truncated = true;
        const key = `${parent.key}.${i}`;
        const stub: StateTreeNode = {
          key, nodeId: next[i].target, kind: 'more', via: next[i], before: parent.after, after: parent.after,
          changed: [], noBranch: false, isEnding: false, children: [], visit: (visits.get(next[i].target) ?? 0) + 1,
        };
        byKey.set(key, stub);
        parent.children.push(stub);
        break;
      }
      const visit = (visits.get(next[i].target) ?? 0) + 1;
      const made = make(`${parent.key}.${i}`, next[i].target, parent.after, next[i], onPath, visit);
      parent.children.push(made.treeNode);
      if (made.treeNode.kind === 'scene' && made.next.length) {
        queue.push({
          parent: made.treeNode, next: made.next,
          onPath: new Map(onPath).set(made.visitKey, made.treeNode.key),
          visits: new Map(visits).set(next[i].target, visit),
        });
      }
    }
  }

  return { root: rootMade.treeNode, size, truncated, byKey };
}

/** Tree nodes from the root to `key`, inclusive. */
export function pathTo(tree: StateTree, key: string): StateTreeNode[] {
  const parts = key.split('.');
  const path: StateTreeNode[] = [];
  for (let i = 1; i <= parts.length; i++) {
    const node = tree.byKey.get(parts.slice(0, i).join('.'));
    if (node) path.push(node);
  }
  return path;
}
