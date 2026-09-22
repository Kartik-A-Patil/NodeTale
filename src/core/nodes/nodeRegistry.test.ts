import { describe, expect, it } from 'vitest';
import { executeNode, nodeRegistry } from './nodeRegistry';
import { AppNode, Board, Variable, VariableType } from '../../types';

const board = (overrides: Partial<Board> = {}): Board => ({
  id: 'board-1',
  name: 'Board',
  nodes: [],
  edges: [],
  ...overrides,
});

describe('nodeRegistry.create', () => {
  it('elementNode defaults', () => {
    expect(nodeRegistry.elementNode.create()).toEqual({ label: 'New Element', content: '' });
  });

  it('commentNode retains the pre-existing "Jump" default label', () => {
    expect(nodeRegistry.commentNode.create()).toEqual({ label: 'Jump', text: '' });
  });

  it('extraFields override defaults', () => {
    expect(nodeRegistry.jumpNode.create({ jumpTargetId: 'n2' })).toEqual({ label: 'Jump', jumpTargetId: 'n2' });
  });
});

describe('executeNode', () => {
  it('elementNode returns its content as scriptContent and does not advance', () => {
    const node: AppNode = { id: 'n1', type: 'elementNode', position: { x: 0, y: 0 }, data: { label: 'A', content: '<pre>x=1</pre>' } };
    const result = executeNode(node, { board: board(), runtimeVars: [] });
    expect(result.scriptContent).toBe('<pre>x=1</pre>');
    expect(result.nextNodeId).toBeUndefined();
  });

  it('jumpNode advances to jumpTargetId when set', () => {
    const node: AppNode = { id: 'n1', type: 'jumpNode', position: { x: 0, y: 0 }, data: { label: 'Jump', jumpTargetId: 'n2' } };
    expect(executeNode(node, { board: board(), runtimeVars: [] }).nextNodeId).toBe('n2');
  });

  it('jumpNode does not advance when jumpTargetId is unset', () => {
    const node: AppNode = { id: 'n1', type: 'jumpNode', position: { x: 0, y: 0 }, data: { label: 'Jump' } };
    expect(executeNode(node, { board: board(), runtimeVars: [] }).nextNodeId).toBeFalsy();
  });

  it('conditionNode follows the matching branch edge', () => {
    const runtimeVars: Variable[] = [{ id: 'v1', name: 'hasKey', type: VariableType.BOOLEAN, value: true }];
    const node: AppNode = {
      id: 'n1',
      type: 'conditionNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Check',
        branches: [
          { id: 'true', label: 'If', condition: 'hasKey == true' },
          { id: 'else', label: 'Else', condition: '' },
        ],
      },
    };
    const b = board({
      edges: [
        { id: 'e1', source: 'n1', target: 'n-true', sourceHandle: 'true' },
        { id: 'e2', source: 'n1', target: 'n-else', sourceHandle: 'else' },
      ],
    });
    expect(executeNode(node, { board: b, runtimeVars }).nextNodeId).toBe('n-true');
  });

  it('conditionNode falls back to the Else branch', () => {
    const node: AppNode = {
      id: 'n1',
      type: 'conditionNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Check',
        branches: [
          { id: 'true', label: 'If', condition: 'hasKey == true' },
          { id: 'else', label: 'Else', condition: '' },
        ],
      },
    };
    const b = board({
      edges: [
        { id: 'e1', source: 'n1', target: 'n-true', sourceHandle: 'true' },
        { id: 'e2', source: 'n1', target: 'n-else', sourceHandle: 'else' },
      ],
    });
    expect(executeNode(node, { board: b, runtimeVars: [] }).nextNodeId).toBe('n-else');
  });

  it('commentNode/sectionNode/annotationNode do not advance or run scripts', () => {
    const node: AppNode = { id: 'n1', type: 'commentNode', position: { x: 0, y: 0 }, data: { label: 'Jump', text: 'hi' } };
    const result = executeNode(node, { board: board(), runtimeVars: [] });
    expect(result).toEqual({});
  });
});
