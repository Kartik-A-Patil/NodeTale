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

export interface NodeData {
  label: string;
  content: string; // HTML/Rich text content
  assets?: string[]; // Asset IDs only, not objects
  audioSettings?: Record<string, AudioSettings>; // assetId -> settings
  variables?: Variable[]; // Inject global variables for highlighting context
  
  // Logic
  branches?: Branch[]; 
  
  // Jump
  jumpTargetId?: string;
  jumpTargetLabel?: string; 
  
  // Comments
  text?: string; // For comment nodes
  
  // Visual & State
  color?: string;
  date?: string; // ISO string for date and time

  [key: string]: any;
}

export type AppNode = Node<NodeData>;

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
  coverImage?: string; // Base64 or URL
}