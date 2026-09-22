import { Project, Variable, AppNode, Board, Asset } from '../../types';
import { executeNode } from '../nodes/nodeRegistry';
import { runScript } from './scriptInterpreter';
import { toJSValue, applyScopeToVariables } from './variableCoercion';
import { extractScriptCode } from './htmlScript';

interface HistoryItem {
  nodeId: string;
  variables: Variable[];
}

export interface RuntimeState {
  currentNode: AppNode | undefined;
  runtimeVars: Variable[];
  canGoBack: boolean;
  projectAssets: Asset[];
}

export interface StoryOption {
  label: string;
  targetId: string;
}

// Pure-TS story playback engine — no React. usePlayMode.ts wraps this in a thin
// hook that just re-renders on getState(). Snapshots `project` at construction;
// does not react to later edits to that object.
export class StoryRuntime {
  private project: Project;
  private currentNodeId: string | null = null;
  private initialStartNodeId: string | null = null;
  private history: HistoryItem[] = [];
  private runtimeVars: Variable[];

  constructor(project: Project, startNodeId?: string | null) {
    this.project = project;
    this.runtimeVars = JSON.parse(JSON.stringify(project.variables));
    this.start(startNodeId);
  }

  private findNode(id: string): { node: AppNode; board: Board } | null {
    for (const board of this.project.boards) {
      const found = board.nodes.find((n) => n.id === id);
      if (found) return { node: found, board };
    }
    return null;
  }

  private runScriptContent(content: string) {
    const code = extractScriptCode(content);
    if (!code) return;

    const readScope: Record<string, unknown> = {};
    this.runtimeVars.forEach((v) => { readScope[v.name] = toJSValue(v); });

    const { changes, error } = runScript(code, readScope);
    if (error) {
      console.warn('[PlayMode] Script error:', error);
    }
    if (Object.keys(changes).length > 0) {
      this.runtimeVars = applyScopeToVariables(this.runtimeVars, changes);
    }
  }

  // Auto-advances through non-interactive nodes (jump/condition) until landing on
  // an interactive one or a dead end. Runs synchronously, so a cyclic graph would
  // hang the thread without the visited-set cycle check below.
  private enterNode(nodeId: string) {
    this.currentNodeId = nodeId;
    const visited = new Set<string>();

    while (this.currentNodeId) {
      if (visited.has(this.currentNodeId)) {
        console.warn(`[PlayMode] Cycle detected in auto-advance chain at node ${this.currentNodeId}; stopping.`);
        return;
      }
      visited.add(this.currentNodeId);

      const ctx = this.findNode(this.currentNodeId);
      if (!ctx) return;
      const { node, board } = ctx;

      const result = executeNode(node, { board, runtimeVars: this.runtimeVars });
      if (result.scriptContent !== undefined) {
        this.runScriptContent(result.scriptContent);
      }

      if (!result.nextNodeId) return;

      this.history.push({ nodeId: node.id, variables: JSON.parse(JSON.stringify(this.runtimeVars)) });
      this.currentNodeId = result.nextNodeId;
    }
  }

  start(startNodeId?: string | null) {
    const board =
      this.project.boards.find((b) => b.id === this.project.activeBoardId) || this.project.boards[0];
    if (!board || board.nodes.length === 0) return;

    const startNode = startNodeId
      ? board.nodes.find((n) => n.id === startNodeId)
      : board.nodes.find((n) => n.data.label.toLowerCase() === 'start');
    if (!startNode) return;

    this.initialStartNodeId = startNode.id;
    this.history = [];
    this.enterNode(startNode.id);
  }

  choose(targetId: string) {
    if (this.currentNodeId) {
      this.history.push({ nodeId: this.currentNodeId, variables: JSON.parse(JSON.stringify(this.runtimeVars)) });
    }
    this.enterNode(targetId);
  }

  back() {
    if (this.history.length === 0) return;

    const newHistory = [...this.history];
    let prevItem = newHistory.pop();

    // Skip logic nodes to find the last interactive node
    while (prevItem) {
      const nodeContext = this.findNode(prevItem.nodeId);
      if (nodeContext && nodeContext.node.type === 'elementNode') break;
      if (newHistory.length === 0) break;
      prevItem = newHistory.pop();
    }

    if (prevItem) {
      this.history = newHistory;
      // Set directly, not via enterNode: no re-running the node's script.
      this.currentNodeId = prevItem.nodeId;
      this.runtimeVars = prevItem.variables;
    }
  }

  restart() {
    if (!this.initialStartNodeId) return;
    this.history = [];
    this.runtimeVars = JSON.parse(JSON.stringify(this.project.variables));
    this.enterNode(this.initialStartNodeId);
  }

  getOptions(): StoryOption[] {
    const ctx = this.currentNodeId ? this.findNode(this.currentNodeId) : null;
    if (!ctx || ctx.node.type !== 'elementNode') return [];

    const { node: currentNode, board } = ctx;
    const edges = board.edges.filter((e) => e.source === currentNode.id);

    return edges
      .map((edge) => {
        const target = board.nodes.find((n) => n.id === edge.target);
        return { label: (target?.data as any)?.label || 'Continue', targetId: target?.id };
      })
      .filter((opt): opt is StoryOption => !!opt.targetId);
  }

  getState(): RuntimeState {
    const ctx = this.currentNodeId ? this.findNode(this.currentNodeId) : null;
    return {
      currentNode: ctx?.node,
      runtimeVars: this.runtimeVars,
      canGoBack: this.history.length > 0,
      projectAssets: this.project.assets,
    };
  }
}
