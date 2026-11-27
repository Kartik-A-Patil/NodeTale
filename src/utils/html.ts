// Node content is user HTML that also arrives from imported project files, so
// anything rendered from it goes through here. DOMParser documents are inert:
// scripts don't run and <img onerror> doesn't fire while parsing.

const parse = (html: string) => new DOMParser().parseFromString(html || '', 'text/html');

const isUnsafeUrl = (value: string) => /^\s*(javascript|vbscript|data:text\/html)/i.test(value);

/** Strips scripts, styles, inline event handlers and script URLs, in place. */
export const sanitizeDocument = (doc: Document): Document => {
  doc.querySelectorAll('script, style, iframe, object, embed').forEach((el) => el.remove());
  doc.body.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || ((name === 'href' || name === 'src' || name === 'xlink:href') && isUnsafeUrl(attr.value))) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return doc;
};

export const sanitizeHtml = (html: string): string => sanitizeDocument(parse(html)).body.innerHTML;

/** Plain text of an HTML fragment, without ever attaching it to the live DOM. */
export const htmlToText = (html: string): string => parse(html).body.textContent || '';

/** `{{ expression }}` in story text; group 1 is the expression. Global regex: use matchAll/replace. */
export const VARIABLE_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;

// Story text is HTML: `{{hp > 0}}` arrives as `{{hp &gt; 0}}`.
const ENTITIES: Record<string, string> = { gt: '>', lt: '<', amp: '&', quot: '"', apos: "'", nbsp: '\u00a0' };
export const decodeEntities = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e.toLowerCase()] ?? match);

// <pre> blocks can't nest, and the editor writes them as plain <pre><code>…</code></pre>,
// so a pattern finds them without building a DOM. That matters: this runs for
// every scene on every validation, graph rebuild and simulator start, where
// DOMParser was most of the cost.
const PRE_BLOCK = /<pre\b[^>]*>([\s\S]*?)<\/pre>/gi;

/** A scene's logic: the text of all its <pre> blocks, one after another. */
export const extractScriptCode = (html: string): string => {
  if (!html?.includes('<pre')) return '';
  return Array.from(html.matchAll(PRE_BLOCK), (m) => decodeEntities(m[1].replace(/<[^>]*>/g, ''))).join('\n');
};

/** The player sees the story text, never the logic that drives it. */
export const stripScriptBlocks = (html: string): string => (html?.includes('<pre') ? html.replace(PRE_BLOCK, '') : html || '');
export const VARIABLE_TOKEN_CLASS = 'nt-variable-token';

/** Elements holding blocks, not text: whitespace between their children is formatting. */
const BLOCK_CONTAINERS = new Set(['BODY', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'DIV']);

/** Text with `{{variables}}` wrapped in token spans, as the editor decorates them. */
const appendWithVariables = (doc: Document, parent: DocumentFragment, text: string) => {
  let last = 0;
  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    const start = match.index ?? 0;
    parent.append(text.slice(last, start));
    const token = doc.createElement('span');
    token.className = VARIABLE_TOKEN_CLASS;
    token.dataset.variable = match[0].slice(2, -2).trim();
    token.textContent = match[0];
    parent.append(token);
    last = start + match[0].length;
  }
  parent.append(text.slice(last));
};

/**
 * Sanitized story HTML for read-only display, normalised the way the editor
 * parses it (preserveWhitespace: true, newlines become hard breaks) and with
 * `{{variables}}` wrapped like the editor's decorations. Legacy content with
 * newlines between tags would otherwise look different when not editing.
 */
export const renderStoryHtml = (html: string): string => {
  const doc = sanitizeDocument(parse(html));
  // Code blocks as the editor stores them: plain text in <code class="language-…">
  // (older content has <pre class> with baked-in highlight spans).
  doc.querySelectorAll('pre').forEach((pre) => {
    const language = /language-(\S+)/.exec(pre.querySelector('code')?.className ?? '')?.[1] ?? 'javascript';
    const code = doc.createElement('code');
    code.className = `language-${language}`;
    code.textContent = pre.textContent;
    pre.getAttributeNames().forEach((name) => pre.removeAttribute(name));
    pre.replaceChildren(code);
  });
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) textNodes.push(node as Text);

  for (const node of textNodes) {
    const parent = node.parentElement!;
    if (parent.closest('pre')) continue;
    if (BLOCK_CONTAINERS.has(parent.tagName) && !/\S/.test(node.data)) {
      node.remove();
      continue;
    }
    if (!/[\r\n]/.test(node.data) && !node.data.includes('{{')) continue;
    const fragment = doc.createDocumentFragment();
    node.data.split(/\r\n?|\n/).forEach((line, i) => {
      if (i) fragment.append(doc.createElement('br'));
      appendWithVariables(doc, fragment, line);
    });
    node.replaceWith(fragment);
  }
  return doc.body.innerHTML;
};
