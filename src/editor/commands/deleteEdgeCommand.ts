import { Edge } from 'reactflow';
import { Command, CommandContext } from './types';

export function deleteEdgeCommand(ctx: CommandContext, edgeId: string): Command {
  let removed: Edge | undefined;

  return {
    execute() {
      ctx.setEdges(eds => {
        removed = eds.find(e => e.id === edgeId);
        return eds.filter(e => e.id !== edgeId);
      });
    },
    undo() {
      if (!removed) return;
      ctx.setEdges(eds => [...eds, removed!]);
    },
  };
}
