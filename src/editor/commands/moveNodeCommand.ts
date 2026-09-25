import { Command, CommandContext } from './types';

export interface NodeTransform {
  position: { x: number; y: number };
  parentNode?: string;
  extent?: 'parent' | undefined;
}

export interface NodeMove {
  id: string;
  from: NodeTransform;
  to: NodeTransform;
}

// Batch move: ReactFlow's node-drag handlers report every node actually dragged
// (not just the one under the cursor) when multiple nodes are selected — dragging
// one drags the whole selection. A single command covers all of them, or undo
// would only restore the one "leader" node and silently leave the rest moved.
export function moveNodesCommand(ctx: CommandContext, moves: NodeMove[]): Command {
  const apply = (pick: (m: NodeMove) => NodeTransform) => {
    const byId = new Map(moves.map(m => [m.id, pick(m)]));
    ctx.setNodes(nds =>
      nds.map(n => {
        const t = byId.get(n.id);
        return t ? { ...n, position: t.position, parentNode: t.parentNode, extent: t.extent } : n;
      })
    );
  };

  return {
    execute: () => apply(m => m.to),
    undo: () => apply(m => m.from),
  };
}
