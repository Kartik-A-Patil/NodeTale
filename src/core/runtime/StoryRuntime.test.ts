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

describe('player feedback', () => {
  it('reports what a choice changed and remembers taken choices', () => {
    const rt = new StoryRuntime(project(
      [scene('s', 'Start'), scene('b', 'Bought', '<pre>gold += 5</pre>')],
      [{ id: 'buy', source: 's', target: 'b', data: { effect: 'gold += 10' } }, { id: 'home', source: 'b', target: 's' }],
    ));
    rt.choose('buy');
    expect(rt.getState().changes).toEqual([{ name: 'gold', before: 0, after: 15 }]);
    expect(rt.getState().turn).toBe(1);
    rt.choose('home');
    expect(rt.getState().changes).toEqual([]);
    expect(rt.getOptions()[0].visited).toBe(true);
    rt.back();
    expect(rt.getState().changes).toEqual([]);
    rt.restart();
    expect(rt.getOptions()[0].visited).toBe(false);
  });
});

describe('log, rewind and saves', () => {
  const story = () => project(
    [scene('s', 'Start'), scene('h', 'Hall', '<pre>gold += 5</pre>'), scene('c', 'Cellar', '<pre>gold += 1</pre>')],
    [
      { id: 'e1', source: 's', target: 'h', label: 'Go in', data: { manualLabel: true, timeout: 8 } },
      { id: 'e2', source: 'h', target: 'c' },
    ],
  );

  it('logs scenes with the choice made, and rewinds to any of them', () => {
    const rt = new StoryRuntime(story());
    expect(rt.getOptions()[0].timeout).toBe(8);
    rt.choose('e1');
    rt.choose('e2');
    expect(rt.getLog()).toEqual([
      { index: 0, nodeId: 's', label: 'Start', choice: 'Go in' },
      { index: 1, nodeId: 'h', label: 'Hall', choice: 'Cellar' },
      { index: -1, nodeId: 'c', label: 'Cellar' },
    ]);
    rt.rewindTo(0);
    expect(rt.getState()).toMatchObject({ currentNode: { id: 's' }, values: { gold: 0 } });
    expect(rt.getLog()).toHaveLength(1);
  });

  it('saves and resumes a playthrough, refusing one the story no longer fits', () => {
    const rt = new StoryRuntime(story());
    rt.choose('e1');
    const save = JSON.parse(JSON.stringify(rt.snapshot()));
    const other = new StoryRuntime(story());
    expect(other.restore(save)).toBe(true);
    expect(other.getState()).toMatchObject({ currentNode: { id: 'h' }, values: { gold: 5 } });
    other.back();
    expect(other.getState().currentNode?.id).toBe('s');
    expect(other.getOptions()[0].visited).toBe(true);
    const edited = project([scene('s', 'Start')], []);
    const stale = new StoryRuntime(edited);
    expect(stale.restore(save)).toBe(false);
    expect(stale.getState().currentNode?.id).toBe('s');
  });
});

describe('debugger', () => {
  it('traces script lines, branches and choice effects since the last choice', () => {
    const cond = { id: 'k', type: 'conditionNode', position: { x: 0, y: 0 },
      data: { label: 'Rich?', branches: [{ id: 'y', label: 'If', condition: 'gold > 10' }, { id: 'n', label: 'Else', condition: '' }] } } as any;
    const rt = new StoryRuntime(project(
      [scene('s', 'Start'), scene('h', 'Hall', '<pre>gold += 5\nif (gold > 100) {\n  gold = 0\n}</pre>'), cond, scene('r', 'Rich'), scene('p', 'Poor')],
      [
        { id: 'e1', source: 's', target: 'h', data: { effect: 'gold += 3' } },
        { id: 'e2', source: 'h', target: 'k' },
        { id: 'e3', source: 'k', target: 'r', sourceHandle: 'y' }, { id: 'e4', source: 'k', target: 'p', sourceHandle: 'n' },
      ],
    ));
    rt.choose('e1');
    expect(rt.getState().trace.map((t) => [t.source, t.nodeId, t.line, t.text, t.note])).toEqual([
      ['choice', 's', 1, 'gold += 3', 'gold: 0 → 3'],
      ['script', 'h', 1, 'gold += 5', 'gold: 3 → 8'],
      ['script', 'h', 2, 'if (gold > 100) {', 'false'],
    ]);
    rt.choose('e2');
    expect(rt.getState().trace.map((t) => [t.source, t.text, t.note])).toEqual([
      ['branch', 'If gold > 10', 'false'],
      ['branch', 'Else', 'taken'],
    ]);
    expect(rt.getState().currentNode?.id).toBe('p');
  });

  it('edits a value mid-play and restarts with chosen starting values', () => {
    const rt = new StoryRuntime(project(
      [scene('s', 'Start'), scene('b', 'Bought')],
      [{ id: 'buy', source: 's', target: 'b', data: { condition: 'gold >= 50' } }],
    ));
    expect(rt.getOptions()[0].locked).toBe(true);
    rt.setValue('gold', 60);
    expect(rt.getOptions()[0].locked).toBeFalsy();
    rt.restart({ gold: 99 });
    expect(rt.getState().values.gold).toBe(99);
    rt.restart();
    expect(rt.getState().values.gold).toBe(99);
  });
});

describe('set values node', () => {
  const setNode = (changes: any[]) => ({ id: 'v', type: 'setNode', position: { x: 0, y: 0 }, data: { label: 'Who are you?', changes } }) as any;
  const story = (changes: any[]) => {
    const p = project(
      [scene('s', 'Start'), setNode(changes), scene('h', 'Hall', '<p>Hi</p>')],
      [{ id: 'e1', source: 's', target: 'v' }, { id: 'e2', source: 'v', target: 'h' }],
    );
    p.variables.push({ id: 'n', name: 'name', type: VariableType.STRING, value: '' } as any);
    return p;
  };

  it('applies fixed changes on the way through and labels the choice by the next scene', () => {
    const rt = new StoryRuntime(story([{ id: 'a', variable: 'gold', op: 'add', value: 7 }]));
    expect(rt.getOptions()[0].label).toBe('Hall');
    rt.choose('e1');
    expect(rt.getState()).toMatchObject({ currentNode: { id: 'h' }, values: { gold: 7 }, asking: null });
  });

  it('stops to ask, applies the answers, and Back returns to the question', () => {
    const rt = new StoryRuntime(story([
      { id: 'a', variable: 'gold', op: 'add', value: 1 },
      { id: 'q', variable: 'name', op: 'set', ask: 'Your name?' },
    ]));
    rt.choose('e1');
    expect(rt.getState().currentNode?.id).toBe('v');
    expect(rt.getState().asking).toEqual([{ id: 'q', question: 'Your name?', variable: 'name', type: 'string' }]);
    expect(rt.getState().values.gold).toBe(0); // nothing runs before the answer
    rt.answer({ q: 'Alex' });
    expect(rt.getState()).toMatchObject({ currentNode: { id: 'h' }, values: { gold: 1, name: 'Alex' }, asking: null });
    expect(rt.getState().changes.map((c) => c.name)).toEqual(['gold', 'name']);
    expect(rt.getLog().map((e) => [e.label, e.choice])).toEqual([['Start', 'Who are you?'], ['Who are you?', 'name: Alex'], ['Hall', undefined]]);
    rt.back();
    expect(rt.getState()).toMatchObject({ currentNode: { id: 'v' }, values: { gold: 0, name: '' } });
    expect(rt.getState().asking).toHaveLength(1);
  });
});
