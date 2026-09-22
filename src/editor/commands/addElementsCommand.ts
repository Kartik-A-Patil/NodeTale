import { Edge } from 'reactflow';
import { AppNode } from '../../types';
import { Command, CommandContext } from './types';

// Covers addNode, pasteClipboard (nodes+edges together), and the palette-drop handler.
export function addElementsCommand(
  ctx: CommandContext,
  nodesToAdd: AppNode[],
  edgesToAdd: Edge[] = [],
  deselectExisting = false
): Command {
  let prevSelectedIds: Set<string> = new Set();

  return {
    execute() {
      ctx.setNodes(nds => {
        prevSelectedIds = new Set(nds.filter(n => n.selected).map(n => n.id));
        const base = deselectExisting ? nds.map(n => (n.selected ? { ...n, selected: false } : n)) : nds;
        return [...base, ...nodesToAdd];
      });
      if (edgesToAdd.length) {
        ctx.setEdges(eds => eds.concat(edgesToAdd));
      }
    },
    undo() {
      const addedIds = new Set(nodesToAdd.map(n => n.id));
      ctx.setNodes(nds =>
        nds
          .filter(n => !addedIds.has(n.id))
          .map(n => (prevSelectedIds.has(n.id) ? { ...n, selected: true } : n))
      );
      if (edgesToAdd.length) {
        const addedEdgeIds = new Set(edgesToAdd.map(e => e.id));
        ctx.setEdges(eds => eds.filter(e => !addedEdgeIds.has(e.id)));
      }
    },
  };
}
