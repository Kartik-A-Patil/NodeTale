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
