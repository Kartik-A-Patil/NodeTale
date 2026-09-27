import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Project, SimulationPreset } from '../../../models/story';
import { StoryGraph } from '../../../core/graph/storyGraph';
import { analyzeStates, createSimulator, formatValue, branchLabel, Values } from '../../../core/sim/simulate';
import { buildStateTree, pathTo, DEFAULT_TREE_BUDGET } from '../../../core/sim/stateTree';
import { findProblems } from '../../../core/sim/problems';
import { useLocalPref } from '../../../utils/localPrefs';
import { FocusNode, ViewFrame } from '../shared';
import { focusRing } from '../../ui/styles';
import { ScenarioPanel } from './ScenarioPanel';
import { StateTreeCanvas } from './StateTreeCanvas';
import { ProblemsPanel } from './ProblemsPanel';
import { ComparePaths } from './ComparePaths';
import { UsageMatrix } from './UsageMatrix';

type Tab = 'tree' | 'problems' | 'compare' | 'usage';

interface VariablesViewProps {
  graph: StoryGraph;
  project: Project;
  onFocusNode: FocusNode;
  onUpdateProject: (update: (project: Project) => Project) => void;
}

export default function VariablesView({ graph, project, onFocusNode, onUpdateProject }: VariablesViewProps) {
  const [tab, setTab] = useLocalPref<Tab>('nodetale:variables:tab', 'tree');
  const [overrides, setOverrides] = useState<Values>({});
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  // Opt-in: boxes show only what changed unless the author watches a variable.
  const [watch, setWatch] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [budget, setBudget] = useState(DEFAULT_TREE_BUDGET);
  const controlsRef = useRef<{ fit: () => void; zoomBy: (k: number) => void } | null>(null);

  // Typing a starting value shouldn't block on re-simulating the story.
  const scenario = useDeferredValue(overrides);
  const sim = useMemo(() => createSimulator(project), [project]);
  const initial = useMemo(() => sim.initialValues(scenario), [sim, scenario]);
  const analysis = useMemo(() => analyzeStates(project, scenario), [project, scenario]);
  const problems = useMemo(() => findProblems(project, graph, analysis), [project, graph, analysis]);
  const tree = useMemo(() => (tab === 'tree' ? buildStateTree(sim, initial, budget) : null), [tab, sim, initial, budget]);


  const presets = project.simulationPresets ?? [];
  const selectPreset = (id: string | null) => {
    setActivePresetId(id);
    setOverrides(id ? { ...(presets.find((p) => p.id === id)?.values ?? {}) } : {});
  };
  const savePreset = (name: string) => {
    const preset: SimulationPreset = { id: crypto.randomUUID(), name, values: overrides };
    onUpdateProject((p) => ({ ...p, simulationPresets: [...(p.simulationPresets ?? []), preset] }));
    setActivePresetId(preset.id);
  };
  const deletePreset = (id: string) => {
    onUpdateProject((p) => ({ ...p, simulationPresets: (p.simulationPresets ?? []).filter((x) => x.id !== id) }));
    setActivePresetId(null);
  };

  const showInTree = (nodeId: string) => {
    const built = buildStateTree(sim, initial, budget);
    const first = [...built.byKey.values()].find((n) => n.nodeId === nodeId && n.kind === 'scene');
    setTab('tree');
    if (first) setSelectedKey(first.key);
  };

  const selected = tree && selectedKey ? tree.byKey.get(selectedKey) : undefined;
  const route = tree && selected ? pathTo(tree, selected.key) : [];
  const label = (id: string) => sim.node(id)?.node.data?.label || graph.nodes.get(id)?.label || 'Scene';

  const tabs: { id: Tab; text: string }[] = [
    { id: 'tree', text: 'State tree' },
    { id: 'problems', text: `Problems${problems.length ? ` (${problems.length})` : ''}` },
    { id: 'compare', text: 'Compare paths' },
    { id: 'usage', text: 'Where used' },
  ];
  const hasErrors = problems.some((p) => p.severity === 'error');
  const tabBar = (
    <div role="tablist" aria-label="Variables" className="-mb-3 flex gap-5">
      {tabs.map((t) => {
        const active = tab === t.id;
        return (
          <button key={t.id} type="button" role="tab" aria-selected={active} onClick={() => setTab(t.id)}
            className={`relative pb-3 text-sm transition-colors duration-150 ${focusRing} ${
              active ? 'font-semibold text-nt-ink' : `font-medium ${t.id === 'problems' && hasErrors ? 'text-nt-danger' : 'text-nt-ink-3'} hover:text-nt-ink-2`
            }`}>
            {t.text}
            {active && <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-nt-accent" />}
          </button>
        );
      })}
    </div>
  );

  const summary = tab === 'tree' && tree
    ? `${tree.size} ${tree.size === 1 ? 'state' : 'states'} from Start${tree.truncated ? ' so far' : ''}${watch.length ? ` · showing ${watch.join(', ')}` : ''}`
    : tab === 'problems' ? `${problems.length} found with these starting values`
    : tab === 'compare' ? 'Two outcomes, side by side'
    : `${project.variables.length} ${project.variables.length === 1 ? 'variable' : 'variables'}`;

  const selectedPanel = selected && selected.kind === 'scene' && (
    <div className="mb-6 border-b border-nt-line pb-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-nt-ink">{label(selected.nodeId)}</h3>
        <button type="button" onClick={() => onFocusNode(selected.nodeId)} title="Open on canvas" aria-label="Open on canvas"
          className={`-mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-nt-ink-3 hover:bg-nt-raised hover:text-nt-ink ${focusRing}`}>
          <ExternalLink size={14} />
        </button>
      </div>
      <p className="mt-1 text-nt-ink-3">
        {route.map((n) => label(n.nodeId)).join(' → ')}
      </p>
      {selected.branchTaken && <p className="mt-2 text-nt-ink-2">Takes <span className="font-mono">{branchLabel(selected.branchTaken)}</span></p>}
      {selected.noBranch && <p className="mt-2 text-nt-danger">No branch matches these values. The story stops here.</p>}
      {selected.error && <p className="mt-2 text-nt-danger">Script error: {selected.error}</p>}
      <table className="mt-3 w-full text-left">
        <caption className="sr-only">Variable values at this point</caption>
        <tbody>
          {sim.variables.map((v) => {
            const changed = selected.changed.includes(v.name);
            return (
              <tr key={v.id}>
                <th scope="row" className="py-1 pr-2 align-top font-mono font-normal text-nt-ink-2">{v.name}</th>
                <td className={`py-1 font-mono ${changed ? 'text-nt-accent' : 'text-nt-ink'}`}>
                  {changed && <span className="text-nt-ink-3">{formatValue(selected.before[v.name], 12)} → </span>}
                  {formatValue(selected.after[v.name], 16)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const aside = (
    <>
      {tab === 'tree' && selectedPanel}
      <ScenarioPanel
        variables={sim.variables}
        overrides={overrides}
        onOverrides={(next) => {
          setOverrides(next);
          const active = presets.find((p) => p.id === activePresetId);
          if (active && JSON.stringify(active.values) !== JSON.stringify(next)) setActivePresetId(null);
        }}
        presets={presets}
        activePresetId={activePresetId}
        onSelectPreset={selectPreset}
        onSavePreset={savePreset}
        onDeletePreset={deletePreset}
        watch={watch}
        setByStart={graph.startId ? graph.variableUse.get(graph.startId)?.set ?? new Set() : new Set()}
        onToggleWatch={(name) => setWatch(watch.includes(name) ? watch.filter((w) => w !== name) : [...watch, name])}
      />
    </>
  );

  return (
    <ViewFrame
      title="Variables"
      tabs={tabBar}
      summary={summary}
      onFit={tab === 'tree' ? () => controlsRef.current?.fit() : undefined}
      onZoom={tab === 'tree' ? (k) => controlsRef.current?.zoomBy(k) : undefined}
      aside={aside}
      asideClassName="w-72"
    >
      {tab === 'tree' && tree && (
        <StateTreeCanvas tree={tree} sim={sim} graph={graph} watch={watch} selectedKey={selectedKey}
          onSelect={setSelectedKey} onShowMore={() => setBudget((b) => b + DEFAULT_TREE_BUDGET)} controlsRef={controlsRef} />
      )}
      {tab === 'problems' && <ProblemsPanel problems={problems} analysis={analysis} onFocusNode={onFocusNode} onShowInTree={showInTree} />}
      {tab === 'compare' && <ComparePaths sim={sim} graph={graph} analysis={analysis} initial={initial} onFocusNode={onFocusNode} />}
      {tab === 'usage' && <UsageMatrix graph={graph} variables={project.variables} analysis={analysis} onFocusNode={onFocusNode} />}
    </ViewFrame>
  );
}
