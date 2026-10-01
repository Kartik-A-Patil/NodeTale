import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface DiagramNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  icon?: LucideIcon;
  title?: string;
  body?: ReactNode;
  variant?: 'card' | 'note';
  /** Dimmed, to show what a path skips. */
  muted?: boolean;
}

export interface DiagramEdge {
  from: string;
  to: string;
  /** Start height inside the source node (a branch row); defaults to its middle. */
  fromY?: number;
  label?: string;
  dashed?: boolean;
  active?: boolean;
}

interface HelpDiagramProps {
  width: number;
  height: number;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  /** What the picture shows, for screen readers. */
  description: string;
}

// A small story graph drawn with the canvas's own node styles (.nt-node), so
// Help pictures always look like the board.
export function HelpDiagram({ width, height, nodes, edges, description }: HelpDiagramProps) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const paths = edges.map((edge) => {
    const a = byId.get(edge.from)!;
    const b = byId.get(edge.to)!;
    const x1 = a.x + a.w, y1 = a.y + (edge.fromY ?? a.h / 2);
    const x2 = b.x - 6, y2 = b.y + b.h / 2;
    const dx = Math.max(24, (x2 - x1) / 2);
    return { edge, d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`, mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 } };
  });

  return (
    <div role="img" aria-label={description} className="overflow-x-auto rounded-xl border border-nt-line bg-nt-bg p-5 [font-variant-ligatures:none]">
      <div className="relative mx-auto" style={{ width, height }}>
        <svg className="absolute inset-0 overflow-visible" width={width} height={height} aria-hidden>
          <defs>
            {['idle', 'active'].map((kind) => (
              <marker key={kind} id={`help-arrow-${kind}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill={kind === 'active' ? 'oklch(var(--nt-accent))' : 'oklch(var(--nt-line-strong))'} />
              </marker>
            ))}
          </defs>
          {paths.map(({ edge, d }) => (
            <path key={`${edge.from}-${edge.to}-${edge.fromY ?? ''}`} d={d} fill="none"
              stroke={edge.active ? 'oklch(var(--nt-accent))' : 'oklch(var(--nt-line-strong))'}
              strokeWidth={edge.active ? 2 : 1.5} strokeDasharray={edge.dashed ? '5 4' : undefined}
              markerEnd={`url(#help-arrow-${edge.active ? 'active' : 'idle'})`} />
          ))}
        </svg>
        {paths.filter((p) => p.edge.label).map(({ edge, mid }) => (
          <span key={`label-${edge.from}-${edge.to}-${edge.fromY ?? ''}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-nt-line bg-nt-surface px-2 py-0.5 text-[10px] text-nt-ink-2"
            style={{ left: mid.x, top: mid.y }}>
            {edge.label}
          </span>
        ))}
        {nodes.map((node) => {
          const Icon = node.icon;
          return (
            <div key={node.id} className={`nt-node absolute flex flex-col overflow-hidden transition-opacity ${node.muted ? 'opacity-40' : ''}`}
              data-variant={node.variant ?? 'card'} style={{ left: node.x, top: node.y, width: node.w, height: node.h }}>
              {node.title && (
                <div className="flex h-7 shrink-0 items-center gap-1.5 border-b border-nt-line/70 px-2.5">
                  {Icon && <Icon size={11} className="nt-node-icon shrink-0" aria-hidden />}
                  <span className="truncate text-[11px] font-semibold text-nt-ink">{node.title}</span>
                </div>
              )}
              {node.body && <div className="min-h-0 flex-1 px-2.5 py-1.5 text-[10px] leading-snug text-nt-ink-2">{node.body}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A logic line inside a diagram node. */
export const DiagramCode = ({ children }: { children: ReactNode }) => (
  <code className="mt-1 block rounded bg-nt-bg px-1.5 py-0.5 font-mono text-[10px] text-nt-ink-2 [font-variant-ligatures:none]">{children}</code>
);
