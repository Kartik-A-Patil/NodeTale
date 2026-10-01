import { memo, useState } from 'react';
import { NodeProps } from 'reactflow';
import { useEditor } from '../../editor/EditorContext';
import { CommentNodeData } from '../../models/story';
import { LazyRichTextEditor } from '../editor/LazyRichTextEditor';
import { EditStart, StoryText } from '../editor/StoryText';
import JumpTargetBadge from './JumpTargetBadge';
import { nodePropsEqual } from './nodePropsEqual';
import { NodeFrame, NodeResizeGrip, useNodeEditRequest } from './nodeChrome';

const CommentNode = ({ id, data, selected }: NodeProps<CommentNodeData>) => {
  const { updateNodeData } = useEditor();
  const [isEditing, setIsEditing] = useState(false);
  const [editStart, setEditStart] = useState<EditStart>();
  useNodeEditRequest(id, 'content', () => { setEditStart(undefined); setIsEditing(true); });

  const handleChange = (val: string) => {
    updateNodeData(id, { text: val }, `${id}:text`);
  };

  return (
    <>
      <NodeFrame id={id} selected={selected} color={data.color} connectable={false} variant="note" className="h-full w-full min-w-[250px] min-h-[200px] flex-col">
        <JumpTargetBadge nodeId={id} className="absolute right-1.5 top-1.5 z-10" />
        <div
          className="relative min-h-0 flex-1 p-4 text-sm text-nt-ink-2"
          onDoubleClick={() => { setEditStart(undefined); setIsEditing(true); }}
        >
          {isEditing ? (
            <LazyRichTextEditor
              initialValue={data.text || ''}
              startAt={editStart}
              onChange={handleChange}
              onBlur={() => setIsEditing(false)}
              placeholder="Write a note… type / for blocks"
            />
          ) : (
            <StoryText
              html={data.text || ''}
              placeholder="Double click to add comment…"
              onStartEdit={(start) => {
                setEditStart(start);
                setIsEditing(true);
              }}
            />
          )}
        </div>
      </NodeFrame>
      {selected && <NodeResizeGrip minWidth={250} minHeight={200} />}
    </>
  );
};

export default memo(CommentNode, nodePropsEqual);
