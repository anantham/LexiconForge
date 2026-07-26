import { describe, it, expect } from 'vitest';
import { sanitizeHtml, toStrictXhtml } from '../../services/translate/HtmlSanitizer';

describe('HtmlSanitizer', () => {
  it('normalizes scene breaks to <hr />', () => {
    expect(sanitizeHtml('text *** more')).toContain('<hr />');
    expect(sanitizeHtml('text -  - more')).toContain('<hr />');
  });

  it('can strip horizontal rules when disallowed', () => {
    const sanitized = sanitizeHtml('top<hr>bottom', { allowHr: false });
    expect(sanitized).not.toContain('<hr');
    expect(sanitized).toContain('<br /><br />');
  });

  it('strips <p> tags', () => {
    expect(sanitizeHtml('<p>hello</p>')).toBe('hello');
    expect(sanitizeHtml('<p class="x">hello</p>')).toBe('hello');
  });
});

describe('HtmlSanitizer — dangerous-attribute hardening on allowlisted tags', () => {
  // Allowlisted tags (a, img, div, span, …) keep their attributes, so the
  // sanitizer must strip event handlers and script-scheme URLs from them.

  it('strips on* event handlers from <img>', () => {
    const out = sanitizeHtml('<img src="pic.png" onerror="alert(1)">');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('alert(1)');
    expect(out).toContain('src="pic.png"');
  });

  it('strips valueless on* handlers (<img onerror>)', () => {
    const out = sanitizeHtml('<img src="pic.png" onerror>');
    expect(out).not.toContain('onerror');
  });

  it('neutralizes javascript: hrefs on <a>', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('click');
  });

  it('neutralizes data:text URLs in src/href', () => {
    const out = sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>');
    expect(out).not.toContain('data:text');
  });

  it('strips onclick from structural tags like <div>', () => {
    const out = sanitizeHtml('<div onclick="steal()">content</div>');
    expect(out).not.toContain('onclick');
    expect(out).toContain('content');
  });

  it('preserves safe attributes and data:image sources', () => {
    const out = sanitizeHtml('<a href="https://example.com">x</a><img src="data:image/png;base64,AAAA" alt="pic">');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('data:image/png');
    expect(out).toContain('alt="pic"');
  });

  it('applies the same hardening in toStrictXhtml', () => {
    const out = toStrictXhtml('<img src="pic.png" onerror="alert(1)"><a href="javascript:alert(2)">x</a>');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('src="pic.png"');
  });
});
