import { describe, it, expect } from 'vitest';
import { StoryRuntime } from './StoryRuntime';
import { stripScriptBlocks } from '../../utils/html';
import { Project, VariableType } from '../../models/story';

const scene = (id: string, label: string, content = '') =>
  ({ id, type: 'elementNode', position: { x: 0, y: 0 }, data: { label, content } }) as any;

const project = (nodes: any[], edges: any[]): Project =>
  ({
    id: 'p', name: 'p', activeBoardId: 'b', assets: [], folders: [],
    variables: [{ id: 'v', name: 'gold', type: VariableType.NUMBER, value: 0 }],
    boards: [{ id: 'b', name: 'b', nodes, edges }],
  }) as any;

describe('StoryRuntime', () => {
  it('uses a custom edge label as choice text, else the target title', () => {
    const rt = new StoryRuntime(project(
      [scene('s', 'Start'), scene('a', 'Hall'), scene('c', 'Cellar')],
      [
        { id: 'e1', source: 's', target: 'a', label: 'Open the door', data: { manualLabel: true } },
        { id: 'e2', source: 's', target: 'c', label: 'stale text', data: { manualLabel: false } },
      ],
    ));
    expect(rt.getOptions().map((o) => o.label)).toEqual(['Open the door', 'Cellar']);
  });

  it('ends on a condition with no matching branch and reports why', () => {
    const cond = { id: 'k', type: 'conditionNode', position: { x: 0, y: 0 },
      data: { label: 'Rich?', branches: [{ id: 'yes', label: 'If', condition: 'gold > 10' }] } } as any;
    const rt = new StoryRuntime(project(
      [scene('s', 'Start'), cond, scene('r', 'Rich')],
      [{ id: 'e1', source: 's', target: 'k' }, { id: 'e2', source: 'k', target: 'r', sourceHandle: 'yes' }],
    ));
    rt.choose('e1');
    const state = rt.getState();
    expect(state.currentNode?.id).toBe('k');
    expect(state.errors.at(-1)?.message).toMatch(/No branch matched/);
  });

  it('records script and condition errors instead of hiding them', () => {
    const cond = { id: 'k', type: 'conditionNode', position: { x: 0, y: 0 },
      data: { label: 'Bad', branches: [{ id: 'yes', label: 'If', condition: 'nope > 1' }, { id: 'no', label: 'Else', condition: '' }] } } as any;
    const rt = new StoryRuntime(project(
      [scene('s', 'Start', '<pre>missing = 1</pre>'), cond, scene('x', 'X')],
      [{ id: 'e1', source: 's', target: 'k' }, { id: 'e2', source: 'k', target: 'x', sourceHandle: 'no' }],
    ));
    rt.choose('e1');
    const msgs = rt.getState().errors.map((e) => e.message);
    expect(msgs[0]).toMatch(/Unknown variable: missing/);
    expect(msgs[1]).toMatch(/Condition "nope > 1"/);
    expect(rt.getState().currentNode?.id).toBe('x');
    rt.restart();
    expect(rt.getState().errors.length).toBe(1); // only the start scene's script error again
  });

  it('strips script blocks from player-facing text', () => {
    expect(stripScriptBlocks('<p>Hi</p><pre>gold += 1</pre><p>there</p>')).toBe('<p>Hi</p><p>there</p>');
  });
});

describe('choice rules', () => {
  const shop = (data: Record<string, unknown>) => project(
    [scene('s', 'Start', '<pre>gold = 30</pre>'), scene('b', 'Bought'), scene('l', 'Leave')],
    [{ id: 'buy', source: 's', target: 'b', data }, { id: 'go', source: 's', target: 'l' }],
  );

  it('locks a choice whose condition fails, with a reason, and refuses it', () => {
    const rt = new StoryRuntime(shop({ condition: 'gold >= 50' }));
    expect(rt.getOptions()[0]).toMatchObject({ label: 'Bought', locked: true, lockedReason: 'Needs gold >= 50' });
    rt.choose('buy');
    expect(rt.getState().currentNode?.id).toBe('s');
  });

  it('hides a locked choice when asked', () => {
    const rt = new StoryRuntime(shop({ condition: 'gold >= 50', hideWhenLocked: true }));
    expect(rt.getOptions().map((o) => o.edgeId)).toEqual(['go']);
  });

  it('runs a choice effect when taken, and Back undoes it', () => {
    const rt = new StoryRuntime(shop({ condition: 'gold >= 10', effect: 'gold -= 10' }));
    rt.choose('buy');
    expect(rt.getState().values.gold).toBe(20);
    rt.back();
    expect(rt.getState().values.gold).toBe(30);
    expect(rt.getOptions()[0].locked).toBeFalsy();
  });
});
