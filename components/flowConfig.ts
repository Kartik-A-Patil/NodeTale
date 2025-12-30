import ElementNode from './nodes/ElementNode';
import ConditionNode from './nodes/ConditionNode';
import JumpNode from './nodes/JumpNode';
import CommentNode from './nodes/CommentNode';
import SectionNode from './nodes/SectionNode';
import AnnotationNode from './nodes/AnnotationNode';
import FloatingEdge from './edge/FloatingEdge';

export const nodeTypes = {
  elementNode: ElementNode,
  conditionNode: ConditionNode,
  jumpNode: JumpNode,
  commentNode: CommentNode,
  sectionNode: SectionNode,
  annotationNode: AnnotationNode,
};

export const edgeTypes = {
  floating: FloatingEdge,
};
