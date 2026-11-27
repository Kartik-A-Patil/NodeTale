import { lazy, Suspense } from 'react';
import type { RichTextEditorProps } from '../RichTextEditor';
import { StoryText } from './StoryText';

const loadEditor = () => import('../RichTextEditor');
const RichTextEditor = lazy(() => loadEditor().then(({ RichTextEditor: Editor }) => ({ default: Editor })));

// Warm the chunk once the app is idle, so the first double-click doesn't wait on the network.
(window.requestIdleCallback ?? setTimeout)(() => void loadEditor());

// The fallback is the same text, rendered read-only: even while the chunk
// loads, entering edit mode shows no loading state.
export const LazyRichTextEditor = (props: RichTextEditorProps) => (
  <Suspense fallback={<StoryText html={props.initialValue} />}>
    <RichTextEditor {...props} />
  </Suspense>
);
