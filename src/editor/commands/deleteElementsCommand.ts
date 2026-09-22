import { AppNode } from '../../types';
import { Edge } from 'reactflow';
import { Command, CommandContext } from './types';

// Batch delete for the keyboard Delete-key handler: removes the given node ids and
// any edges connected to them, as a single history entry.
export function deleteElementsCommand(ctx: CommandContext, nodeIds: string[]): Command {
  let removedNodes: AppNode[] = [];
  let removedEdges: Edge[] = [];

  return {
    execute() {
      ctx.setNodes(nds => {
        removedNodes = nds.filter(n => nodeIds.includes(n.id));
        return nds.filter(n => !nodeIds.includes(n.id));
      });
      ctx.setEdges(eds => {
        removedEdges = eds.filter(e => nodeIds.includes(e.source) || nodeIds.includes(e.target));
        return eds.filter(e => !nodeIds.includes(e.source) && !nodeIds.includes(e.target));
      });
    },
    undo() {
      ctx.setNodes(nds => [...nds, ...removedNodes]);
      ctx.setEdges(eds => [...eds, ...removedEdges]);
    },
  };
}
