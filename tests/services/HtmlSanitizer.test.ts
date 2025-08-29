import { describe, it, expect } from 'vitest';
import { sanitizeHtml, toStrictXhtml } from '../../services/translate/HtmlSanitizer';

describe('HtmlSanitizer', () => {
  describe('sanitizeHtml (tolerant for reader)', () => {
    it('normalizes scene breaks to <hr />', () => {
      expect(sanitizeHtml('text * * * more')).toContain('<hr />');
      expect(sanitizeHtml('text *** more')).toContain('<hr />');
      expect(sanitizeHtml('text ——— more')).toContain('<hr />');
      expect(sanitizeHtml('text -  - more')).toContain('<hr />');
    });

    it('strips <p> tags', () => {
      expect(sanitizeHtml('<p>hello</p>')).toBe('hello');
      expect(sanitizeHtml('<p class="x">hello</p>')).toBe('hello');
    });

    it('canonicalizes void tags', () => {
      expect(sanitizeHtml('hello<br>world')).toBe('hello<br />world');
      expect(sanitizeHtml('hello<br/>world')).toBe('hello<br />world');
      expect(sanitizeHtml('hello</br>world')).toBe('helloworld'); // removes closing
    });

    it('tightens inline formatting tags', () => {
      expect(sanitizeHtml('<b class="x">bold</b>')).toBe('<b>bold</b>');
      expect(sanitizeHtml('<strong id="y">strong</strong>')).toBe('<strong>strong</strong>');
      expect(sanitizeHtml('<em style="color:red">em</em>')).toBe('<em>em</em>');
    });

    it('escapes unknown tags to plain text', () => {
      expect(sanitizeHtml('<script>alert(1)</script>')).toBe('&lt;script>alert(1)&lt;/script>');
      expect(sanitizeHtml('<div>content</div>')).toBe('&lt;div>content&lt;/div>');
      expect(sanitizeHtml('<span>content</span>')).toBe('&lt;span>content&lt;/span>');
    });

    it('preserves allowed inline tags', () => {
      const input = '<b>bold</b> <i>italic</i> <em>em</em> <strong>strong</strong>';
      expect(sanitizeHtml(input)).toBe(input);
    });
  });

  describe('toStrictXhtml (strict for EPUB)', () => {
    it('converts to XHTML with proper namespace', () => {
      const result = toStrictXhtml('<b>test</b>');
      expect(result).toMatch(/xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/);
      expect(result).toContain('<b>test</b>');
    });

    it('flattens disallowed tags', () => {
      const result = toStrictXhtml('<div><b>bold</b><span>text</span></div>');
      expect(result).toContain('<b>bold</b>');
      expect(result).toContain('text');
      expect(result).not.toContain('<div>');
      expect(result).not.toContain('<span>');
    });

    it('preserves allowed tags in lowercase', () => {
      const result = toStrictXhtml('<B>Bold</B><I>Italic</I>');
      expect(result).toContain('<b>Bold</b>');
      expect(result).toContain('<i>Italic</i>');
    });

    it('handles void tags correctly', () => {
      const result = toStrictXhtml('Line<br/>Break<hr/>Rule');
      expect(result).toContain('<br />');
      expect(result).toContain('<hr />');
    });

    it('drops attributes for security', () => {
      const result = toStrictXhtml('<b onclick="alert(1)" class="x">test</b>');
      expect(result).toContain('<b>test</b>');
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('class');
    });

    it('preserves text content', () => {
      const result = toStrictXhtml('Plain text with <b>bold</b> parts');
      expect(result).toContain('Plain text with');
      expect(result).toContain('<b>bold</b>');
      expect(result).toContain('parts');
    });
  });
});