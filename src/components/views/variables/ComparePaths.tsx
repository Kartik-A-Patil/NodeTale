import { useMemo, useState } from 'react';
import { Simulator, StateAnalysis, Values, formatValue, valuesEqual } from '../../../core/sim/simulate';
import { StoryGraph } from '../../../core/graph/storyGraph';
import { FocusNode } from '../shared';
import { focusRing } from '../../ui/styles';

interface ComparePathsProps {
  sim: Simulator;
  graph: StoryGraph;
  analysis: StateAnalysis;
  initial: Values;
  onFocusNode: FocusNode;
}

interface Pick {
  nodeId: string;
  variant: number;
}

interface Step {
  nodeId: string;
  changed: string[];
  before: Values;
  after: Values;
}

function replay(sim: Simulator, analysis: StateAnalysis, initial: Values, pick: Pick): { steps: Step[]; final: Values } | null {
  const entry = analysis.byNode.get(pick.nodeId);
  const route = entry?.routes[Math.min(pick.variant, (entry?.routes.length ?? 1) - 1)];
  if (!route) return null;
  const steps: Step[] = [];
  let values = initial;
  for (const nodeId of route) {
    const r = sim.step(nodeId, values);
    steps.push({ nodeId, changed: r.changed, before: values, after: r.after });
    values = r.after;
  }
  return { steps, final: values };
}

const select = `h-8 w-full rounded-md border border-nt-line-strong bg-nt-bg px-2 text-xs text-nt-ink-2 ${focusRing}`;

// Two outcomes side by side: where their routes split, and how every
// variable ends up differing.
export function ComparePaths({ sim, graph, analysis, initial, onFocusNode }: ComparePathsProps) {
  // Outcomes to choose from: endings first (in story order), then every other reached scene.
  const options = useMemo(() => {
    const reached = graph.order.filter((id) => analysis.byNode.has(id));
    const endings = reached.filter((id) => graph.endings.includes(id));
    return [...endings, ...reached.filter((id) => !endings.includes(id))];
  }, [graph, analysis]);

  // Default: two different endings; else two routes to the same outcome; else any other scene.
  const defaults = (): [Pick, Pick] => {
    const first = options[0];
    const otherEnding = options.find((id) => id !== first && graph.endings.includes(id));
    if (otherEnding) return [{ nodeId: first, variant: 0 }, { nodeId: otherEnding, variant: 0 }];
    if ((analysis.byNode.get(first)?.routes.length ?? 0) > 1) return [{ nodeId: first, variant: 0 }, { nodeId: first, variant: 1 }];
    return [{ nodeId: first, variant: 0 }, { nodeId: options[1] ?? first, variant: 0 }];
  };
  const [picks, setPicks] = useState<[Pick, Pick] | null>(null);
  const [a, b] = picks ?? defaults();

  const left = useMemo(() => (a ? replay(sim, analysis, initial, a) : null), [sim, analysis, initial, a]);
  const right = useMemo(() => (b ? replay(sim, analysis, initial, b) : null), [sim, analysis, initial, b]);

  if (options.length === 0 || !left || !right) {
    return <p className="p-6 text-sm text-nt-ink-3">Name a scene “Start” and connect a few scenes to compare routes.</p>;
  }

  const split = left.steps.findIndex((s, i) => s.nodeId !== right.steps[i]?.nodeId);
  const splitAt = split === -1 ? Math.min(left.steps.length, right.steps.length) : split;
  const label = (id: string) => graph.nodes.get(id)?.label ?? 'Scene';
  const differing = sim.variables.filter((v) => !valuesEqual(left.final[v.name], right.final[v.name]));

  const renderPicker = (side: 0 | 1, pick: Pick) => {
    const variants = analysis.byNode.get(pick.nodeId)?.routes.length ?? 1;
    const set = (next: Pick) => setPicks((prev) => {
      const pair: [Pick, Pick] = [...(prev ?? [a, b])] as [Pick, Pick];
      pair[side] = next;
      return pair;
    });
    return (
      <div className="flex min-w-0 flex-1 gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Outcome {side === 0 ? 'A' : 'B'}</span>
          <select className={select} value={pick.nodeId} onChange={(e) => set({ nodeId: e.target.value, variant: 0 })}>
            {options.map((id) => <option key={id} value={id}>{label(id)}{graph.endings.includes(id) ? ' (ending)' : ''}</option>)}
          </select>
        </label>
        {variants > 1 && (
          <label className="w-40 shrink-0">
            <span className="sr-only">Which route</span>
            <select className={select} value={pick.variant} onChange={(e) => set({ ...pick, variant: Number(e.target.value) })}>
              {Array.from({ length: variants }, (_, i) => <option key={i} value={i}>Route {i + 1} of {variants}</option>)}
            </select>
          </label>
        )}
      </div>
    );
  };

  const renderColumn = (steps: Step[], tone: string) => (
    <ol className="space-y-1">
      {steps.map((s, i) => (
        <li key={`${s.nodeId}:${i}`}>
          <button type="button" onClick={() => onFocusNode(s.nodeId)}
            className={`w-full rounded-md border px-3 py-2 text-left hover:bg-nt-raised ${focusRing} ${i >= splitAt ? tone : 'border-transparent'}`}>
            <span className="text-sm text-nt-ink">{label(s.nodeId)}</span>
            {s.changed.length > 0 && (
              <span className="mt-0.5 block font-mono text-[11px] text-nt-accent">
                {s.changed.map((n) => `${n} ${formatValue(s.before[n], 10)} → ${formatValue(s.after[n], 10)}`).join(' · ')}
              </span>
            )}
          </button>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex min-w-0 flex-1 items-center gap-2"><span className="w-5 shrink-0 text-center text-sm font-semibold text-nt-ink-2">A</span>{renderPicker(0, a)}</div>
          <div className="flex min-w-0 flex-1 items-center gap-2"><span className="w-5 shrink-0 text-center text-sm font-semibold text-nt-ink-2">B</span>{renderPicker(1, b)}</div>
        </div>

        <p className="mt-4 text-sm text-nt-ink-2">
          {splitAt === 0 ? 'The routes differ from the first scene.' : `Both routes share the first ${splitAt} ${splitAt === 1 ? 'scene' : 'scenes'}, then split after “${label(left.steps[splitAt - 1].nodeId)}”.`}
          {' '}{differing.length === 0 ? 'They end with identical values.' : `${differing.length} ${differing.length === 1 ? 'variable ends' : 'variables end'} differently.`}
        </p>

        <table className="mt-4 w-full border-separate border-spacing-0 overflow-hidden rounded-lg border border-nt-line text-sm">
          <thead>
            <tr className="bg-nt-surface text-left text-xs text-nt-ink-3">
              <th scope="col" className="px-3 py-2 font-medium">Variable</th>
              <th scope="col" className="px-3 py-2 font-medium">At the end of A</th>
              <th scope="col" className="px-3 py-2 font-medium">At the end of B</th>
            </tr>
          </thead>
          <tbody>
            {sim.variables.map((v) => {
              const diff = !valuesEqual(left.final[v.name], right.final[v.name]);
              return (
                <tr key={v.id} className={diff ? 'bg-nt-accent/10' : undefined}>
                  <th scope="row" className="border-t border-nt-line px-3 py-2 text-left font-mono text-xs font-normal text-nt-ink-2">
                    {v.name}{diff && <span className="sr-only"> (differs)</span>}
                  </th>
                  <td className={`border-t border-nt-line px-3 py-2 font-mono text-xs ${diff ? 'text-nt-ink' : 'text-nt-ink-3'}`}>{formatValue(left.final[v.name], 30)}</td>
                  <td className={`border-t border-nt-line px-3 py-2 font-mono text-xs ${diff ? 'text-nt-ink' : 'text-nt-ink-3'}`}>{formatValue(right.final[v.name], 30)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <section aria-label="Route A">
            <h3 className="mb-2 text-xs font-medium text-nt-ink-3">Route A · {left.steps.length} scenes</h3>
            {renderColumn(left.steps, 'border-nt-line-strong')}
          </section>
          <section aria-label="Route B">
            <h3 className="mb-2 text-xs font-medium text-nt-ink-3">Route B · {right.steps.length} scenes</h3>
            {renderColumn(right.steps, 'border-nt-line-strong')}
          </section>
        </div>
        <p className="mt-3 text-xs text-nt-ink-3">Scenes after the split are outlined. Click a scene to open it on the canvas.</p>
      </div>
    </div>
  );
}
