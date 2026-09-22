import { addEdge, Edge } from 'reactflow';
import { Command, CommandContext } from './types';

// Covers onConnect. `edgeToRemove` is the existing branch edge a conditionNode's
// single-output-per-branch rule requires removing before adding the new one, if any.
export function connectEdgeCommand(ctx: CommandContext, edgeToAdd: Edge, edgeToRemove?: Edge): Command {
  return {
    execute() {
      ctx.setEdges(eds => {
        const base = edgeToRemove ? eds.filter(e => e.id !== edgeToRemove.id) : eds;
        return addEdge(edgeToAdd, base);
      });
    },
    undo() {
      ctx.setEdges(eds => {
        const withoutAdded = eds.filter(e => e.id !== edgeToAdd.id);
        return edgeToRemove ? [...withoutAdded, edgeToRemove] : withoutAdded;
      });
    },
  };
}
