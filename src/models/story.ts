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

export interface BaseNodeData {
  label: string;
  color?: string;
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

export type StoryNodeType =
  | 'elementNode'
  | 'conditionNode'
  | 'jumpNode'
  | 'commentNode'
  | 'sectionNode'
  | 'annotationNode';

interface StoryNodeBase<T extends StoryNodeType, D extends NodeData> {
  id: string;
  type: T;
  position: { x: number; y: number };
  data: D;
  parentNode?: string;
  extent?: 'parent' | [[number, number], [number, number]];
  width?: number | null;
  height?: number | null;
  zIndex?: number;
  style?: Record<string, string | number | undefined>;
  hidden?: boolean;
  draggable?: boolean;
  selectable?: boolean;
  connectable?: boolean;
  deletable?: boolean;
  focusable?: boolean;
  dragHandle?: string;
  expandParent?: boolean;
  className?: string;
}

/** Persisted story content and authored position, without canvas runtime state. */
export type StoryNode =
  | StoryNodeBase<'elementNode', ElementNodeData>
  | StoryNodeBase<'conditionNode', ConditionNodeData>
  | StoryNodeBase<'jumpNode', JumpNodeData>
  | StoryNodeBase<'commentNode', CommentNodeData>
  | StoryNodeBase<'sectionNode', SectionNodeData>
  | StoryNodeBase<'annotationNode', AnnotationNodeData>;

/** Persisted graph connection fields; selection and measured canvas state are transient. */
export interface StoryEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  label?: string;
  animated?: boolean;
  markerStart?: { type: string; width?: number; height?: number; color?: string };
  markerEnd?: { type: string; width?: number; height?: number; color?: string };
  style?: Record<string, string | number | undefined>;
  data?: Record<string, unknown>;
  hidden?: boolean;
  deletable?: boolean;
  focusable?: boolean;
  reconnectable?: boolean | 'source' | 'target';
  interactionWidth?: number;
  labelStyle?: Record<string, string | number | undefined>;
  labelBgStyle?: Record<string, string | number | undefined>;
  labelBgPadding?: [number, number];
  labelBgBorderRadius?: number;
  className?: string;
}

export interface Board {
  id: string;
  name: string;
  nodes: StoryNode[];
  edges: StoryEdge[];
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
  simulationPresets?: SimulationPreset[];
}

export interface SimulationPreset {
  id: string;
  name: string;
  values: Record<string, unknown>;
}

type NodeShape = { type?: string; data: NodeData };

export const isElementNode = <T extends NodeShape>(node: T): node is T & { type: 'elementNode'; data: ElementNodeData } => node.type === 'elementNode';
export const isConditionNode = <T extends NodeShape>(node: T): node is T & { type: 'conditionNode'; data: ConditionNodeData } => node.type === 'conditionNode';
export const isJumpNode = <T extends NodeShape>(node: T): node is T & { type: 'jumpNode'; data: JumpNodeData } => node.type === 'jumpNode';
export const isAnnotationNode = <T extends NodeShape>(node: T): node is T & { type: 'annotationNode'; data: AnnotationNodeData } => node.type === 'annotationNode';

// Lightweight metadata for listing UI without loading a project's boards.
export type { ProjectSummaryData as ProjectSummary, ProjectStats, ProjectThumbnail } from '../utils/projectSummary';
