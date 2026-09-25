import { describe, expect, it } from 'vitest';
import { htmlToText, sanitizeHtml } from './html';

describe('sanitizeHtml', () => {
  it('strips scripts, event handlers and script URLs but keeps content', () => {
    const out = sanitizeHtml(
      '<p onclick="x()">Hi <b>there</b></p><script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">l</a>'
    );
    expect(out).toContain('<b>there</b>');
    expect(out).not.toMatch(/script|onerror|onclick|javascript:/i);
  });
});

describe('htmlToText', () => {
  it('returns text without running handlers', () => {
    expect(htmlToText('<p>a <img src="x" onerror="globalThis.__ran=1">b</p>')).toBe('a b');
    expect((globalThis as { __ran?: number }).__ran).toBeUndefined();
  });
});
