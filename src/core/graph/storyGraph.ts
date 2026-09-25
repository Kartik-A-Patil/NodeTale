import { Project, Branch, isConditionNode, isElementNode, isJumpNode } from '../../types';
import { parseExpression, parseScript } from '../expression/parser';
import { collectExprIdentifiers } from '../validation/identifierCollector';
import { extractScriptCode } from '../runtime/htmlScript';
import { Stmt } from '../expression/ast';

// One analysis of a project's story structure, shared by the story views
// (branch map, timeline, path flow, variable tracker) and dashboard stats.
// Follows StoryRuntime's rules: an element node's outgoing edges are its
// choices, a condition node's edges are keyed by branch id (sourceHandle), and
// a jump node continues at jumpTargetId, which may be on another board.

export type FlowNodeType = 'elementNode' | 'conditionNode' | 'jumpNode';

export interface GraphNode {
  id: string;
  boardId: string;
  boardName: string;
  type: FlowNodeType;
  label: string;
  /** Raw node content HTML (element nodes); views derive text lazily. */
  content: string;
  date?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  kind: 'choice' | 'branch' | 'jump';
  /** Branch label + condition for condition nodes ("If health > 0"). */
  label?: string;
}

export interface DeadEnd {
  nodeId: string;
  /** What leads nowhere: a condition branch label, or "jump" for a jump without a valid target. */
  what: string;
}

export interface VariableUse {
  set: Set<string>;
  checked: Set<string>;
  shown: Set<string>;
}

/** 'trunk' = before the first choice; 'shared' = reached from more than one top-level branch. */
export type BranchTag = number | 'trunk' | 'shared';

export interface StoryGraph {
  nodes: Map<string, GraphNode>;
  out: Map<string, GraphLink[]>;
  startId: string | null;
  reachable: Set<string>;
  /** Flow nodes on any board that Start can't reach. */
  unreachable: string[];
  /** Reachable element nodes with no choices. */
  endings: string[];
  deadEnds: DeadEnd[];
  /** Links that close a loop (DFS back-edges). Removing them leaves a DAG. */
  backEdges: Set<GraphLink>;
  /** Reachable nodes in story order (DFS preorder from Start). */
  order: string[];
  /** The first node with more than one way forward, whose options define branches A, B, C... */
  forkId: string | null;
  branchRoots: { target: string; label: string }[];
  branchOf: Map<string, BranchTag>;
  /** Distinct routes (ignoring loops) from Start to each node / from each node to any ending. Capped. */
  pathsFromStart: Map<string, number>;
  pathsToEnd: Map<string, number>;
  variableUse: Map<string, VariableUse>;
}

export const PATH_CAP = 10_000;
const cap = (n: number) => Math.min(n, PATH_CAP);

const DEFAULT_BRANCHES: Branch[] = [
  { id: 'true', label: 'If', condition: 'true' },
  { id: 'false', label: 'Else', condition: '' },
];

const VARIABLE_MENTION = /\{\{\s*([A-Za-z_$][\w$]*)\s*\}\}/g;

const tryParse = <T>(parse: () => T): T | null => {
  try {
    return parse();
  } catch {
    return null;
  }
};

const branchText = (b: Branch) =>
  b.label === 'Else' || !b.condition ? b.label : `${b.label} ${b.condition}`;

function collectVariableUse(project: Project, nodes: Map<string, GraphNode>): Map<string, VariableUse> {
  const uses = new Map<string, VariableUse>();
  const usageOf = (id: string) => {
    let u = uses.get(id);
    if (!u) uses.set(id, (u = { set: new Set(), checked: new Set(), shown: new Set() }));
    return u;
  };

  for (const board of project.boards) {
    for (const node of board.nodes) {
      if (!nodes.has(node.id)) continue;
      if (isElementNode(node)) {
        const content = node.data.content || '';
        for (const m of content.matchAll(VARIABLE_MENTION)) usageOf(node.id).shown.add(m[1]);
        const code = content.includes('<pre') ? extractScriptCode(content) : '';
        const statements: Stmt[] = (code && tryParse(() => parseScript(code))) || [];
        for (const stmt of statements) {
          if (stmt.kind === 'assign') {
            usageOf(node.id).set.add(stmt.name);
            // `x += 1` reads x too
            if (stmt.op !== '=') usageOf(node.id).checked.add(stmt.name);
            collectExprIdentifiers(stmt.value, new Set(), usageOf(node.id).checked);
          } else {
            collectExprIdentifiers(stmt.expr, new Set(), usageOf(node.id).checked);
          }
        }
      } else if (isConditionNode(node)) {
        for (const b of node.data.branches || DEFAULT_BRANCHES) {
          if (!b.condition || b.condition === 'true') continue;
          const expr = tryParse(() => parseExpression(b.condition));
          if (expr) collectExprIdentifiers(expr, new Set(), usageOf(node.id).checked);
        }
      }
    }
  }
  return uses;
}

export function buildStoryGraph(project: Project): StoryGraph {
  const nodes = new Map<string, GraphNode>();
  const out = new Map<string, GraphLink[]>();
  const deadEnds: DeadEnd[] = [];

  for (const board of project.boards) {
    for (const node of board.nodes) {
      if (node.type !== 'elementNode' && node.type !== 'conditionNode' && node.type !== 'jumpNode') continue;
      // ponytail: ids are assumed unique across boards (generated with timestamps); first one wins
      if (nodes.has(node.id)) continue;
      nodes.set(node.id, {
        id: node.id,
        boardId: board.id,
        boardName: board.name,
        type: node.type,
        label: node.data?.label || 'Untitled',
        content: isElementNode(node) ? node.data.content || '' : '',
        date: isElementNode(node) ? node.data.date || undefined : undefined,
      });
      out.set(node.id, []);
    }
  }

  for (const board of project.boards) {
    const boardNodes = new Map(board.nodes.map((n) => [n.id, n]));
    for (const node of board.nodes) {
      if (!nodes.has(node.id)) continue;
      const links = out.get(node.id)!;
      if (isJumpNode(node)) {
        const target = node.data.jumpTargetId;
        if (target && nodes.has(target)) links.push({ source: node.id, target, kind: 'jump' });
        else deadEnds.push({ nodeId: node.id, what: 'jump' });
        continue;
      }
      const edges = board.edges.filter((e) => e.source === node.id && nodes.has(e.target) && boardNodes.has(e.target));
      if (isConditionNode(node)) {
        for (const b of node.data.branches || DEFAULT_BRANCHES) {
          const edge = edges.find((e) => e.sourceHandle === b.id);
          if (edge) links.push({ source: node.id, target: edge.target, kind: 'branch', label: branchText(b) });
          else deadEnds.push({ nodeId: node.id, what: b.label });
        }
      } else {
        for (const e of edges) links.push({ source: node.id, target: e.target, kind: 'choice' });
      }
    }
  }

  const activeBoard = project.boards.find((b) => b.id === project.activeBoardId) || project.boards[0];
  const startNode = activeBoard?.nodes.find((n) => nodes.has(n.id) && n.data?.label?.toLowerCase() === 'start');
  const startId = startNode?.id ?? null;

  // Iterative DFS: preorder (story order), back-edges (loops).
  const reachable = new Set<string>();
  const order: string[] = [];
  const backEdges = new Set<GraphLink>();
  if (startId) {
    const onStack = new Set<string>();
    const stack: { id: string; i: number }[] = [{ id: startId, i: 0 }];
    reachable.add(startId);
    onStack.add(startId);
    order.push(startId);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const links = out.get(top.id)!;
      if (top.i >= links.length) {
        onStack.delete(top.id);
        stack.pop();
        continue;
      }
      const link = links[top.i++];
      if (onStack.has(link.target)) {
        backEdges.add(link);
      } else if (!reachable.has(link.target)) {
        reachable.add(link.target);
        onStack.add(link.target);
        order.push(link.target);
        stack.push({ id: link.target, i: 0 });
      }
    }
  }

  const forward = (id: string) => out.get(id)!.filter((l) => !backEdges.has(l));

  // Topological order of the reachable DAG (reverse DFS postorder).
  const topo: string[] = [];
  {
    const done = new Set<string>();
    const visit = (root: string) => {
      const stack: { id: string; i: number }[] = [{ id: root, i: 0 }];
      done.add(root);
      while (stack.length) {
        const top = stack[stack.length - 1];
        const links = forward(top.id);
        if (top.i < links.length) {
          const next = links[top.i++].target;
          if (!done.has(next)) {
            done.add(next);
            stack.push({ id: next, i: 0 });
          }
        } else {
          topo.push(top.id);
          stack.pop();
        }
      }
    };
    if (startId) visit(startId);
    topo.reverse();
  }

  const endings = order.filter((id) => nodes.get(id)!.type === 'elementNode' && out.get(id)!.length === 0);
  const endingSet = new Set(endings);

  const pathsFromStart = new Map<string, number>();
  if (startId) pathsFromStart.set(startId, 1);
  for (const id of topo) {
    const here = pathsFromStart.get(id) ?? 0;
    for (const l of forward(id)) pathsFromStart.set(l.target, cap((pathsFromStart.get(l.target) ?? 0) + here));
  }
  const pathsToEnd = new Map<string, number>();
  for (let i = topo.length - 1; i >= 0; i--) {
    const id = topo[i];
    let total = endingSet.has(id) ? 1 : 0;
    for (const l of forward(id)) total = cap(total + (pathsToEnd.get(l.target) ?? 0));
    pathsToEnd.set(id, total);
  }

  // Branches: the first node with more than one way forward splits the story.
  let forkId: string | null = null;
  {
    let cur = startId;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const links = forward(cur);
      if (links.length > 1) {
        forkId = cur;
        break;
      }
      cur = links[0]?.target ?? null;
    }
  }
  const branchOf = new Map<string, BranchTag>();
  const branchRoots: { target: string; label: string }[] = [];
  if (forkId) {
    const trunk: string[] = [];
    for (let cur: string | null = startId; cur && cur !== forkId; cur = forward(cur)[0]?.target ?? null) trunk.push(cur);
    trunk.push(forkId);
    const trunkSet = new Set(trunk);
    forward(forkId).forEach((l, i) => {
      branchRoots.push({ target: l.target, label: l.label || nodes.get(l.target)!.label });
      const stack = [l.target];
      const seen = new Set<string>();
      while (stack.length) {
        const id = stack.pop()!;
        if (seen.has(id) || trunkSet.has(id)) continue;
        seen.add(id);
        const prev = branchOf.get(id);
        branchOf.set(id, prev === undefined || prev === i ? i : 'shared');
        for (const next of forward(id)) stack.push(next.target);
      }
    });
    trunk.forEach((id) => branchOf.set(id, 'trunk'));
  } else {
    order.forEach((id) => branchOf.set(id, 'trunk'));
  }

  const unreachable = [...nodes.keys()].filter((id) => !reachable.has(id));

  return {
    nodes,
    out,
    startId,
    reachable,
    unreachable,
    endings,
    deadEnds: deadEnds.filter((d) => reachable.has(d.nodeId)),
    backEdges,
    order,
    forkId,
    branchRoots,
    branchOf,
    pathsFromStart,
    pathsToEnd,
    variableUse: collectVariableUse(project, nodes),
  };
}

/** Letter for a top-level branch index: 0 -> A. */
export const branchLetter = (i: number) => String.fromCharCode(65 + (i % 26));
