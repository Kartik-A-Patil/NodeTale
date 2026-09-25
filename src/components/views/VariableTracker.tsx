import { useMemo } from 'react';
import { StoryGraph, VariableUse } from '../../core/graph/storyGraph';
import { Variable } from '../../types';
import { EmptyView, FocusNode, LegendItem, ViewFrame, truncate } from './shared';

type Issue = 'undeclared' | 'unused' | 'never-read' | 'initial-only' | null;

interface Row {
  name: string;
  variable?: Variable;
  issue: Issue;
}

const ISSUE_TEXT: Record<Exclude<Issue, null>, { text: string; tone: string }> = {
  undeclared: { text: 'Not declared: add it under Variables', tone: 'text-nt-danger' },
  unused: { text: 'Never used', tone: 'text-nt-ink-3' },
  'never-read': { text: 'Set but never checked or shown', tone: 'text-nt-ink-2' },
  'initial-only': { text: 'Only uses its starting value', tone: 'text-nt-ink-3' },
};

const valuePreview = (v: Variable) =>
  typeof v.value === 'object' ? v.type : `${v.type} · ${v.value === '' ? '""' : truncate(String(v.value), 14)}`;

// One cell's marks: set = filled square, checked = outlined square, shown = dot.
const Marks = ({ use, name }: { use: VariableUse | undefined; name: string }) => {
  const set = use?.set.has(name);
  const checked = use?.checked.has(name);
  const shown = use?.shown.has(name);
  if (!set && !checked && !shown) return null;
  return (
    <svg width="42" height="14" aria-hidden className="mx-auto block">
      {set && <rect x="2" y="2" width="10" height="10" rx="2" fill="oklch(var(--nt-accent))" />}
      {checked && <rect x="16.5" y="2.5" width="9" height="9" rx="2" fill="none" stroke="oklch(var(--nt-branch-0))" strokeWidth="1.8" />}
      {shown && <circle cx="35" cy="7" r="3.5" fill="oklch(var(--nt-ink-2))" />}
    </svg>
  );
};

const describe = (use: VariableUse | undefined, name: string) =>
  [use?.set.has(name) && 'set', use?.checked.has(name) && 'checked', use?.shown.has(name) && 'shown in text'].filter(Boolean).join(', ');

export default function VariableTracker({ graph, variables, onFocusNode }: { graph: StoryGraph; variables: Variable[]; onFocusNode: FocusNode }) {
  const { rows, columns } = useMemo(() => {
    const uses = graph.variableUse;
    const touching = (id: string) => {
      const u = uses.get(id);
      return !!u && (u.set.size > 0 || u.checked.size > 0 || u.shown.size > 0);
    };
    // Story order first, then scenes Start can't reach.
    const columns = [...graph.order, ...graph.unreachable].filter(touching);
    const declared = new Set(variables.map((v) => v.name));
    const setAnywhere = new Set<string>();
    const readAnywhere = new Set<string>();
    for (const u of uses.values()) {
      u.set.forEach((n) => setAnywhere.add(n));
      u.checked.forEach((n) => readAnywhere.add(n));
      u.shown.forEach((n) => readAnywhere.add(n));
    }
    const issueOf = (name: string): Issue => {
      if (!declared.has(name)) return 'undeclared';
      const set = setAnywhere.has(name);
      const read = readAnywhere.has(name);
      if (!set && !read) return 'unused';
      if (set && !read) return 'never-read';
      if (!set && read) return 'initial-only';
      return null;
    };
    const undeclared = [...new Set([...setAnywhere, ...readAnywhere])].filter((n) => !declared.has(n)).sort();
    const rows: Row[] = [
      ...variables.map((v) => ({ name: v.name, variable: v, issue: issueOf(v.name) })),
      ...undeclared.map((name) => ({ name, issue: 'undeclared' as const })),
    ];
    return { rows, columns };
  }, [graph, variables]);

  const problems = rows.filter((r) => r.issue === 'undeclared' || r.issue === 'unused' || r.issue === 'never-read').length;
  const summary = `${variables.length} ${variables.length === 1 ? 'variable' : 'variables'} · used in ${columns.length} ${columns.length === 1 ? 'scene' : 'scenes'}${problems ? ` · ${problems} to review` : ''}`;
  const legend = (
    <>
      <LegendItem swatch={<rect x="2" y="2" width="10" height="10" rx="2" fill="oklch(var(--nt-accent))" />}>set in a script</LegendItem>
      <LegendItem swatch={<rect x="2.5" y="2.5" width="9" height="9" rx="2" fill="none" stroke="oklch(var(--nt-branch-0))" strokeWidth="1.8" />}>checked in a condition or script</LegendItem>
      <LegendItem swatch={<circle cx="7" cy="7" r="3.5" fill="oklch(var(--nt-ink-2))" />}>shown in text as {'{{name}}'}</LegendItem>
    </>
  );

  if (rows.length === 0) {
    return (
      <ViewFrame title="Variables">
        <EmptyView title="No variables yet">
          Add variables in the sidebar, then set them in a scene’s code block and check them in a Branch. This view shows where each one is set, checked and shown, and flags ones that are never used.
        </EmptyView>
      </ViewFrame>
    );
  }

  return (
    <ViewFrame title="Variables" summary={summary} legend={legend}>
      <div className="h-full overflow-auto">
        <table className="border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 top-0 z-20 min-w-[260px] border-b border-r border-nt-line bg-nt-bg px-4 py-3 text-left align-bottom font-semibold text-nt-ink">
                Variable
              </th>
              {columns.map((id) => {
                const node = graph.nodes.get(id)!;
                const unreachable = !graph.reachable.has(id);
                return (
                  <th key={id} scope="col" className="sticky top-0 z-10 h-36 w-11 min-w-[44px] border-b border-nt-line bg-nt-bg px-1 pb-2 align-bottom font-medium">
                    <button type="button" onClick={() => onFocusNode(id)} title={`${node.label}${unreachable ? ' (not reachable from Start)' : ''} · ${node.boardName}`}
                      className={`mx-auto block max-h-32 overflow-hidden text-ellipsis whitespace-nowrap rounded px-0.5 py-1 [writing-mode:vertical-rl] rotate-180 hover:bg-nt-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-nt-focus ${unreachable ? 'text-nt-ink-3 italic' : 'text-nt-ink-2'}`}>
                      {truncate(node.label, 22)}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="group">
                <th scope="row" className="sticky left-0 z-10 border-b border-r border-nt-line bg-nt-bg px-4 py-2 text-left font-normal group-hover:bg-nt-surface">
                  <div className="font-mono text-[12.5px] text-nt-ink">{row.name}</div>
                  <div className="text-nt-ink-3">{row.variable ? valuePreview(row.variable) : 'undeclared'}</div>
                  {row.issue && <div className={`mt-0.5 ${ISSUE_TEXT[row.issue].tone}`}>{ISSUE_TEXT[row.issue].text}</div>}
                </th>
                {columns.map((id) => {
                  const use = graph.variableUse.get(id);
                  const what = describe(use, row.name);
                  const label = graph.nodes.get(id)!.label;
                  return (
                    <td key={id} className="border-b border-nt-line/60 p-0 text-center group-hover:bg-nt-surface">
                      {what ? (
                        <button type="button" onClick={() => onFocusNode(id)} aria-label={`${row.name} is ${what} in ${label}. Open on canvas`} title={`${row.name}: ${what} in “${label}”`}
                          className="h-10 w-full hover:bg-nt-raised focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-nt-focus">
                          <Marks use={use} name={row.name} />
                        </button>
                      ) : (
                        <span className="block h-10" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {columns.length === 0 && (
          <p className="max-w-md px-4 py-6 text-sm text-nt-ink-3">
            No scene sets, checks or shows a variable yet. Use a code block in a scene (<code className="font-mono">health = 10</code>), a Branch condition, or <code className="font-mono">{'{{health}}'}</code> in text.
          </p>
        )}
      </div>
    </ViewFrame>
  );
}
