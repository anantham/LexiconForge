// Centralized HTML sanitization utilities used by reader and EPUB paths.

export interface SanitizeHtmlOptions {
  allowHr?: boolean;
}

// Tolerant sanitizer for reader display and AI outputs
export function sanitizeHtml(input: string, options?: SanitizeHtmlOptions): string {
  let s = input || '';
  const allowHr = options?.allowHr ?? true;

  // Normalize common scene breaks
  s = s.replace(/\s*(?:\* \* \*|\*{3,}|—{3,}|- {2,}-)\s*/g, '<hr />');

  // Remove paragraph tags and normalize <br>
  s = s.replace(/<\/?p[^>]*>/gi, '');
  s = s.replace(/<\s*br\b[^>]*>/gi, '<br />');
  s = s.replace(/<\s*br\b(?![^>]*>)/gi, '<br />');
  s = s.replace(/<\/?br\s*>/gi, '<br />');
  s = s.replace(/<\/?hr\s*>/gi, '<hr />');

  // Tighten inline formatting tags: drop hallucinated attributes
  s = s.replace(/<\s*([\/]?)(i|em|b|strong|u|s|sub|sup)\b[^>]*>/gi, '<$1$2>');

  if (!allowHr) {
    s = s.replace(/<hr\s*\/>/gi, '<br /><br />');
  }

  const allowedPattern = allowHr ? 'br|hr|i|em|b|strong|u|s|sub|sup' : 'br|i|em|b|strong|u|s|sub|sup';
  const escapeUnknownTags = new RegExp('<(?!\\/?(?:' + allowedPattern + ')\\b)', 'gi');
  s = s.replace(escapeUnknownTags, '&lt;');

  return s;
}
