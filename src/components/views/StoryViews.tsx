import { lazy, Suspense, useMemo } from 'react';
import { Project } from '../../types';
import { buildStoryGraph } from '../../core/graph/storyGraph';
import { ViewMode } from './viewModes';
import { FocusNode } from './shared';

// Each view (and d3) loads only when first opened.
const BranchMap = lazy(() => import('./BranchMap'));
const TimelineChart = lazy(() => import('./TimelineChart'));
const PathFlow = lazy(() => import('./PathFlow'));
const VariablesView = lazy(() => import('./variables/VariablesView'));

interface StoryViewsProps {
  mode: Exclude<ViewMode, 'flow'>;
  project: Project;
  onFocusNode: FocusNode;
  onUpdateProject: (update: (project: Project) => Project) => void;
}

export default function StoryViews({ mode, project, onFocusNode, onUpdateProject }: StoryViewsProps) {
  const graph = useMemo(() => buildStoryGraph(project), [project]);
  return (
    <Suspense fallback={<div className="absolute inset-0 bg-nt-bg" />}>
      {mode === 'branches' && <BranchMap graph={graph} onFocusNode={onFocusNode} />}
      {mode === 'timeline' && <TimelineChart graph={graph} onFocusNode={onFocusNode} />}
      {mode === 'paths' && <PathFlow graph={graph} onFocusNode={onFocusNode} />}
      {mode === 'variables' && <VariablesView graph={graph} project={project} onFocusNode={onFocusNode} onUpdateProject={onUpdateProject} />}
    </Suspense>
  );
}
