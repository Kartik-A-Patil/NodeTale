import { LucideIcon, Workflow, GitBranch, CalendarRange, Variable } from 'lucide-react';

export type ViewMode = 'flow' | 'branches' | 'timeline' | 'variables';

export interface ViewModeDef {
  id: ViewMode;
  label: string;
  description: string;
  icon: LucideIcon;
}

// Order is also the Alt+1..4 shortcut order.
export const VIEW_MODES: ViewModeDef[] = [
  { id: 'flow', label: 'Flow', description: 'Edit the story on the canvas', icon: Workflow },
  { id: 'branches', label: 'Branches', description: 'The story as a tree of choices from Start', icon: GitBranch },
  { id: 'timeline', label: 'Timeline', description: 'Dated scenes on a time axis, by branch', icon: CalendarRange },
  { id: 'variables', label: 'Variables', description: 'Where each variable is set, checked and shown', icon: Variable },
];
