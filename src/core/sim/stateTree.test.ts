import { describe, expect, it } from 'vitest';
import { Edge } from 'reactflow';
import { AppNode, Project } from '../../types';
import { analyzeStates, createSimulator } from './simulate';
import { buildStateTree, pathTo } from './stateTree';
import { findProblems } from './problems';
import { buildStoryGraph } from '../graph/storyGraph';

const el = (id: string, label: string, script = ''): AppNode =>
  ({ id, type: 'elementNode', position: { x: 0, y: 0 }, data: { label, content: script ? `<p>${label}</p><pre>${script}</pre>` : `<p>${label}</p>` } }) as AppNode;
const cond = (id: string, condition: string, withElse = true): AppNode =>
  ({ id, type: 'conditionNode', position: { x: 0, y: 0 }, data: { label: 'Check', branches: [{ id: 'yes', label: 'If', condition }, ...(withElse ? [{ id: 'no', label: 'Else', condition: '' }] : [])] } }) as AppNode;
const edge = (source: string, target: string, sourceHandle?: string): Edge => ({ id: `${source}-${target}-${sourceHandle ?? ''}`, source, target, sourceHandle });
const project = (nodes: AppNode[], edges: Edge[]): Project => ({
  id: 'p', name: 'P', activeBoardId: 'b', assets: [], folders: [],
  variables: [{ id: 'g', name: 'gold', type: 'number', value: 0 }, { id: 'k', name: 'hasKey', type: 'boolean', value: false }],
  boards: [{ id: 'b', name: 'Main', nodes, edges }],
} as unknown as Project);

// Start → shop (gold += 5) | cave (hasKey = true) → hub → gate(hasKey) → vault | locked
const story = project(
  [el('s', 'Start'), el('shop', 'Shop', 'gold += 5'), el('cave', 'Cave', 'hasKey = true'), el('hub', 'Hub'), cond('gate', 'hasKey == true'), el('vault', 'Vault'), el('locked', 'Locked out')],
  [edge('s', 'shop'), edge('s', 'cave'), edge('shop', 'hub'), edge('cave', 'hub'), edge('hub', 'gate'), edge('gate', 'vault', 'yes'), edge('gate', 'locked', 'no')],
);

describe('buildStateTree', () => {
  it('shows the same scene once per distinct state, with the branch each state takes', () => {
    const sim = createSimulator(story);
    const tree = buildStateTree(sim, sim.initialValues());
    const [shop, cave] = tree.root!.children;
    expect(shop.after).toEqual({ gold: 5, hasKey: false });
    expect(shop.changed).toEqual(['gold']);
    // hub → gate → locked on the shop path; hub → gate → vault on the cave path
    const gateViaShop = shop.children[0].children[0];
    const gateViaCave = cave.children[0].children[0];
    expect(gateViaShop.branchTaken?.id).toBe('no');
    expect(gateViaCave.branchTaken?.id).toBe('yes');
    expect(gateViaShop.children[0].nodeId).toBe('locked');
    expect(gateViaCave.children[0].nodeId).toBe('vault');
    expect(pathTo(tree, gateViaCave.children[0].key).map((n) => n.nodeId)).toEqual(['s', 'cave', 'hub', 'gate', 'vault']);
  });

  it('marks a path that returns to a scene with identical values as a loop', () => {
    const looped = project([el('s', 'Start'), el('a', 'A'), el('b', 'B')], [edge('s', 'a'), edge('a', 'b'), edge('b', 'a')]);
    const sim = createSimulator(looped);
    const tree = buildStateTree(sim, sim.initialValues());
    const back = tree.root!.children[0].children[0].children[0];
    expect(back).toMatchObject({ nodeId: 'a', kind: 'loop', repeats: tree.root!.children[0].key });
    expect(tree.truncated).toBe(false);
  });

  it('shows a scene reached again with identical values from another path as a join', () => {
    const merge = project([el('s', 'Start'), el('a', 'A'), el('b', 'B'), el('end', 'End')], [edge('s', 'a'), edge('s', 'b'), edge('a', 'end'), edge('b', 'end')]);
    const sim = createSimulator(merge);
    const tree = buildStateTree(sim, sim.initialValues());
    const [viaA, viaB] = tree.root!.children.map((c) => c.children[0]);
    expect(viaA.kind).toBe('scene');
    expect(viaB).toMatchObject({ kind: 'join', repeats: viaA.key });
  });

  it('stops at the budget and says so', () => {
    const counter = project([el('s', 'Start'), el('inc', 'Inc', 'gold += 1')], [edge('s', 'inc'), edge('inc', 'inc')]);
    const sim = createSimulator(counter);
    const tree = buildStateTree(sim, sim.initialValues(), 20);
    expect(tree.size).toBe(20);
    expect(tree.truncated).toBe(true);
    expect([...tree.byKey.values()].some((n) => n.kind === 'more')).toBe(true);
  });

  it('uses starting-value overrides', () => {
    const sim = createSimulator(story);
    const tree = buildStateTree(sim, sim.initialValues({ hasKey: true }));
    const gateViaShop = tree.root!.children[0].children[0].children[0];
    expect(gateViaShop.branchTaken?.id).toBe('yes');
  });
});

describe('findProblems', () => {
  it('reports branches never taken and scenes never reached, per starting values', () => {
    const always = project(
      [el('s', 'Start', 'gold = 10'), cond('c', 'gold > 5'), el('rich', 'Rich'), el('poor', 'Poor')],
      [edge('s', 'c'), edge('c', 'rich', 'yes'), edge('c', 'poor', 'no')],
    );
    const problems = findProblems(always, buildStoryGraph(always), analyzeStates(always));
    expect(problems.map((p) => p.kind)).toEqual(['branch-never', 'unreached']);
    expect(problems[0].title).toContain('Else');
    expect(problems[1].nodeId).toBe('poor');
  });

  it('reports conditions where no branch matches', () => {
    const noElse = project([el('s', 'Start'), cond('c', 'gold > 5', false), el('rich', 'Rich')], [edge('s', 'c'), edge('c', 'rich', 'yes')]);
    const problems = findProblems(noElse, buildStoryGraph(noElse), analyzeStates(noElse));
    expect(problems[0].kind).toBe('no-branch');
  });
});
