import { Edge, Node } from 'reactflow';

export enum VariableType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  OBJECT = 'object'
}

export interface ArrayValue {
  elementType: VariableType.STRING | VariableType.NUMBER | VariableType.BOOLEAN;
  elements: (string | number | boolean)[];
}

export interface ObjectValue {
  keys: Record<string, {
    type: VariableType.STRING | VariableType.NUMBER | VariableType.BOOLEAN;
    value: string | number | boolean;
  }>;
}

export interface Variable {
  id: string;
  name: string;
  type: VariableType;
  value: string | number | boolean | ArrayValue | ObjectValue;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
}

export interface Asset {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'audio' | 'video';
  parentId: string | null;
}

export interface AudioSettings {
  loop: boolean;
  delay: number;
}

export interface Branch {
  id: string;
  label: string;
  condition: string;
}

// variables/projectAssets are injected at render/runtime time, never persisted.
export interface BaseNodeData {
  label: string;
  color?: string;
  variables?: Variable[];
  projectAssets?: Asset[];
  connectedHandles?: string[];
}

export interface ElementNodeData extends BaseNodeData {
  content: string;
  assets?: string[];
  audioSettings?: Record<string, AudioSettings>;
  date?: string;
}

export interface ConditionNodeData extends BaseNodeData {
  branches?: Branch[];
}

export interface JumpNodeData extends BaseNodeData {
  jumpTargetId?: string;
  jumpTargetLabel?: string;
}

export interface CommentNodeData extends BaseNodeData {
  text?: string;
}

export type SectionNodeData = BaseNodeData;

export interface AnnotationNodeData extends BaseNodeData {
  content?: string;
  arrowDirection?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export type NodeData =
  | ElementNodeData
  | ConditionNodeData
  | JumpNodeData
  | CommentNodeData
  | SectionNodeData
  | AnnotationNodeData;

// ReactFlow types a managed node's `type` field as a plain string, not a
// per-variant literal, so this can't be a literal-discriminated union — use
// the guards below to narrow instead.
export type AppNode = Node<NodeData>;

export const isElementNode = (node: AppNode): node is AppNode & { data: ElementNodeData } =>
  node.type === 'elementNode';
export const isConditionNode = (node: AppNode): node is AppNode & { data: ConditionNodeData } =>
  node.type === 'conditionNode';
export const isJumpNode = (node: AppNode): node is AppNode & { data: JumpNodeData } =>
  node.type === 'jumpNode';
export const isCommentNode = (node: AppNode): node is AppNode & { data: CommentNodeData } =>
  node.type === 'commentNode';
export const isSectionNode = (node: AppNode): node is AppNode & { data: SectionNodeData } =>
  node.type === 'sectionNode';
export const isAnnotationNode = (node: AppNode): node is AppNode & { data: AnnotationNodeData } =>
  node.type === 'annotationNode';

export interface Board {
  id: string;
  name: string;
  nodes: AppNode[];
  edges: Edge[];
}

export interface Project {
  id: string;
  name: string;
  boards: Board[];
  activeBoardId: string;
  variables: Variable[];
  assets: Asset[];
  folders: Folder[];
  coverImage?: string;
  modifiedAt?: number;
}

// Lightweight metadata for listing UI (e.g. the Dashboard) without loading
// each project's full boards/nodes/edges.
export interface ProjectSummary {
  id: string;
  name: string;
  modifiedAt?: number;
  coverImage?: string;
  boardCount: number;
  assetCount: number;
}
