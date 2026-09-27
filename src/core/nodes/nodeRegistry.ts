import { ComponentType } from 'react';
import { NodeProps } from 'reactflow';
import {
  AppNode,
  BaseNodeData,
  ElementNodeData,
  ConditionNodeData,
  JumpNodeData,
  CommentNodeData,
  SectionNodeData,
  AnnotationNodeData,
  Board,
  Variable,
} from '../../types';
import { evaluateCondition } from '../../services/logicService';
import { DEFAULT_BRANCHES } from '../branch';
import ElementNode from '../../components/nodes/ElementNode';
import ConditionNode from '../../components/nodes/ConditionNode';
import JumpNode from '../../components/nodes/JumpNode';
import CommentNode from '../../components/nodes/CommentNode';
import SectionNode from '../../components/nodes/SectionNode';
import AnnotationNode from '../../components/nodes/AnnotationNode';

export interface NodeExecutionContext {
  board: Board;
  runtimeVars: Variable[];
}

export interface NodeExecutionResult {
  // HTML content to run as a script on entering this node, if any.
  scriptContent?: string;
  // Auto-advance to this node id. Undefined/null means stay and wait for interaction.
  nextNodeId?: string | null;
}

export interface NodeRegistryEntry<T extends BaseNodeData = BaseNodeData> {
  component: ComponentType<NodeProps<T>>;
  create: (extraFields?: Record<string, any>) => T;
  defaultZIndex?: number;
  execute?: (node: AppNode & { data: T }, ctx: NodeExecutionContext) => NodeExecutionResult;
}

export type NodeTypeKey =
  | 'elementNode'
  | 'conditionNode'
  | 'jumpNode'
  | 'commentNode'
  | 'sectionNode'
  | 'annotationNode';

export const nodeRegistry: Record<NodeTypeKey, NodeRegistryEntry<any>> = {
  elementNode: {
    component: ElementNode,
    create: (extraFields = {}): ElementNodeData => ({ label: 'New Element', content: '', ...extraFields }),
    execute: (node) => ({ scriptContent: node.data.content }),
  } satisfies NodeRegistryEntry<ElementNodeData>,

  conditionNode: {
    component: ConditionNode,
    create: (extraFields = {}): ConditionNodeData => ({ label: 'Logic Check', ...extraFields }),
    execute: (node, ctx) => {
      // Same fallback as everywhere else a condition node's branches are read
      // (ConditionNode's own UI, storyGraph, the simulator) — a node that
      // hasn't been edited yet still has real If/Else handles to route to.
      const branches = node.data.branches || DEFAULT_BRANCHES;
      // null, not the string 'else': that never matches a real branch id
      // (ids are 'true'/'false' by default, or whatever the user set), so a
      // condition node with no Else branch at all correctly finds no edge
      // and stops, instead of silently looking for a branch named "else".
      let targetHandleId: string | null = null;

      for (const branch of branches) {
        if (branch.label === 'Else') {
          targetHandleId = branch.id;
          continue;
        }
        if (evaluateCondition(branch.condition, ctx.runtimeVars)) {
          targetHandleId = branch.id;
          break;
        }
      }

      const edge = targetHandleId
        ? ctx.board.edges.find((e) => e.source === node.id && e.sourceHandle === targetHandleId)
        : undefined;

      return { nextNodeId: edge?.target ?? null };
    },
  } satisfies NodeRegistryEntry<ConditionNodeData>,

  jumpNode: {
    component: JumpNode,
    // Retains the pre-existing default label of 'Jump' (this branch previously
    // shared a fallthrough default with commentNode).
    create: (extraFields = {}): JumpNodeData => ({ label: 'Jump', ...extraFields }),
    execute: (node) => ({ nextNodeId: node.data.jumpTargetId || null }),
  } satisfies NodeRegistryEntry<JumpNodeData>,

  commentNode: {
    component: CommentNode,
    create: (extraFields = {}): CommentNodeData => ({ label: 'Jump', text: '', ...extraFields }),
    defaultZIndex: -10,
  } satisfies NodeRegistryEntry<CommentNodeData>,

  sectionNode: {
    component: SectionNode,
    create: (extraFields = {}): SectionNodeData => ({ label: 'New Section', ...extraFields }),
    defaultZIndex: -1,
  } satisfies NodeRegistryEntry<SectionNodeData>,

  annotationNode: {
    component: AnnotationNode,
    create: (extraFields = {}): AnnotationNodeData => ({
      label: 'Annotation',
      content: 'This is an annotation describing a part of the flow.',
      ...extraFields,
    }),
  } satisfies NodeRegistryEntry<AnnotationNodeData>,
};

export const executeNode = (node: AppNode, ctx: NodeExecutionContext): NodeExecutionResult => {
  const entry = nodeRegistry[node.type as NodeTypeKey];
  return entry?.execute?.(node, ctx) ?? {};
};

// Comment and section nodes always sit behind other nodes. Applied wherever
// nodes enter the editor (load, toolbar drop, addNode) — previously each of
// those nodes forced it with a mount effect that re-set the whole node array.
export const withDefaultZIndex = (node: AppNode): AppNode => {
  const zIndex = nodeRegistry[node.type as NodeTypeKey]?.defaultZIndex;
  return zIndex === undefined || node.zIndex === zIndex ? node : { ...node, zIndex };
};
