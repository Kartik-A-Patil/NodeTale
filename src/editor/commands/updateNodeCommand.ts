import { AppNode } from '../../types';
import { Command, CommandContext } from './types';

// Generic "capture before, apply patch, restore before on undo" command. Covers
// updateNodeData and updateNode — each call site just passes a different
// applyPatch function, same as it already passed a different patch object today.
export function updateNodeCommand(
  ctx: CommandContext,
  nodeId: string,
  applyPatch: (node: AppNode) => AppNode
): Command {
  let before: AppNode | undefined;

  return {
    execute() {
      ctx.setNodes(nds =>
        nds.map(n => {
          if (n.id !== nodeId) return n;
          before = n;
          return applyPatch(n);
        })
      );
    },
    undo() {
      if (!before) return;
      const restored = before;
      ctx.setNodes(nds => nds.map(n => (n.id === nodeId ? restored : n)));
    },
  };
}
