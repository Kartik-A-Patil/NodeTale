// Extracts the combined script code from all <pre> blocks in a node's rich-text
// HTML content. Shared by StoryRuntime (actually running it) and the validator
// (statically checking it for unknown variable references) so the extraction
// logic — and what counts as "the script" — never drifts between the two.
export function extractScriptCode(htmlContent: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent || '', 'text/html');
  const preBlocks = doc.querySelectorAll('pre');
  if (preBlocks.length === 0) return '';

  return Array.from(preBlocks)
    .map((block) => block.textContent || (block as HTMLElement).innerText || '')
    .join('\n');
}
