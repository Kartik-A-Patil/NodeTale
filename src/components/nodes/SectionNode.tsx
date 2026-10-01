import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { LayoutTemplate } from 'lucide-react';
import { useEditor } from '../../editor/EditorContext';
import { SectionNodeData } from '../../models/story';
import JumpTargetBadge from './JumpTargetBadge';
import { nodePropsEqual } from './nodePropsEqual';
import { EditableTitle, NodeResizeGrip, accentStyle } from './nodeChrome';

const SectionNode = ({ id, data, selected }: NodeProps<SectionNodeData>) => {
  const { updateNodeData } = useEditor();
  const style = accentStyle(data.color);

  return (
    <>
      <div className="nt-section relative h-full w-full" style={{ ...style, minWidth: 400, minHeight: 300 }} data-selected={selected} data-accent={!!style}>
        {/* Title sits above the frame, so nodes inside keep the whole area. */}
        <div className="absolute -top-8 left-1 flex h-7 max-w-full items-center gap-2">
          <LayoutTemplate size={15} className="nt-section-icon shrink-0" aria-hidden />
          <EditableTitle nodeId={id}
            value={data.label}
            placeholder="Untitled section"
            onChange={(label) => updateNodeData(id, { label }, `${id}:label`)}
            className="max-w-80 text-base font-semibold text-nt-ink-2"
          />
          <JumpTargetBadge nodeId={id} />
        </div>
      </div>
      {selected && <NodeResizeGrip minWidth={400} minHeight={300} />}
    </>
  );
};

export default memo(SectionNode, nodePropsEqual);
