import { AlertOctagon, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Problem } from '../../../core/sim/problems';
import { StateAnalysis } from '../../../core/sim/simulate';
import { FocusNode } from '../shared';
import { buttonSecondary } from '../../ui/styles';

interface ProblemsPanelProps {
  problems: Problem[];
  analysis: StateAnalysis;
  onFocusNode: FocusNode;
  onShowInTree: (nodeId: string) => void;
}

export function ProblemsPanel({ problems, analysis, onFocusNode, onShowInTree }: ProblemsPanelProps) {
  const explored = `Checked ${analysis.visits.toLocaleString()} scene visits across every route${analysis.incomplete ? ' before hitting the limit, so some deep routes weren’t checked' : ''}.`;

  if (!analysis.startId) {
    return <p className="p-6 text-sm text-nt-ink-3">Name a scene “Start” to simulate the story.</p>;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <p className="text-sm text-nt-ink-3">{explored}</p>
        {problems.length === 0 ? (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-nt-line bg-nt-surface p-4">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-nt-success" aria-hidden />
            <div>
              <p className="text-sm font-medium text-nt-ink">No problems with these starting values</p>
              <p className="mt-1 text-sm text-nt-ink-3">Every branch is taken by some route, every connected scene is reached, and every script runs. Try another scenario in the panel to check other starts.</p>
            </div>
          </div>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {problems.map((p, i) => {
              const Icon = p.severity === 'error' ? AlertOctagon : AlertTriangle;
              return (
                <li key={`${p.kind}:${p.nodeId}:${i}`} className="flex items-start gap-3 rounded-lg border border-nt-line bg-nt-surface p-4">
                  <Icon size={18} aria-label={p.severity} className="mt-0.5 shrink-0"
                    style={{ color: p.severity === 'error' ? 'oklch(var(--nt-danger))' : 'oklch(var(--nt-branch-2))' }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-nt-ink">{p.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-nt-ink-2">{p.detail}</p>
                    <div className="mt-3 flex gap-2">
                      {p.kind !== 'unreached' && (
                        <button type="button" className={`${buttonSecondary} h-8 text-xs`} onClick={() => onShowInTree(p.nodeId)}>Show in state tree</button>
                      )}
                      <button type="button" className={`${buttonSecondary} h-8 text-xs`} onClick={() => onFocusNode(p.nodeId)}>Open on canvas</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
