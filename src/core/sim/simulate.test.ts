import { describe, expect, it } from 'vitest';
import { Edge } from 'reactflow';
import { AppNode, Project } from '../../types';
import { analyzeStates, createSimulator, summarizeValues } from './simulate';

const el = (id: string, label: string, script = ''): AppNode =>
  ({ id, type: 'elementNode', position: { x: 0, y: 0 }, data: { label, content: script ? `<p>${label}</p><pre>${script}</pre>` : `<p>${label}</p>` } }) as AppNode;
const cond = (id: string, condition: string): AppNode =>
  ({ id, type: 'conditionNode', position: { x: 0, y: 0 }, data: { label: 'Check', branches: [{ id: 'yes', label: 'If', condition }, { id: 'no', label: 'Else', condition: '' }] } }) as AppNode;
const edge = (source: string, target: string, sourceHandle?: string): Edge => ({ id: `${source}-${target}-${sourceHandle ?? ''}`, source, target, sourceHandle });

const project = (nodes: AppNode[], edges: Edge[]): Project => ({
  id: 'p', name: 'P', activeBoardId: 'b', assets: [], folders: [],
  variables: [
    { id: 'g', name: 'gold', type: 'number', value: 0 },
    { id: 'k', name: 'hasKey', type: 'boolean', value: false },
  ],
  boards: [{ id: 'b', name: 'Main', nodes, edges }],
} as unknown as Project);

// Start → (shop: gold += 5 | cave: hasKey = true) → gate: hasKey? → vault : locked
const story = project(
  [el('s', 'Start'), el('shop', 'Shop', 'gold += 5'), el('cave', 'Cave', 'hasKey = true'), el('hub', 'Hub'), cond('gate', 'hasKey == true'), el('vault', 'Vault', 'gold += 100'), el('locked', 'Locked out')],
  [edge('s', 'shop'), edge('s', 'cave'), edge('shop', 'hub'), edge('cave', 'hub'), edge('hub', 'gate'), edge('gate', 'vault', 'yes'), edge('gate', 'locked', 'no')],
);

describe('createSimulator.step', () => {
  it('runs scene scripts and reports what changed', () => {
    const sim = createSimulator(story);
    const r = sim.step('shop', sim.initialValues());
    expect(r.after).toEqual({ gold: 5, hasKey: false });
    expect(r.changed).toEqual(['gold']);
    expect(r.next.map((t) => t.target)).toEqual(['hub']);
  });

  it('takes the branch the runtime would', () => {
    const sim = createSimulator(story);
    expect(sim.step('gate', { gold: 0, hasKey: true }).next[0]).toMatchObject({ target: 'vault', kind: 'branch', label: 'If hasKey == true' });
    expect(sim.step('gate', { gold: 0, hasKey: false }).branchTaken?.id).toBe('no');
  });
});

describe('analyzeStates', () => {
  it('finds every state each scene can be reached with', () => {
    const a = analyzeStates(story);
    const hub = a.byNode.get('hub')!;
    expect(hub.states).toEqual(expect.arrayContaining([{ gold: 5, hasKey: false }, { gold: 0, hasKey: true }]));
    expect(hub.states).toHaveLength(2);
    expect(a.byNode.get('gate')!.branchCounts).toEqual({ yes: 1, no: 1 });
    // The vault is only reached having visited the cave, so gold is exactly 100 there.
    expect(a.byNode.get('vault')!.states).toEqual([{ gold: 100, hasKey: true }]);
    expect(a.byNode.get('vault')!.routes[0]).toEqual(['s', 'cave', 'hub', 'gate', 'vault']);
  });

  it('flags a condition that can never be true', () => {
    const noKey = project([el('s', 'Start'), cond('gate', 'hasKey == true'), el('vault', 'Vault'), el('locked', 'Locked')],
      [edge('s', 'gate'), edge('gate', 'vault', 'yes'), edge('gate', 'locked', 'no')]);
    const a = analyzeStates(noKey);
    expect(a.byNode.get('gate')!.branchCounts).toEqual({ no: 1 });
    expect(a.byNode.has('vault')).toBe(false);
  });

  it('terminates on loops that keep changing state, marking results incomplete', () => {
    const loop = project([el('s', 'Start'), el('farm', 'Farm', 'gold += 1')], [edge('s', 'farm'), edge('farm', 'farm')]);
    const a = analyzeStates(loop);
    expect(a.incomplete).toBe(true);
    expect(a.byNode.get('farm')!.truncated).toBe(true);
  });

  it('explores a loop without state change once', () => {
    const loop = project([el('s', 'Start'), el('a', 'A'), el('b', 'B')], [edge('s', 'a'), edge('a', 'b'), edge('b', 'a')]);
    expect(analyzeStates(loop).incomplete).toBe(false);
  });
});

describe('summarizeValues', () => {
  it('describes value sets compactly', () => {
    expect(summarizeValues([5, 5]).text).toBe('5');
    expect(summarizeValues([5, 5]).fixed).toBe(true);
    expect(summarizeValues([0, 5]).text).toBe('0, 5');
    expect(summarizeValues([1, 9, 4, 7]).text).toBe('1 – 9');
    expect(summarizeValues([true, false]).text).toBe('true or false');
  });
});
