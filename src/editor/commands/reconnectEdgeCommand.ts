import { Connection, Edge, reconnectEdge } from 'reactflow';
import { Command, CommandContext } from './types';

// Covers onReconnect, using ReactFlow's own reconnectEdge utility to match current
// behavior exactly (it preserves the edge's id/other fields, only re-pointing the
// endpoint that changed).
export function reconnectEdgeCommand(ctx: CommandContext, oldEdge: Edge, newConnection: Connection): Command {
  // reconnectEdge assigns the reconnected edge a fresh id derived from the new
  // connection (its default `shouldReplaceId: true`), so undo can't look up the
  // edge by oldEdge.id — track whichever id the result actually got.
  let newEdgeId: string | undefined;

  return {
    execute() {
      ctx.setEdges(eds => {
        const before = new Set(eds.map(e => e.id));
        const result = reconnectEdge(oldEdge, newConnection, eds);
        newEdgeId = result.find(e => !before.has(e.id))?.id;
        return result;
      });
    },
    undo() {
      if (!newEdgeId) return;
      ctx.setEdges(eds => eds.map(e => (e.id === newEdgeId ? oldEdge : e)));
    },
  };
}
