// Centralized HTML sanitization utilities used by reader and EPUB paths.

// Tolerant sanitizer for reader display and AI outputs
export function sanitizeHtml(input: string): string {
  let s = input || '';

  // Normalize common scene breaks
  s = s.replace(/\s*(?:\* \* \*|\*{3,}|—{3,}|- {2,}-)\s*/g, '<hr />');

  // Strip <p> tags if they sneak in (reader prefers fragment-level markup)
  s = s.replace(/<\/?p[^>]*>/gi, '');

  // Heal & canonicalize void tags
  s = s.replace(/<\s*br\b[^>]*>/gi, '<br />');
  s = s.replace(/<\s*br\b(?![^>]*>)/gi, '<br />');
  s = s.replace(/<\/\s*br\s*>/gi, '');
  s = s.replace(/<\s*hr\b[^>]*>/gi, '<hr />');
  s = s.replace(/<\s*hr\b(?![^>]*>)/gi, '<hr />');
  s = s.replace(/<\/\s*hr\s*>/gi, '');

  // Tighten inline formatting tags: drop hallucinated attributes
  s = s.replace(/<\s*([/]?)(i|em|b|strong|u|s|sub|sup)\b[^>]*>/gi, '<$1$2>');

  // Escape any other accidental '<tag' sequences to plain text
  s = s.replace(/<(?!\/?(?:br|hr|i|em|b|strong|u|s|sub|sup)\b)/gi, '&lt;');

  return s;
}

// Strict XHTML serializer used for EPUB packaging
export function toStrictXhtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const allowed = new Set(['BR','HR','I','EM','B','STRONG','U','S','SUB','SUP']);

  const xdoc = document.implementation.createDocument('http://www.w3.org/1999/xhtml', 'div', null);
  const root = xdoc.documentElement;

  const transplant = (node: Node, into: Element) => {
    if (node.nodeType === Node.TEXT_NODE) {
      into.appendChild(xdoc.createTextNode(node.nodeValue || ''));
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (!allowed.has(el.tagName)) {
        el.childNodes.forEach(n => transplant(n, into));
        return;
      }
      const xEl = xdoc.createElementNS('http://www.w3.org/1999/xhtml', el.tagName.toLowerCase());
      el.childNodes.forEach(n => transplant(n, xEl));
      into.appendChild(xEl);
    }
  };

  doc.body.childNodes.forEach(n => transplant(n, root));
  return new XMLSerializer().serializeToString(root);
}

