import { it, expect } from 'vitest';
import { extractScriptCode, stripScriptBlocks, decodeEntities } from './html';
import { parseExpression } from '../core/expression/parser';

const viaDom = (html: string) =>
  Array.from(new DOMParser().parseFromString(html, 'text/html').querySelectorAll('pre'), (p) => p.textContent || '').join('\n');

const samples = [
  '<p>Hi</p><pre><code class="language-javascript">gold += 1\nif (hp &gt; 0 &amp;&amp; name != &quot;x&quot;) { ok = true }</code></pre>',
  '<pre class="x"><span class="token">a</span> = &#39;b&#39; + &#x27;c&#x27;</pre><p>mid</p><PRE>b = 2</PRE>',
  '<p>no script &lt;pre&gt; here</p>',
  '<pre></pre><pre>x = 1 &lt; 2</pre>',
];

it('extracts script text exactly like the DOM does', () => {
  for (const html of samples) expect(extractScriptCode(html)).toBe(viaDom(html));
});

it('strips script blocks', () => {
  expect(stripScriptBlocks(samples[1])).toBe('<p>mid</p>');
  expect(decodeEntities('&unknown; &amp;lt;')).toBe('&unknown; &lt;');
});

it('rejects trailing junk in a condition', () => {
  expect(() => parseExpression('gold > 5 junk')).toThrow();
  expect(parseExpression('gold > 5')).toBe(parseExpression('gold > 5')); // parsed once
});

it('treats a non-breaking space as a space in expressions', () => {
  expect(() => parseExpression(decodeEntities('gold&nbsp;*&nbsp;2'))).not.toThrow();
});
