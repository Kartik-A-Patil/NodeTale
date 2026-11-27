import { ComponentType } from 'react';
import { NodeProps } from 'reactflow';
import {
  StoryNode,
  BaseNodeData,
  ElementNodeData,
  ConditionNodeData,
  JumpNodeData,
  CommentNodeData,
  SectionNodeData,
  AnnotationNodeData,
  Board,
  DEFAULT_Z_INDEX,
} from '../../models/story';
import { CanvasNode } from '../../adapters/reactFlow';
import { evaluateCondition, Rng, TraceLine } from '../runtime/scriptInterpreter';
import { DEFAULT_BRANCHES } from '../branch';
import SceneNode from '../../components/nodes/SceneNode';
import ConditionNode from '../../components/nodes/ConditionNode';
import JumpNode from '../../components/nodes/JumpNode';
import CommentNode from '../../components/nodes/CommentNode';
import SectionNode from '../../components/nodes/SectionNode';
import AnnotationNode from '../../components/nodes/AnnotationNode';

export interface NodeExecutionContext {
  board: Board;
  /** Variable values by name. */
  values: Record<string, unknown>;
  /** Luck for chance()/random() in branch conditions. */
  rng?: Rng;
  onError?: (message: string) => void;
  /** Collects what was evaluated and why, for the Play Mode debugger. */
  trace?: TraceLine[];
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
  execute?: (node: StoryNode & { data: T }, ctx: NodeExecutionContext) => NodeExecutionResult;
}

export type NodeTypeKey =
  | 'elementNode'
  | 'conditionNode'
  | 'jumpNode'
  | 'commentNode'
  | 'sectionNode'
  | 'annotationNode';

export const nodeRegistry: Record<NodeTypeKey, NodeRegistryEntry<any>> = {
  // A scene. Stored as 'elementNode' (its original name) in every saved story.
  elementNode: {
    component: SceneNode,
    create: (extraFields = {}): ElementNodeData => ({ label: 'New scene', content: '', ...extraFields }),
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

      let elseId: string | null = null;
      for (const branch of branches) {
        if (branch.label === 'Else') {
          elseId = branch.id;
          targetHandleId = branch.id;
          continue;
        }
        let failure: string | undefined;
        const pass = evaluateCondition(branch.condition, ctx.values, {
          rng: ctx.rng,
          onError: (m) => { failure = m; ctx.onError?.(m); },
        });
        ctx.trace?.push({
          source: 'branch',
          text: `If ${branch.condition?.trim() || '(empty: always true)'}`,
          note: failure ?? (pass ? 'true → taken' : 'false'),
          ...(failure ? { error: true } : {}),
        });
        if (pass) {
          targetHandleId = branch.id;
          break;
        }
      }
      if (ctx.trace && targetHandleId !== null && targetHandleId === elseId) ctx.trace.push({ source: 'branch', text: 'Else', note: 'taken' });

      const edge = targetHandleId
        ? ctx.board.edges.find((e) => e.source === node.id && e.sourceHandle === targetHandleId)
        : undefined;

      return { nextNodeId: edge?.target ?? null };
    },
  } satisfies NodeRegistryEntry<ConditionNodeData>,

  jumpNode: {
    component: JumpNode,
    create: (extraFields = {}): JumpNodeData => ({ label: 'Jump', ...extraFields }),
    execute: (node) => ({ nextNodeId: node.data.jumpTargetId || null }),
  } satisfies NodeRegistryEntry<JumpNodeData>,

  commentNode: {
    component: CommentNode,
    create: (extraFields = {}): CommentNodeData => ({ label: '', text: '', ...extraFields }),
    defaultZIndex: DEFAULT_Z_INDEX.commentNode,
  } satisfies NodeRegistryEntry<CommentNodeData>,

  sectionNode: {
    component: SectionNode,
    create: (extraFields = {}): SectionNodeData => ({ label: 'New Section', ...extraFields }),
    defaultZIndex: DEFAULT_Z_INDEX.sectionNode,
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

export const executeNode = (node: StoryNode, ctx: NodeExecutionContext): NodeExecutionResult => {
  const entry = nodeRegistry[node.type as NodeTypeKey];
  return entry?.execute?.(node, ctx) ?? {};
};

// Sections sit furthest back, then comments (so a comment inside a section
// stays visible), then everything else, regardless of how they enter the editor.
export const withDefaultZIndex = (node: CanvasNode): CanvasNode => {
  const zIndex = nodeRegistry[node.type as NodeTypeKey]?.defaultZIndex;
  return zIndex === undefined || node.zIndex === zIndex ? node : { ...node, zIndex };
};
