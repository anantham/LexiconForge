import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../../services/translate/HtmlSanitizer';

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
