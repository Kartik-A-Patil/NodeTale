import { memo, useState } from 'react';
import { NodeProps, useReactFlow } from 'reactflow';
import { CornerDownRight, LocateFixed } from 'lucide-react';
import { useEditor } from '../../editor/EditorContext';
import { useNodeStatus } from '../../editor/nodeStatusStore';
import { JumpNodeData } from '../../models/story';
import { nodePropsEqual } from './nodePropsEqual';
import { NodeFrame, StatusBadge, nodeIconButton, useFocusCanvasNode } from './nodeChrome';

const JumpNode = ({ id, data, selected }: NodeProps<JumpNodeData>) => {
  const { getNodes } = useReactFlow();
  const { updateNodeData } = useEditor();
  const status = useNodeStatus(id);
  const focusNode = useFocusCanvasNode();
  const [isEditing, setIsEditing] = useState(false);

  const handleTargetChange = (targetId: string) => {
    const target = getNodes().find((n) => n.id === targetId);
    if (target && target.type !== 'jumpNode') {
      updateNodeData(id, { jumpTargetId: targetId, jumpTargetLabel: target.data.label || 'Untitled scene' });
    }
    setIsEditing(false);
  };

  // Only scenes can be jumped to.
  const targets = isEditing ? getNodes().filter((n) => n.id !== id && n.type === 'elementNode') : [];

  return (
    <NodeFrame id={id} selected={selected} color={data.color} className="min-w-[200px] max-w-[280px]">
      <div className="flex items-center gap-2.5 py-2 pl-3 pr-1.5" onDoubleClick={() => setIsEditing(true)}>
        <CornerDownRight size={16} className="nt-node-icon shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-medium uppercase tracking-wider text-nt-ink-3">Jump to</div>
          {isEditing ? (
            <select
              autoFocus
              aria-label="Jump target"
              className="nodrag mt-0.5 w-full rounded-md border border-nt-line bg-nt-bg px-1.5 py-1 text-xs text-nt-ink outline-none focus:border-nt-line-strong"
              value={data.jumpTargetId || ''}
              onChange={(e) => handleTargetChange(e.target.value)}
              onBlur={() => setIsEditing(false)}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <option value="">Choose a scene…</option>
              {targets.map((n) => <option key={n.id} value={n.id}>{n.data.label || 'Untitled scene'}</option>)}
            </select>
          ) : (
            <div className="truncate text-sm font-medium text-nt-ink" title="Double click to change the target">
              {data.jumpTargetId ? data.jumpTargetLabel || 'Untitled scene' : <span className="text-nt-ink-3">No target yet</span>}
            </div>
          )}
        </div>
        {status === 'dead-end' || status === 'unreachable' ? <StatusBadge status={status} /> : null}
        {data.jumpTargetId && !isEditing && (
          <button type="button" className={nodeIconButton} onClick={() => focusNode(data.jumpTargetId!)} title="Go to the target scene" aria-label="Go to the target scene">
            <LocateFixed size={14} />
          </button>
        )}
      </div>
    </NodeFrame>
  );
};

export default memo(JumpNode, nodePropsEqual);
