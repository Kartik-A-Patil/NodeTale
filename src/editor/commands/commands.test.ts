import { describe, expect, it } from 'vitest';
import { Edge } from 'reactflow';
import { AppNode } from '../../types';
import { CommandContext } from './types';
import { addElementsCommand } from './addElementsCommand';
import { deleteNodeCommand } from './deleteNodeCommand';
import { deleteElementsCommand } from './deleteElementsCommand';
import { moveNodesCommand } from './moveNodeCommand';
import { connectEdgeCommand } from './connectEdgeCommand';
import { reconnectEdgeCommand } from './reconnectEdgeCommand';
import { deleteEdgeCommand } from './deleteEdgeCommand';
import { updateNodeCommand } from './updateNodeCommand';
import { updateEdgeCommand } from './updateEdgeCommand';

// A fake CommandContext that mirrors real React's setState timing: setNodes/
// setEdges queue their updater rather than applying it immediately, and ctx's own
// getNodes/getEdges only ever reflect the last-flushed state — never a same-tick
// pending update. This is deliberate: it's what caught a real bug where
// deleteNodeCommand read a value back out of its own setNodes updater's closure
// within the same execute() call, which works with a naively-synchronous fake but
// silently reads stale/undefined data against real React (a setState updater is
// never invoked synchronously). Commands must read via ctx.getNodes()/getEdges()
// *before* calling a setter if they need current state, not after.
//
// The test-facing getNodes()/getEdges() (returned alongside ctx) flush pending
// updates first, simulating that a render has happened by the time the test
// inspects the result.
const makeCtx = (initialNodes: AppNode[] = [], initialEdges: Edge[] = []) => {
  let nodes = initialNodes;
  let edges = initialEdges;
  let pendingNodeUpdaters: Array<(n: AppNode[]) => AppNode[]> = [];
  let pendingEdgeUpdaters: Array<(e: Edge[]) => Edge[]> = [];

  const flush = () => {
    pendingNodeUpdaters.forEach(fn => { nodes = fn(nodes); });
    pendingEdgeUpdaters.forEach(fn => { edges = fn(edges); });
    pendingNodeUpdaters = [];
    pendingEdgeUpdaters = [];
  };

  const ctx: CommandContext = {
    setNodes: (updater) => {
      pendingNodeUpdaters.push(typeof updater === 'function' ? updater : () => updater);
    },
    setEdges: (updater) => {
      pendingEdgeUpdaters.push(typeof updater === 'function' ? updater : () => updater);
    },
    getNodes: () => nodes,
    getEdges: () => edges,
  };

  return {
    ctx,
    getNodes: () => { flush(); return nodes; },
    getEdges: () => { flush(); return edges; },
  };
};

const node = (id: string, overrides: Partial<AppNode> = {}): AppNode =>
  ({ id, type: 'elementNode', position: { x: 0, y: 0 }, data: { label: id, content: '' }, ...overrides } as AppNode);

describe('addElementsCommand', () => {
  it('execute adds nodes/edges; undo removes them', () => {
    const { ctx, getNodes, getEdges } = makeCtx([node('a')], []);
    const newNode = node('b');
    const newEdge: Edge = { id: 'e1', source: 'a', target: 'b' };
    const cmd = addElementsCommand(ctx, [newNode], [newEdge]);

    cmd.execute();
    expect(getNodes().map(n => n.id)).toEqual(['a', 'b']);
    expect(getEdges().map(e => e.id)).toEqual(['e1']);

    cmd.undo();
    expect(getNodes().map(n => n.id)).toEqual(['a']);
    expect(getEdges()).toEqual([]);
  });

  it('deselectExisting deselects prior nodes on execute and restores selection on undo', () => {
    const { ctx, getNodes } = makeCtx([node('a', { selected: true })], []);
    const cmd = addElementsCommand(ctx, [node('b', { selected: true })], [], true);

    cmd.execute();
    expect(getNodes().find(n => n.id === 'a')?.selected).toBe(false);

    cmd.undo();
    expect(getNodes().find(n => n.id === 'a')?.selected).toBe(true);
    expect(getNodes().map(n => n.id)).toEqual(['a']);
  });
});

describe('deleteNodeCommand', () => {
  it('deletes a plain node and its connected edges; undo restores both', () => {
    const nodes = [node('a'), node('b')];
    const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b' }];
    const { ctx, getNodes, getEdges } = makeCtx(nodes, edges);
    const cmd = deleteNodeCommand(ctx, 'a', false);

    cmd.execute();
    expect(getNodes().map(n => n.id)).toEqual(['b']);
    expect(getEdges()).toEqual([]);

    cmd.undo();
    expect(getNodes().map(n => n.id).sort()).toEqual(['a', 'b']);
    expect(getEdges().map(e => e.id)).toEqual(['e1']);
  });

  it('deleting a sectionNode with deleteChildren=true removes children and their edges', () => {
    const nodes = [
      node('s1', { type: 'sectionNode' }),
      node('c1', { parentNode: 's1' }),
      node('other'),
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'c1', target: 'other' }];
    const { ctx, getNodes, getEdges } = makeCtx(nodes, edges);
    const cmd = deleteNodeCommand(ctx, 's1', true);

    cmd.execute();
    expect(getNodes().map(n => n.id)).toEqual(['other']);
    expect(getEdges()).toEqual([]);

    cmd.undo();
    expect(getNodes().map(n => n.id).sort()).toEqual(['c1', 'other', 's1']);
    expect(getEdges().map(e => e.id)).toEqual(['e1']);
  });

  it('deleting a sectionNode with deleteChildren=false ungroups children instead (edges untouched)', () => {
    const nodes = [
      node('s1', { type: 'sectionNode' }),
      node('c1', { parentNode: 's1', position: { x: 5, y: 5 } }),
    ];
    const { ctx, getNodes } = makeCtx(nodes, []);
    const cmd = deleteNodeCommand(ctx, 's1', false);

    cmd.execute();
    expect(getNodes().map(n => n.id)).toEqual(['c1']);
    expect(getNodes()[0].parentNode).toBeUndefined();

    cmd.undo();
    const restored = getNodes();
    expect(restored.map(n => n.id).sort()).toEqual(['c1', 's1']);
    expect(restored.find(n => n.id === 'c1')?.parentNode).toBe('s1');
  });
});

describe('deleteElementsCommand', () => {
  it('batch-deletes nodes and their edges as one command', () => {
    const nodes = [node('a'), node('b'), node('c')];
    const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b' }, { id: 'e2', source: 'b', target: 'c' }];
    const { ctx, getNodes, getEdges } = makeCtx(nodes, edges);
    const cmd = deleteElementsCommand(ctx, ['a', 'b']);

    cmd.execute();
    expect(getNodes().map(n => n.id)).toEqual(['c']);
    expect(getEdges()).toEqual([]);

    cmd.undo();
    expect(getNodes().map(n => n.id).sort()).toEqual(['a', 'b', 'c']);
    expect(getEdges().map(e => e.id).sort()).toEqual(['e1', 'e2']);
  });
});

describe('moveNodesCommand', () => {
  it('applies the target transform on execute and reverts on undo', () => {
    const { ctx, getNodes } = makeCtx([node('a', { position: { x: 0, y: 0 } })], []);
    const from = { position: { x: 0, y: 0 }, parentNode: undefined, extent: undefined };
    const to = { position: { x: 100, y: 50 }, parentNode: 'section-1', extent: undefined };
    const cmd = moveNodesCommand(ctx, [{ id: 'a', from, to }]);

    cmd.execute();
    expect(getNodes()[0].position).toEqual({ x: 100, y: 50 });
    expect(getNodes()[0].parentNode).toBe('section-1');

    cmd.undo();
    expect(getNodes()[0].position).toEqual({ x: 0, y: 0 });
    expect(getNodes()[0].parentNode).toBeUndefined();
  });

  it('moves every node in a multi-node drag, not just the primary one', () => {
    const { ctx, getNodes } = makeCtx(
      [node('a', { position: { x: 0, y: 0 } }), node('b', { position: { x: 10, y: 10 } })],
      []
    );
    const cmd = moveNodesCommand(ctx, [
      { id: 'a', from: { position: { x: 0, y: 0 } }, to: { position: { x: 50, y: 50 } } },
      { id: 'b', from: { position: { x: 10, y: 10 } }, to: { position: { x: 60, y: 60 } } },
    ]);

    cmd.execute();
    expect(getNodes().map(n => n.position)).toEqual([{ x: 50, y: 50 }, { x: 60, y: 60 }]);

    cmd.undo();
    expect(getNodes().map(n => n.position)).toEqual([{ x: 0, y: 0 }, { x: 10, y: 10 }]);
  });
});

describe('connectEdgeCommand', () => {
  it('adds the new edge and removes a conflicting branch edge; undo restores both', () => {
    const existing: Edge = { id: 'e-old', source: 'cond', target: 'x', sourceHandle: 'true' };
    const { ctx, getEdges } = makeCtx([], [existing]);
    const newEdge: Edge = { id: 'e-new', source: 'cond', target: 'y', sourceHandle: 'true' };
    const cmd = connectEdgeCommand(ctx, newEdge, existing);

    cmd.execute();
    expect(getEdges().map(e => e.id)).toEqual(['e-new']);

    cmd.undo();
    expect(getEdges().map(e => e.id)).toEqual(['e-old']);
  });
});

describe('reconnectEdgeCommand', () => {
  it('retargets the edge and restores it on undo', () => {
    const oldEdge: Edge = { id: 'e1', source: 'a', target: 'b' };
    const { ctx, getEdges } = makeCtx([], [oldEdge]);
    const cmd = reconnectEdgeCommand(ctx, oldEdge, { source: 'a', target: 'c', sourceHandle: null, targetHandle: null });

    cmd.execute();
    expect(getEdges()[0].target).toBe('c');

    cmd.undo();
    expect(getEdges()[0]).toEqual(oldEdge);
  });
});

describe('deleteEdgeCommand', () => {
  it('removes and restores a single edge', () => {
    const edge: Edge = { id: 'e1', source: 'a', target: 'b' };
    const { ctx, getEdges } = makeCtx([], [edge]);
    const cmd = deleteEdgeCommand(ctx, 'e1');

    cmd.execute();
    expect(getEdges()).toEqual([]);

    cmd.undo();
    expect(getEdges()).toEqual([edge]);
  });
});

describe('updateNodeCommand', () => {
  it('applies and reverts an arbitrary patch function', () => {
    const { ctx, getNodes } = makeCtx([node('a', { data: { label: 'A', content: '' } })], []);
    const cmd = updateNodeCommand(ctx, 'a', (n) => ({ ...n, data: { ...n.data, label: 'B' } }));

    cmd.execute();
    expect(getNodes()[0].data.label).toBe('B');

    cmd.undo();
    expect(getNodes()[0].data.label).toBe('A');
  });
});

describe('updateEdgeCommand', () => {
  it('applies and reverts an arbitrary patch function', () => {
    const edge: Edge = { id: 'e1', source: 'a', target: 'b', label: 'old' };
    const { ctx, getEdges } = makeCtx([], [edge]);
    const cmd = updateEdgeCommand(ctx, 'e1', (e) => ({ ...e, label: 'new' }));

    cmd.execute();
    expect(getEdges()[0].label).toBe('new');

    cmd.undo();
    expect(getEdges()[0].label).toBe('old');
  });
});
