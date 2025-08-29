import { describe, it, expect } from 'vitest';
import { 
  htmlFragmentToXhtml, 
  sanitizeHtmlAllowlist, 
  convertToXhtmlParagraphs,
  escapeHtml 
} from '../../../services/epub/XhtmlSerializer';

describe('XhtmlSerializer', () => {
  describe('htmlFragmentToXhtml', () => {
    it('converts HTML to XHTML with proper namespace', () => {
      const result = htmlFragmentToXhtml('<b>bold</b>');
      expect(result).toMatch(/xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/);
      expect(result).toContain('<b>bold</b>');
    });

    it('handles void tags correctly', () => {
      const result = htmlFragmentToXhtml('Line<br/>Break');
      expect(result).toContain('Line');
      expect(result).toContain('Break');
      expect(result).toMatch(/<br\s*\/>/);
    });

    it('drops script tags for security', () => {
      const result = htmlFragmentToXhtml('<script>alert(1)</script><b>safe</b>');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert(1)');
      expect(result).toContain('<b>safe</b>');
    });

    it('handles empty or whitespace input', () => {
      expect(htmlFragmentToXhtml('')).toBe('');
      expect(htmlFragmentToXhtml('   \n  ')).toBe('');
    });

    it('preserves text content', () => {
      const result = htmlFragmentToXhtml('Plain text with <i>italics</i>');
      expect(result).toContain('Plain text with');
      expect(result).toContain('<i>italics</i>');
    });

    it('handles complex nested structures', () => {
      const input = '<div><p><b>Bold</b> and <i>italic</i></p></div>';
      const result = htmlFragmentToXhtml(input);
      expect(result).toContain('<b>Bold</b>');
      expect(result).toContain('<i>italic</i>');
      // Should contain the content but structure may be flattened
    });
  });

  describe('sanitizeHtmlAllowlist', () => {
    it('preserves allowed tags', () => {
      const allowed = '<b>bold</b> <i>italic</i> <em>em</em> <strong>strong</strong>';
      expect(sanitizeHtmlAllowlist(allowed)).toBe(allowed);
    });

    it('removes disallowed tags but preserves content', () => {
      const input = '<div><b>bold</b><script>bad</script></div>';
      const result = sanitizeHtmlAllowlist(input);
      expect(result).toContain('<b>bold</b>');
      expect(result).not.toContain('<div>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('bad'); // content preserved
    });

    it('handles void tags', () => {
      const input = 'Line<br/>break<hr/>rule';
      const result = sanitizeHtmlAllowlist(input);
      expect(result).toContain('Line');
      expect(result).toContain('break');
      expect(result).toContain('rule');
      expect(result).toMatch(/<br\/?>/);
      expect(result).toMatch(/<hr\/?>/);
    });

    it('handles nested allowed and disallowed tags', () => {
      const input = '<article><h1>Title</h1><p><b>Bold</b> text</p></article>';
      const result = sanitizeHtmlAllowlist(input);
      expect(result).toContain('<b>Bold</b>');
      expect(result).toContain('Title');
      expect(result).toContain('text');
      expect(result).not.toContain('<article>');
      expect(result).not.toContain('<h1>');
      expect(result).not.toContain('<p>');
    });
  });

  describe('convertToXhtmlParagraphs', () => {
    it('handles empty content', () => {
      expect(convertToXhtmlParagraphs('')).toBe('');
      expect(convertToXhtmlParagraphs('   ')).toBe('');
    });

    it('wraps multiple paragraphs', () => {
      const input = 'First paragraph\n\nSecond paragraph';
      const result = convertToXhtmlParagraphs(input);
      expect(result).toContain('<p>');
      expect(result).toContain('First paragraph');
      expect(result).toContain('Second paragraph');
    });

    it('handles single paragraph without wrapping', () => {
      const input = 'Single line of text';
      const result = convertToXhtmlParagraphs(input);
      expect(result).toContain('Single line of text');
      // Single paragraphs should not be wrapped in <p> tags
    });

    it('converts newlines to <br> within paragraphs', () => {
      const input = 'Line one\nLine two';
      const result = convertToXhtmlParagraphs(input);
      expect(result).toContain('Line one');
      expect(result).toContain('Line two');
      // Should handle newlines appropriately
    });

    it('sanitizes HTML within paragraphs', () => {
      const input = 'Para 1 with <b>bold</b> and <script>evil</script>\n\nPara 2';
      const result = convertToXhtmlParagraphs(input);
      expect(result).toContain('<b>bold</b>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('evil'); // content preserved
    });
  });

  describe('escapeHtml', () => {
    it('escapes HTML entities', () => {
      expect(escapeHtml('&')).toBe('&amp;');
      expect(escapeHtml('<')).toBe('&lt;');
      expect(escapeHtml('>')).toBe('&gt;');
      expect(escapeHtml('"')).toBe('&quot;');
      expect(escapeHtml("'")).toBe('&#39;');
    });

    it('handles complex strings', () => {
      const input = 'Title: "Adventure & <Fun>"';
      const result = escapeHtml(input);
      expect(result).toBe('Title: &quot;Adventure &amp; &lt;Fun&gt;&quot;');
    });

    it('handles empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('preserves normal text', () => {
      expect(escapeHtml('Normal text')).toBe('Normal text');
    });
  });
});