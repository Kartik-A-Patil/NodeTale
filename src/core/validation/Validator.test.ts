import { describe, expect, it } from 'vitest';
import { validateProject } from './Validator';
import { AppNode, Board, Project, VariableType } from '../../types';

const elementNode = (id: string, label: string, content = ''): AppNode =>
  ({ id, type: 'elementNode', position: { x: 0, y: 0 }, data: { label, content } } as AppNode);

const jumpNode = (id: string, jumpTargetId?: string): AppNode =>
  ({ id, type: 'jumpNode', position: { x: 0, y: 0 }, data: { label: 'Jump', jumpTargetId } } as AppNode);

const conditionNode = (id: string, branches: Array<{ id: string; label: string; condition: string }>): AppNode =>
  ({ id, type: 'conditionNode', position: { x: 0, y: 0 }, data: { label: 'Check', branches } } as AppNode);

const project = (board: Board, overrides: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: 'Test',
  activeBoardId: board.id,
  boards: [board],
  variables: [],
  assets: [],
  folders: [],
  ...overrides,
});

describe('validateProject — duplicate node ids', () => {
  it('flags two nodes sharing the same id on a board', () => {
    const board: Board = { id: 'b1', name: 'Board', nodes: [elementNode('n1', 'A'), elementNode('n1', 'B')], edges: [] };
    const diagnostics = validateProject(project(board));
    expect(diagnostics.some((d) => d.code === 'duplicate-node-id' && d.nodeId === 'n1')).toBe(true);
  });

  it('does not flag unique ids', () => {
    const board: Board = { id: 'b1', name: 'Board', nodes: [elementNode('n1', 'A'), elementNode('n2', 'B')], edges: [] };
    expect(validateProject(project(board)).some((d) => d.code === 'duplicate-node-id')).toBe(false);
  });
});

describe('validateProject — broken jump targets', () => {
  it('flags a jumpNode targeting a node that does not exist', () => {
    const board: Board = { id: 'b1', name: 'Board', nodes: [jumpNode('j1', 'missing')], edges: [] };
    const diagnostics = validateProject(project(board));
    expect(diagnostics.some((d) => d.code === 'broken-jump-target' && d.nodeId === 'j1')).toBe(true);
  });

  it('does not flag a valid jump target', () => {
    const board: Board = { id: 'b1', name: 'Board', nodes: [jumpNode('j1', 'n2'), elementNode('n2', 'Target')], edges: [] };
    expect(validateProject(project(board)).some((d) => d.code === 'broken-jump-target')).toBe(false);
  });

  it('does not flag a jumpNode with no target set at all', () => {
    const board: Board = { id: 'b1', name: 'Board', nodes: [jumpNode('j1')], edges: [] };
    expect(validateProject(project(board)).some((d) => d.code === 'broken-jump-target')).toBe(false);
  });
});

describe('validateProject — unreachable nodes', () => {
  it('flags a node with no path from Start', () => {
    const board: Board = {
      id: 'b1',
      name: 'Board',
      nodes: [elementNode('n1', 'Start'), elementNode('n2', 'Reachable'), elementNode('n3', 'Stranded')],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    };
    const diagnostics = validateProject(project(board));
    expect(diagnostics.some((d) => d.code === 'unreachable-node' && d.nodeId === 'n3')).toBe(true);
    expect(diagnostics.some((d) => d.code === 'unreachable-node' && d.nodeId === 'n2')).toBe(false);
  });

  it('follows jumpNode targets as traversal edges, not just real edges', () => {
    const board: Board = {
      id: 'b1',
      name: 'Board',
      nodes: [elementNode('n1', 'Start'), jumpNode('j1', 'n2'), elementNode('n2', 'ViaJump')],
      edges: [{ id: 'e1', source: 'n1', target: 'j1' }],
    };
    expect(validateProject(project(board)).some((d) => d.code === 'unreachable-node')).toBe(false);
  });

  it('skips a board with no node labeled "Start" instead of false-positiving every node', () => {
    const board: Board = { id: 'b1', name: 'Board', nodes: [elementNode('n1', 'A'), elementNode('n2', 'B')], edges: [] };
    expect(validateProject(project(board)).some((d) => d.code === 'unreachable-node')).toBe(false);
  });

  it('does not flag decorative node types (comment/section/annotation) as unreachable', () => {
    const board: Board = {
      id: 'b1',
      name: 'Board',
      nodes: [
        elementNode('n1', 'Start'),
        { id: 'c1', type: 'commentNode', position: { x: 0, y: 0 }, data: { label: 'Comment', text: 'note' } } as AppNode,
      ],
      edges: [],
    };
    expect(validateProject(project(board)).some((d) => d.code === 'unreachable-node')).toBe(false);
  });
});

describe('validateProject — unknown variable references', () => {
  const withVar = (board: Board) => project(board, { variables: [{ id: 'v1', name: 'hasKey', type: VariableType.BOOLEAN, value: true }] });

  it('flags a condition referencing an undefined variable', () => {
    const board: Board = { id: 'b1', name: 'Board', nodes: [conditionNode('c1', [{ id: 'b1', label: 'If', condition: 'missing == true' }])], edges: [] };
    const diagnostics = validateProject(withVar(board));
    expect(diagnostics.some((d) => d.code === 'unknown-variable' && d.nodeId === 'c1')).toBe(true);
  });

  it('does not flag a condition referencing a real variable', () => {
    const board: Board = { id: 'b1', name: 'Board', nodes: [conditionNode('c1', [{ id: 'b1', label: 'If', condition: 'hasKey == true' }])], edges: [] };
    expect(validateProject(withVar(board)).some((d) => d.code === 'unknown-variable')).toBe(false);
  });

  it('flags a condition with a syntax error separately from unknown-variable', () => {
    const board: Board = { id: 'b1', name: 'Board', nodes: [conditionNode('c1', [{ id: 'b1', label: 'If', condition: 'hasKey ==' }])], edges: [] };
    const diagnostics = validateProject(withVar(board));
    expect(diagnostics.some((d) => d.code === 'condition-syntax-error' && d.nodeId === 'c1')).toBe(true);
  });

  it('flags a script assigning to an undefined variable', () => {
    const board: Board = { id: 'b1', name: 'Board', nodes: [elementNode('n1', 'Start', '<pre>missing = 1</pre>')], edges: [] };
    const diagnostics = validateProject(withVar(board));
    expect(diagnostics.some((d) => d.code === 'unknown-variable' && d.nodeId === 'n1')).toBe(true);
  });

  it('does not flag an arrow-function parameter as an unknown variable', () => {
    const board: Board = {
      id: 'b1', name: 'Board',
      nodes: [elementNode('n1', 'Start', '<pre>items = arrayMap(items, x => x * 2)</pre>')],
      edges: [],
    };
    const proj = project(board, {
      variables: [{ id: 'v1', name: 'items', type: VariableType.ARRAY, value: { elementType: VariableType.NUMBER, elements: [] } }],
    });
    // `x` is the arrow function's own parameter, not a project variable — must
    // not be flagged as unknown even though nothing named "x" is declared.
    expect(validateProject(proj).filter((d) => d.nodeId === 'n1')).toEqual([]);
  });

  it('flags an undefined {{variable}} interpolation in node content', () => {
    const board: Board = { id: 'b1', name: 'Board', nodes: [elementNode('n1', 'Start', 'Hello {{missing}}')], edges: [] };
    const diagnostics = validateProject(withVar(board));
    expect(diagnostics.some((d) => d.code === 'unknown-variable' && d.nodeId === 'n1')).toBe(true);
  });
});

describe('validateProject — boardIds scoping', () => {
  it('only validates the given boards, not the whole project', () => {
    const boardA: Board = { id: 'a', name: 'A', nodes: [jumpNode('ja', 'missing')], edges: [] };
    const boardB: Board = { id: 'b', name: 'B', nodes: [jumpNode('jb', 'missing')], edges: [] };
    const proj: Project = { id: 'p1', name: 'Test', activeBoardId: 'a', boards: [boardA, boardB], variables: [], assets: [], folders: [] };

    const all = validateProject(proj);
    expect(all.filter((d) => d.code === 'broken-jump-target')).toHaveLength(2);

    const onlyA = validateProject(proj, { boardIds: ['a'] });
    expect(onlyA.filter((d) => d.code === 'broken-jump-target')).toHaveLength(1);
    expect(onlyA.every((d) => d.boardId === 'a')).toBe(true);
  });
});
