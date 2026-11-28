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

export const isArrayValue = (v: unknown): v is ArrayValue =>
  !!v && typeof v === 'object' && Array.isArray((v as ArrayValue).elements);
export const isObjectValue = (v: unknown): v is ObjectValue =>
  !!v && typeof v === 'object' && !isArrayValue(v) && !!(v as ObjectValue).keys && typeof (v as ObjectValue).keys === 'object';

/** The scene a story starts from: the one titled "Start". */
export const isStartNode = (node: { type?: string; data?: { label?: unknown } }): boolean =>
  node.type !== 'commentNode' && typeof node.data?.label === 'string' && node.data.label.trim().toLowerCase() === 'start';

/** Does `value` fit what this variable was declared as (lists: every item of
 *  the list's type; objects: every key of its own type)? Scripts can break
 *  this at play time; the debugger shows it and refuses to add to it. */
export function matchesType(variable: Pick<Variable, 'type' | 'value'>, value: unknown): boolean {
  const prim = (t: VariableType, v: unknown) =>
    t === VariableType.NUMBER ? typeof v === 'number' && Number.isFinite(v) : t === VariableType.BOOLEAN ? typeof v === 'boolean' : typeof v === 'string';
  switch (variable.type) {
    case VariableType.ARRAY:
      return isArrayValue(value) && value.elements.every((e) => prim(value.elementType, e));
    case VariableType.OBJECT:
      return isObjectValue(value) && Object.values(value.keys).every((k) => prim(k.type, k.value));
    default:
      return prim(variable.type, value);
  }
}

export interface Variable {
  id: string;
  name: string;
  type: VariableType;
  value: string | number | boolean | ArrayValue | ObjectValue;
  /** Shown to the player in Play Mode's status bar. */
  showInPlay?: boolean;
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

export type ValueOp = 'set' | 'add' | 'subtract' | 'multiply' | 'divide' | 'append' | 'clear' | 'flip' | 'push' | 'remove' | 'setKey';

/** One change in a "Set values" node. */
export interface ValueChange {
  id: string;
  /** Variable name. */
  variable: string;
  op: ValueOp;
  /** Objects: which key "set key" changes. */
  key?: string;
  /** Fixed value, of the variable's type (a list's item type, an object key's type). */
  value?: string | number | boolean;
  /** Present: the player is asked this, and the answer is the value. */
  ask?: string;
}

export interface SetNodeData extends BaseNodeData {
  changes?: ValueChange[];
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
  | SetNodeData
  | CommentNodeData
  | SectionNodeData
  | AnnotationNodeData;

export type StoryNodeType =
  | 'elementNode'
  | 'conditionNode'
  | 'jumpNode'
  | 'setNode'
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
}

/** Stacking a node type gets unless it says otherwise: sections behind comments behind everything. */
export const DEFAULT_Z_INDEX: Partial<Record<StoryNodeType, number>> = { commentNode: -1, sectionNode: -10 };

/** Persisted story content and authored position, without canvas runtime state. */
export type StoryNode =
  | StoryNodeBase<'elementNode', ElementNodeData>
  | StoryNodeBase<'conditionNode', ConditionNodeData>
  | StoryNodeBase<'jumpNode', JumpNodeData>
  | StoryNodeBase<'setNode', SetNodeData>
  | StoryNodeBase<'commentNode', CommentNodeData>
  | StoryNodeBase<'sectionNode', SectionNodeData>
  | StoryNodeBase<'annotationNode', AnnotationNodeData>;

/** Colour of a connection the author hasn't recoloured. */
export const DEFAULT_EDGE_STROKE = '#71717a';

/** A connection as stored: only what the author chose. Canvas defaults (edge
 *  type, arrow, default colour) are filled in on load by toCanvasEdge. */
export interface StoryEdge {
  id: string;
  source: string;
  target: string;
  /** Which branch of a condition node this leaves from. */
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  /** Custom choice text (when data.manualLabel). */
  label?: string;
  /** Custom colour. */
  style?: Record<string, string | number | undefined>;
  /** manualLabel, pathType, and the choice rules (see ChoiceRules). */
  data?: Record<string, unknown>;
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
export const isSetNode = <T extends NodeShape>(node: T): node is T & { type: 'setNode'; data: SetNodeData } => node.type === 'setNode';
export const isAnnotationNode = <T extends NodeShape>(node: T): node is T & { type: 'annotationNode'; data: AnnotationNodeData } => node.type === 'annotationNode';

// Lightweight metadata for listing UI without loading a project's boards.
export type { ProjectSummaryData as ProjectSummary, ProjectStats, ProjectThumbnail } from '../utils/projectSummary';
