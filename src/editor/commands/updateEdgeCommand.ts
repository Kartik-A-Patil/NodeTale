import { Edge } from 'reactflow';
import { Command, CommandContext } from './types';

// Generic patch command for edges, mirroring updateNodeCommand. Covers
// updateEdgeData, updateEdgeColor, and updateEdgeLabel.
export function updateEdgeCommand(
  ctx: CommandContext,
  edgeId: string,
  applyPatch: (edge: Edge) => Edge
): Command {
  let before: Edge | undefined;

  return {
    execute() {
      ctx.setEdges(eds =>
        eds.map(e => {
          if (e.id !== edgeId) return e;
          before = e;
          return applyPatch(e);
        })
      );
    },
    undo() {
      if (!before) return;
      const restored = before;
      ctx.setEdges(eds => eds.map(e => (e.id === edgeId ? restored : e)));
    },
  };
}
