import { Project, Board, AppNode, isConditionNode, isJumpNode, isElementNode } from '../../types';
import { Diagnostic } from './types';
import { parseExpression, parseScript, ExpressionSyntaxError } from '../expression/parser';
import { collectExprIdentifiers, collectScriptIdentifiers } from './identifierCollector';
import { extractScriptCode } from '../runtime/htmlScript';
import { validateVariableReferences } from '../../services/logicService';

// Story-flow node types — the ones reachability/graph rules care about.
// commentNode/sectionNode/annotationNode are editor-only decoration.
const FLOW_NODE_TYPES = new Set(['elementNode', 'conditionNode', 'jumpNode']);

function ruleDuplicateNodeIds(project: Project): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const board of project.boards) {
    const seen = new Set<string>();
    for (const node of board.nodes) {
      if (seen.has(node.id)) {
        diagnostics.push({
          severity: 'error',
          code: 'duplicate-node-id',
          message: `Duplicate node id "${node.id}" on board "${board.name}".`,
          boardId: board.id,
          nodeId: node.id,
        });
      }
      seen.add(node.id);
    }
  }
  return diagnostics;
}

function ruleBrokenJumpTargets(project: Project): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const board of project.boards) {
    const nodeIds = new Set(board.nodes.map((n) => n.id));
    for (const node of board.nodes) {
      if (!isJumpNode(node)) continue;
      const targetId = node.data.jumpTargetId;
      if (targetId && !nodeIds.has(targetId)) {
        diagnostics.push({
          severity: 'error',
          code: 'broken-jump-target',
          message: `Jump node "${node.data.label}" targets a node that no longer exists.`,
          boardId: board.id,
          nodeId: node.id,
        });
      }
    }
  }
  return diagnostics;
}

// BFS from the board's "Start"-labeled node, following real edges plus
// jumpNode targets (which aren't real ReactFlow edges). Skips a board entirely
// if it has no node labeled "Start" — same entry-point resolution StoryRuntime
// itself uses, so this never flags a board it can't determine an entry for.
function ruleUnreachableNodes(project: Project): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const board of project.boards) {
    const startNode = board.nodes.find((n) => n.data.label?.toLowerCase() === 'start');
    if (!startNode) continue;

    const adjacency = new Map<string, string[]>();
    const addEdge = (from: string, to: string) => {
      const list = adjacency.get(from) || [];
      list.push(to);
      adjacency.set(from, list);
    };
    board.edges.forEach((e) => addEdge(e.source, e.target));
    board.nodes.forEach((n) => {
      if (isJumpNode(n) && n.data.jumpTargetId) addEdge(n.id, n.data.jumpTargetId);
    });

    const visited = new Set<string>([startNode.id]);
    const queue = [startNode.id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const next of adjacency.get(current) || []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }

    for (const node of board.nodes) {
      if (!FLOW_NODE_TYPES.has(node.type || '') || visited.has(node.id)) continue;
      diagnostics.push({
        severity: 'warning',
        code: 'unreachable-node',
        message: `Node "${node.data.label}" is not reachable from "Start".`,
        boardId: board.id,
        nodeId: node.id,
      });
    }
  }

  return diagnostics;
}

function ruleUnknownVariables(project: Project): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const variableNames = new Set(project.variables.map((v) => v.name));

  const flagMissing = (names: Iterable<string>, board: Board, node: AppNode, sourceLabel: string) => {
    for (const name of names) {
      if (!variableNames.has(name)) {
        diagnostics.push({
          severity: 'warning',
          code: 'unknown-variable',
          message: `${sourceLabel} on "${node.data.label}" references undefined variable "${name}".`,
          boardId: board.id,
          nodeId: node.id,
        });
      }
    }
  };

  for (const board of project.boards) {
    for (const node of board.nodes) {
      if (isConditionNode(node)) {
        for (const branch of node.data.branches || []) {
          if (!branch.condition) continue;
          try {
            flagMissing(collectExprIdentifiers(parseExpression(branch.condition)), board, node, `Condition "${branch.condition}"`);
          } catch (err) {
            if (err instanceof ExpressionSyntaxError) {
              diagnostics.push({
                severity: 'error',
                code: 'condition-syntax-error',
                message: `Condition "${branch.condition}" on "${node.data.label}" has a syntax error: ${err.message}`,
                boardId: board.id,
                nodeId: node.id,
              });
            }
          }
        }
      }

      if (isElementNode(node)) {
        const code = extractScriptCode(node.data.content);
        if (code) {
          try {
            flagMissing(collectScriptIdentifiers(parseScript(code)), board, node, 'Script');
          } catch (err) {
            if (err instanceof ExpressionSyntaxError) {
              diagnostics.push({
                severity: 'error',
                code: 'script-syntax-error',
                message: `Script on "${node.data.label}" has a syntax error: ${err.message}`,
                boardId: board.id,
                nodeId: node.id,
              });
            }
          }
        }

        const textResult = validateVariableReferences(node.data.content, project.variables);
        if (!textResult.valid) {
          textResult.errors.forEach((e) => {
            diagnostics.push({
              severity: 'warning',
              code: 'unknown-variable',
              message: `${e.message} on "${node.data.label}".`,
              boardId: board.id,
              nodeId: node.id,
            });
          });
        }
      }
    }
  }

  return diagnostics;
}

export function validateProject(project: Project, options?: { boardIds?: string[] }): Diagnostic[] {
  // Every rule loops `project.boards` independently with no cross-board
  // dependency, so scoping down to a subset of boards before running them is
  // exact, not an approximation — e.g. the Problems panel only ever displays
  // the active board's diagnostics, so there's no reason to parse every
  // condition/script on every other board on each recheck.
  const scoped: Project = options?.boardIds
    ? { ...project, boards: project.boards.filter((b) => options.boardIds!.includes(b.id)) }
    : project;

  return [
    ...ruleDuplicateNodeIds(scoped),
    ...ruleBrokenJumpTargets(scoped),
    ...ruleUnreachableNodes(scoped),
    ...ruleUnknownVariables(scoped),
  ];
}
