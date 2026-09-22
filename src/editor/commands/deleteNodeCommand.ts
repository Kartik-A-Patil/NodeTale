import { Edge } from 'reactflow';
import { AppNode } from '../../types';
import { Command, CommandContext } from './types';

interface UngroupedChildInfo {
  id: string;
  parentNode?: string;
  position: { x: number; y: number };
  extent?: any;
}

// Ports useFlowLogic.ts's original deleteNode exactly: a sectionNode with
// deleteChildren=false is "ungrouped" (its children lose their parent but survive,
// and — matching the original behavior — edges are NOT cleaned up in this branch);
// otherwise the node (plus, for a sectionNode with deleteChildren=true, its children)
// is deleted along with any edges connected to the deleted node(s).
//
// Reads current nodes/edges via ctx.getNodes()/getEdges() up front, before calling
// any setter — NOT by reading a value back out of a setNodes updater within this
// same execute() call, since React never runs that updater synchronously.
export function deleteNodeCommand(ctx: CommandContext, nodeId: string, deleteChildren: boolean): Command {
  let mode: 'delete' | 'ungroup' | 'noop' = 'noop';
  let removedNodes: AppNode[] = [];
  let removedEdges: Edge[] = [];
  let ungroupedChildren: UngroupedChildInfo[] = [];

  return {
    execute() {
      const currentNodes = ctx.getNodes();
      const nodeToDelete = currentNodes.find(n => n.id === nodeId);
      if (!nodeToDelete) {
        mode = 'noop';
        return;
      }

      if (nodeToDelete.type === 'sectionNode' && !deleteChildren) {
        mode = 'ungroup';
        removedNodes = [nodeToDelete];
        ungroupedChildren = currentNodes
          .filter(n => n.parentNode === nodeId)
          .map(n => ({ id: n.id, parentNode: n.parentNode, position: n.position, extent: (n as any).extent }));

        ctx.setNodes(nds =>
          nds
            .filter(n => n.id !== nodeId)
            .map(n => {
              if (n.parentNode === nodeId) {
                return {
                  ...n,
                  parentNode: undefined,
                  position: n.positionAbsolute || n.position,
                  extent: undefined,
                };
              }
              return n;
            })
        );
        return;
      }

      mode = 'delete';
      let idsToDelete = [nodeId];
      if (nodeToDelete.type === 'sectionNode' && deleteChildren) {
        const children = currentNodes.filter(n => n.parentNode === nodeId);
        idsToDelete = [...idsToDelete, ...children.map(n => n.id)];
      }
      removedNodes = currentNodes.filter(n => idsToDelete.includes(n.id));
      ctx.setNodes(nds => nds.filter(n => !idsToDelete.includes(n.id)));

      removedEdges = ctx.getEdges().filter(e => idsToDelete.includes(e.source) || idsToDelete.includes(e.target));
      ctx.setEdges(eds => eds.filter(e => !idsToDelete.includes(e.source) && !idsToDelete.includes(e.target)));
    },
    undo() {
      if (mode === 'noop') return;

      if (mode === 'ungroup') {
        ctx.setNodes(nds => {
          const restored = [...nds, ...removedNodes];
          return restored.map(n => {
            const info = ungroupedChildren.find(c => c.id === n.id);
            return info ? { ...n, parentNode: info.parentNode, position: info.position, extent: info.extent } : n;
          });
        });
        return;
      }

      ctx.setNodes(nds => [...nds, ...removedNodes]);
      if (removedEdges.length) {
        ctx.setEdges(eds => [...eds, ...removedEdges]);
      }
    },
  };
}
