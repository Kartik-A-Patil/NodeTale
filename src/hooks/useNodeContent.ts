import { useState } from 'react';
import { Node } from 'reactflow';
import { sameNodeContent } from '../adapters/reactFlow';

/** `nodes`, but only a new array when what nodes say changes, not where they
 *  sit: drag and pan frames return the previous array, so work and memoised
 *  children that depend on content alone skip those frames. */
export function useNodeContent<T extends Node>(nodes: T[]): T[] {
  const [content, setContent] = useState(nodes);
  if (content !== nodes && !sameNodeContent(content, nodes)) setContent(nodes);
  return content;
}
