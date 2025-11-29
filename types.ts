import { Edge, Node } from 'reactflow';

export enum VariableType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean'
}

export interface Variable {
  id: string;
  name: string;
  type: VariableType;
  value: string | number | boolean;
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

export interface Branch {
  id: string;
  label: string;
  condition: string;
}

export interface NodeData {
  label: string;
  content: string; // HTML/Rich text content
  assets?: string[]; // Asset IDs
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
}