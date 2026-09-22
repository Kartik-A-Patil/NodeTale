import { describe, expect, it } from 'vitest';
import { StoryRuntime } from './StoryRuntime';
import { AppNode, Board, Project, VariableType } from '../../types';

const elementNode = (id: string, label: string, content = ''): AppNode =>
  ({ id, type: 'elementNode', position: { x: 0, y: 0 }, data: { label, content } } as AppNode);

const jumpNode = (id: string, jumpTargetId?: string): AppNode =>
  ({ id, type: 'jumpNode', position: { x: 0, y: 0 }, data: { label: 'Jump', jumpTargetId } } as AppNode);

const conditionNode = (id: string, branches: Array<{ id: string; label: string; condition: string }>): AppNode =>
  ({ id, type: 'conditionNode', position: { x: 0, y: 0 }, data: { label: 'Check', branches } } as AppNode);

const project = (board: Board): Project => ({
  id: 'p1',
  name: 'Test',
  activeBoardId: board.id,
  boards: [board],
  variables: [],
  assets: [],
  folders: [],
});

describe('StoryRuntime — element chain', () => {
  it('starts at the node named "Start" and exposes its options', () => {
    const board: Board = {
      id: 'b1',
      name: 'Board',
      nodes: [elementNode('n1', 'Start'), elementNode('n2', 'Next')],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    };
    const runtime = new StoryRuntime(project(board));
    expect(runtime.getState().currentNode?.id).toBe('n1');
    expect(runtime.getOptions()).toEqual([{ label: 'Next', targetId: 'n2' }]);
  });

  it('choose() advances to the chosen option', () => {
    const board: Board = {
      id: 'b1',
      name: 'Board',
      nodes: [elementNode('n1', 'Start'), elementNode('n2', 'Next')],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    };
    const runtime = new StoryRuntime(project(board));
    runtime.choose('n2');
    expect(runtime.getState().currentNode?.id).toBe('n2');
    expect(runtime.getState().canGoBack).toBe(true);
  });

  it('back() returns to the previous interactive node without re-running it', () => {
    const board: Board = {
      id: 'b1',
      name: 'Board',
      nodes: [elementNode('n1', 'Start'), elementNode('n2', 'Next')],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    };
    const runtime = new StoryRuntime(project(board));
    runtime.choose('n2');
    runtime.back();
    expect(runtime.getState().currentNode?.id).toBe('n1');
    expect(runtime.getState().canGoBack).toBe(false);
  });

  it('starts at an explicit startNodeId when given, ignoring the "Start" label', () => {
    const board: Board = {
      id: 'b1',
      name: 'Board',
      nodes: [elementNode('n1', 'Start'), elementNode('n2', 'Other')],
      edges: [],
    };
    const runtime = new StoryRuntime(project(board), 'n2');
    expect(runtime.getState().currentNode?.id).toBe('n2');
  });
});

describe('StoryRuntime — auto-advance chain (jump/condition)', () => {
  it('auto-advances through a jumpNode to land on the target elementNode', () => {
    const board: Board = {
      id: 'b1',
      name: 'Board',
      nodes: [elementNode('n1', 'Start'), jumpNode('j1', 'n2'), elementNode('n2', 'Landed')],
      edges: [],
    };
    const runtime = new StoryRuntime(project(board), 'j1');
    expect(runtime.getState().currentNode?.id).toBe('n2');
  });

  it('chains through multiple condition/jump nodes in one step', () => {
    const board: Board = {
      id: 'b1',
      name: 'Board',
      nodes: [
        conditionNode('c1', [{ id: 'true', label: 'If', condition: 'true' }]),
        jumpNode('j1', 'n1'),
        elementNode('n1', 'Landed'),
      ],
      edges: [{ id: 'e1', source: 'c1', target: 'j1', sourceHandle: 'true' }],
    };
    const runtime = new StoryRuntime(project(board), 'c1');
    expect(runtime.getState().currentNode?.id).toBe('n1');
  });

  it('a jumpNode with no jumpTargetId is a dead end (stays put, no crash)', () => {
    const board: Board = {
      id: 'b1',
      name: 'Board',
      nodes: [jumpNode('j1', undefined)],
      edges: [],
    };
    const runtime = new StoryRuntime(project(board), 'j1');
    expect(runtime.getState().currentNode?.id).toBe('j1');
  });
});

describe('StoryRuntime — variables and scripts', () => {
  const projectWithVar = (board: Board) => ({
    ...project(board),
    variables: [{ id: 'v1', name: 'health', type: VariableType.NUMBER, value: 50 }],
  });

  it('runs a node\'s <pre> script on entry and updates runtimeVars', () => {
    const board: Board = {
      id: 'b1',
      name: 'Board',
      nodes: [elementNode('n1', 'Start', '<pre>health += 10</pre>')],
      edges: [],
    };
    const runtime = new StoryRuntime(projectWithVar(board));
    const health = runtime.getState().runtimeVars.find(v => v.name === 'health');
    expect(health?.value).toBe(60);
  });

  it('routes through a conditionNode branch based on the current runtimeVars', () => {
    const board: Board = {
      id: 'b1',
      name: 'Board',
      nodes: [
        conditionNode('c1', [
          { id: 'true', label: 'If', condition: 'health >= 50' },
          { id: 'else', label: 'Else', condition: '' },
        ]),
        elementNode('n1', 'High'),
        elementNode('n2', 'Low'),
      ],
      edges: [
        { id: 'e1', source: 'c1', target: 'n1', sourceHandle: 'true' },
        { id: 'e2', source: 'c1', target: 'n2', sourceHandle: 'else' },
      ],
    };
    const runtime = new StoryRuntime(projectWithVar(board), 'c1');
    expect(runtime.getState().currentNode?.id).toBe('n1');
  });

  it('restart() resets variables and history but keeps the original start node', () => {
    const board: Board = {
      id: 'b1',
      name: 'Board',
      nodes: [elementNode('n1', 'Start', '<pre>health += 10</pre>'), elementNode('n2', 'Next')],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    };
    const runtime = new StoryRuntime(projectWithVar(board));
    runtime.choose('n2');
    expect(runtime.getState().runtimeVars.find(v => v.name === 'health')?.value).toBe(60);

    runtime.restart();
    expect(runtime.getState().currentNode?.id).toBe('n1');
    expect(runtime.getState().canGoBack).toBe(false);
    // The start node's script re-runs against the freshly-reset variables.
    expect(runtime.getState().runtimeVars.find(v => v.name === 'health')?.value).toBe(60);
  });

  it('a script error is swallowed (warned, not thrown) and play mode keeps working', () => {
    const board: Board = {
      id: 'b1',
      name: 'Board',
      nodes: [elementNode('n1', 'Start', '<pre>unknownVar = 1</pre>')],
      edges: [],
    };
    expect(() => new StoryRuntime(projectWithVar(board))).not.toThrow();
  });

  it('a script can actually call the whitelisted array helpers on a real ARRAY variable (regression: readScope must pass the ArrayValue wrapper shape those helpers expect, not a plain JS array)', () => {
    const board: Board = {
      id: 'b1',
      name: 'Board',
      nodes: [elementNode('n1', 'Start', '<pre>inventory = arrayPush(inventory, "shield")</pre>')],
      edges: [],
    };
    const proj: Project = {
      ...project(board),
      variables: [{
        id: 'v1', name: 'inventory', type: VariableType.ARRAY,
        value: { elementType: VariableType.STRING, elements: ['sword'] },
      }],
    };
    const runtime = new StoryRuntime(proj);
    const inventory = runtime.getState().runtimeVars.find(v => v.name === 'inventory');
    expect(inventory?.value).toEqual({ elementType: VariableType.STRING, elements: ['sword', 'shield'] });
  });

  it('a script can call objectSpread on a real OBJECT variable', () => {
    const board: Board = {
      id: 'b1',
      name: 'Board',
      nodes: [elementNode('n1', 'Start', '<pre>player = objectSpread(player, { level: 2 })</pre>')],
      edges: [],
    };
    const proj: Project = {
      ...project(board),
      variables: [{
        id: 'v1', name: 'player', type: VariableType.OBJECT,
        value: { keys: { level: { type: VariableType.NUMBER, value: 1 } } },
      }],
    };
    const runtime = new StoryRuntime(proj);
    const player = runtime.getState().runtimeVars.find(v => v.name === 'player');
    expect(player?.value).toEqual({ keys: { level: { type: VariableType.STRING, value: 2 } } });
  });
});

describe('StoryRuntime — cyclic graphs do not hang', () => {
  it('two jumpNodes pointing at each other stop via cycle detection instead of looping forever', () => {
    const board: Board = {
      id: 'b1',
      name: 'Board',
      nodes: [jumpNode('j1', 'j2'), jumpNode('j2', 'j1')],
      edges: [],
    };
    const runtime = new StoryRuntime(project(board), 'j1');
    // Doesn't hang (this test itself completing is the assertion); lands back on
    // one of the cycle's nodes rather than an interactive node.
    expect(['j1', 'j2']).toContain(runtime.getState().currentNode?.id);
  });

  it('a jumpNode targeting itself stops immediately', () => {
    const board: Board = {
      id: 'b1',
      name: 'Board',
      nodes: [jumpNode('j1', 'j1')],
      edges: [],
    };
    const runtime = new StoryRuntime(project(board), 'j1');
    expect(runtime.getState().currentNode?.id).toBe('j1');
  });
});
