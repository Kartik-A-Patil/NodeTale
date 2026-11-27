import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Handle, NodeResizeControl, Position, useReactFlow, useStore } from 'reactflow';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, EyeOff, Flag, FlagTriangleRight, OctagonX } from 'lucide-react';
import type { NodeStatus } from '../../core/graph/nodeStatus';

// Shared pieces every canvas node is built from, so the node types differ only
// in their body. Colours come from the theme tokens; a node's own colour is
// only an accent (--node-accent, see .nt-node in index.css).

/** Borderless icon button for node headers. */
export const nodeIconButton =
  'nodrag inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-nt-ink-3 transition-colors hover:bg-nt-raised hover:text-nt-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-nt-focus';

// '#18181b' was the old "no colour" swatch; treat it as unset so it doesn't
// become a near-black accent.
const accentOf = (color?: string) => (color && color !== '#18181b' ? color : undefined);

/** --node-accent for a node: its own colour, or the brand accent. */
export const accentStyle = (color?: string): CSSProperties | undefined => {
  const accent = accentOf(color);
  return accent ? ({ '--node-accent': accent } as CSSProperties) : undefined;
};

/** While a connection is being dragged, true for every node but its source. */
const useIsConnectTarget = (id: string) =>
  useStore(useCallback((s) => !!s.connectionNodeId && s.connectionNodeId !== id, [id]));

interface NodeFrameProps {
  id: string;
  selected: boolean;
  color?: string;
  /** Whether connections can end on this node (the whole card is the drop target). */
  connectable?: boolean;
  /** 'note' is the dashed, see-through card for comments. */
  variant?: 'card' | 'note';
  className?: string;
  children: ReactNode;
}

/** Card with the selection ring, colour accent and whole-node drop target for connections. */
export function NodeFrame({ id, selected, color, connectable = true, variant = 'card', className = '', children }: NodeFrameProps) {
  const isTarget = useIsConnectTarget(id) && connectable;
  return (
    <div
      className={`nt-node relative flex ${className}`}
      data-selected={selected}
      data-target={isTarget}
      data-accent={!!accentOf(color)}
      data-variant={variant}
      style={accentStyle(color)}
    >
      {connectable && <Handle
        type="target"
        position={Position.Left}
        id="target"
        className="!absolute !inset-0 z-[100] !h-full !w-full !transform-none !rounded-[inherit] !border-0 !opacity-0"
        style={{ pointerEvents: isTarget ? 'all' : 'none' }}
      />}
      {children}
    </div>
  );
}

interface NodeHeaderProps {
  icon: LucideIcon;
  title: ReactNode;
  status?: ReactNode;
  children?: ReactNode;
}

/** Icon, title, status, then borderless actions on the right. */
export function NodeHeader({ icon: Icon, title, status, children }: NodeHeaderProps) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-nt-line/70 pl-3 pr-1.5">
      <Icon size={14} className="nt-node-icon shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{title}</div>
      {status}
      {children && <div className="flex shrink-0 items-center gap-0.5">{children}</div>}
    </div>
  );
}

// Keyboard "edit" / "rename" for the selected node (Enter, F2), sent from the
// editor's shortcuts to whichever node has that id.
type EditField = 'content' | 'title';
const EDIT_EVENT = 'nodetale:edit-node';

export const requestNodeEdit = (id: string, field: EditField) =>
  window.dispatchEvent(new CustomEvent(EDIT_EVENT, { detail: { id, field } }));

export function useNodeEditRequest(id: string | undefined, field: EditField, onRequest: () => void) {
  const latest = useRef(onRequest);
  latest.current = onRequest;
  useEffect(() => {
    if (!id) return;
    const listener = (event: Event) => {
      const { detail } = event as CustomEvent<{ id: string; field: EditField }>;
      if (detail.id === id && detail.field === field) latest.current();
    };
    window.addEventListener(EDIT_EVENT, listener);
    return () => window.removeEventListener(EDIT_EVENT, listener);
  }, [id, field]);
}

interface EditableTitleProps {
  /** Lets F2 on the selected node start renaming. */
  nodeId?: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Double-click to rename; Enter or blur finishes. */
export function EditableTitle({ nodeId, value, placeholder, onChange, className = 'text-sm font-semibold text-nt-ink' }: EditableTitleProps) {
  const [editing, setEditing] = useState(false);
  useNodeEditRequest(nodeId, 'title', () => setEditing(true));
  if (editing) {
    return (
      <input
        autoFocus
        className={`nodrag w-full min-w-0 bg-transparent p-0 outline-none placeholder:text-nt-ink-3 ${className}`}
        value={value}
        placeholder={placeholder}
        aria-label="Title"
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter' || e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }
  return (
    <div className={`cursor-text truncate ${className}`} title="Double click to rename" onDoubleClick={() => setEditing(true)}>
      {value || <span className="text-nt-ink-3">{placeholder}</span>}
    </div>
  );
}

const STATUS: Record<NodeStatus | 'error', { label: string; icon: LucideIcon; className: string; hint: string }> = {
  start: { label: 'Start', icon: Flag, className: 'bg-nt-accent/15 text-nt-accent', hint: 'The story begins here' },
  ending: { label: 'Ending', icon: FlagTriangleRight, className: 'bg-nt-success/15 text-nt-success', hint: 'No choices lead on from here' },
  'dead-end': { label: 'Dead end', icon: OctagonX, className: 'bg-nt-danger/15 text-nt-danger', hint: 'A path from here leads nowhere' },
  unreachable: { label: 'Unreachable', icon: EyeOff, className: 'bg-nt-raised text-nt-ink-3', hint: 'No path from Start reaches this' },
  error: { label: 'Error', icon: AlertCircle, className: 'bg-nt-danger/15 text-nt-danger', hint: 'Something here needs fixing' },
};

/** Small labelled pill: never colour alone. */
export function StatusBadge({ status, label, hint }: { status: NodeStatus | 'error'; label?: string; hint?: string }) {
  const { icon: Icon, className, ...meta } = STATUS[status];
  return (
    <span title={hint ?? meta.hint} className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${className}`}>
      <Icon size={10} aria-hidden /> {label ?? meta.label}
    </span>
  );
}

/** Bottom-right resize grip, shown while selected. */
export function NodeResizeGrip({ minWidth, minHeight }: { minWidth: number; minHeight: number }) {
  return (
    <NodeResizeControl
      style={{ background: 'transparent', border: 'none', position: 'absolute', right: 0, bottom: 0 }}
      minWidth={minWidth}
      minHeight={minHeight}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-nt-ink-3" aria-hidden>
        <path d="M11 1L1 11M11 5L5 11M11 9L9 11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    </NodeResizeControl>
  );
}

/** Select a node on this board and bring it into view. */
export function useFocusCanvasNode() {
  const { fitView, setNodes } = useReactFlow();
  return useCallback((nodeId: string) => {
    setNodes((nodes) => nodes.map((node) => ({ ...node, selected: node.id === nodeId })));
    fitView({ nodes: [{ id: nodeId }], duration: 450, padding: 0.6, maxZoom: 1.4 });
  }, [fitView, setNodes]);
}
