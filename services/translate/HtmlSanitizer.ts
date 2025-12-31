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

  // EPUB-compatible allowlist: include all semantic and structural tags used in chapters
  const epubTags = 'h[1-6]|div|p|span|a|img|ol|ul|li|blockquote|pre|code|table|tr|td|th|thead|tbody|figure|figcaption|section|article|nav|aside|header|footer|main|sup|sub';
  const allowedPattern = allowHr ? `br|hr|i|em|b|strong|u|s|${epubTags}` : `br|i|em|b|strong|u|s|${epubTags}`;
  const escapeUnknownTags = new RegExp('<(?!\\/?(?:' + allowedPattern + ')\\b)', 'gi');
  s = s.replace(escapeUnknownTags, '&lt;');

  return s;
}

// Strict XHTML serializer helper used by EPUB pipeline.
// Unlike sanitizeHtml, this preserves structural HTML tags needed for EPUB.
export function toStrictXhtml(input: string): string {
  let s = input || '';

  // Normalize self-closing tags for XHTML compliance
  // Void elements in XHTML must be self-closing: br, hr, img, input, meta, link, etc.
  s = s.replace(/<\s*br\b[^>]*>/gi, '<br />');
  s = s.replace(/<\s*hr\b[^>]*>/gi, '<hr />');

  // Fix <img> tags - ensure they are self-closing for XHTML
  // Match <img ...> that doesn't already end with />
  s = s.replace(/<img\b([^>]*[^/])>/gi, '<img$1 />');
  // Also handle <img> with no attributes
  s = s.replace(/<img>/gi, '<img />');
  // Fix malformed <img.../> (no space before /)
  s = s.replace(/<img\b([^>]*)([^/\s])\/>/gi, '<img$1$2 />');

  // EPUB-compatible allowlist: all semantic and structural tags
  const epubTags = 'h[1-6]|div|p|span|a|img|ol|ul|li|blockquote|pre|code|table|tr|td|th|thead|tbody|figure|figcaption|section|article|nav|aside|header|footer|main|sup|sub';
  const allowedPattern = `br|hr|i|em|b|strong|u|s|${epubTags}`;
  const escapeUnknownTags = new RegExp('<(?!\\/?(?:' + allowedPattern + ')\\b)', 'gi');
  s = s.replace(escapeUnknownTags, '&lt;');

  return s;
}
