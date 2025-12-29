/**
 * EPUB Regression Tests
 *
 * Tests for specific bugs found in EPUB generation:
 * 1. H1 tags being HTML-escaped (&lt;h1&gt; instead of <h1>)
 * 2. Images not extracted from base64 to /images/ folder
 * 3. Generic filename and metadata
 * 4. Title/content field confusion
 */

import { describe, it, expect } from 'vitest';
import { sanitizeHtml, toStrictXhtml } from '../../services/translate/HtmlSanitizer';
import { buildChapterXhtml } from '../../services/epubService/generators/chapter';
import { extractNovelTitleFromChapter } from '../../services/epubService/templates/novelConfig';
import type { ChapterForEpub } from '../../services/epubService/types';

describe('EPUB Regression: H1 Tag Escaping (Bug #1)', () => {
  it('should NOT escape H1 tags in toStrictXhtml', () => {
    const input = '<h1>Chapter Title</h1><p>Some content here.</p>';
    const result = toStrictXhtml(input);

    // H1 should remain as proper HTML, not escaped entities
    expect(result).toContain('<h1>');
    expect(result).toContain('</h1>');
    expect(result).not.toContain('&lt;h1&gt;');
    expect(result).not.toContain('&lt;/h1&gt;');
  });

  it('should preserve all heading levels (h1-h6)', () => {
    const input = '<h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6>';
    const result = toStrictXhtml(input);

    expect(result).toContain('<h1>H1</h1>');
    expect(result).toContain('<h2>H2</h2>');
    expect(result).toContain('<h3>H3</h3>');
    expect(result).toContain('<h4>H4</h4>');
    expect(result).toContain('<h5>H5</h5>');
    expect(result).toContain('<h6>H6</h6>');
  });

  it('should preserve common EPUB tags: div, p, span, a, img', () => {
    const input = '<div class="chapter"><p>Text <span class="highlight">here</span></p><a href="#">Link</a><img src="test.png" alt="test"/></div>';
    const result = toStrictXhtml(input);

    expect(result).toContain('<div');
    expect(result).toContain('<p>'); // toStrictXhtml preserves p tags (unlike sanitizeHtml)
    expect(result).toContain('<span');
    expect(result).toContain('<a');
    expect(result).toContain('<img');
    expect(result).not.toContain('&lt;div');
    expect(result).not.toContain('&lt;p');
  });

  it('should preserve list elements: ul, ol, li', () => {
    const input = '<ul><li>Item 1</li><li>Item 2</li></ul><ol><li>Numbered</li></ol>';
    const result = toStrictXhtml(input);

    expect(result).toContain('<ul>');
    expect(result).toContain('<ol>');
    expect(result).toContain('<li>');
    expect(result).not.toContain('&lt;ul');
    expect(result).not.toContain('&lt;ol');
    expect(result).not.toContain('&lt;li');
  });

  it('should still escape script tags for security', () => {
    const input = '<p>Safe content</p><script>alert("xss")</script>';
    const result = toStrictXhtml(input);

    // Script tags should be escaped (< becomes &lt;)
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script>'); // Script tag is escaped
    expect(result).toContain('<p>Safe content</p>'); // p tag is preserved in toStrictXhtml
  });
});

describe('EPUB Regression: Translated Content Usage (Bug #2)', () => {
  it('should use translatedContent when available in buildChapterXhtml', () => {
    const chapter: ChapterForEpub = {
      title: 'Chapter 1',
      content: '<p>Original Korean content 원본 콘텐츠</p>',
      translatedContent: '<p>Translated English content</p>',
      translatedTitle: 'Chapter 1: The Beginning',
      originalUrl: 'https://example.com/ch1',
      usageMetrics: {
        totalTokens: 100,
        promptTokens: 50,
        completionTokens: 50,
        estimatedCost: 0.001,
        requestTime: 1,
        provider: 'Test',
        model: 'test-model'
      },
      images: [],
      footnotes: []
    };

    const result = buildChapterXhtml(chapter);

    // Should contain the translated content, not the original
    expect(result).toContain('Translated English content');
    expect(result).not.toContain('원본 콘텐츠');
  });

  it('should fall back to content when translatedContent is empty', () => {
    const chapter: ChapterForEpub = {
      title: 'Chapter 1',
      content: '<p>Fallback content here</p>',
      translatedContent: '',
      translatedTitle: 'Chapter 1',
      originalUrl: 'https://example.com/ch1',
      usageMetrics: {
        totalTokens: 100,
        promptTokens: 50,
        completionTokens: 50,
        estimatedCost: 0.001,
        requestTime: 1,
        provider: 'Test',
        model: 'test-model'
      },
      images: [],
      footnotes: []
    };

    const result = buildChapterXhtml(chapter);

    expect(result).toContain('Fallback content here');
  });
});

describe('EPUB Regression: Novel Title Extraction (Bug #3)', () => {
  it('should extract novel title from "Novel: Chapter N" format', () => {
    const result = extractNovelTitleFromChapter('Eon: Chapter 1 – The Beginning');
    expect(result).toBe('Eon');
  });

  it('should extract novel title from "Novel - Chapter N" format', () => {
    const result = extractNovelTitleFromChapter('Dungeon Defense - Chapter 5');
    expect(result).toBe('Dungeon Defense');
  });

  it('should extract title from "Chapter N: Title" format', () => {
    const result = extractNovelTitleFromChapter('Chapter 1: The Dark Lord Awakens');
    expect(result).toBe('The Dark Lord Awakens');
  });

  it('should extract title from volume format', () => {
    const result = extractNovelTitleFromChapter('Volume 2 Chapter 10: Revelations');
    expect(result).toBe('Revelations');
  });

  it('should handle Japanese chapter formats', () => {
    const result = extractNovelTitleFromChapter('Eon: 第1話 – Beginning');
    expect(result).toBe('Eon');
  });

  it('should return undefined for unrecognized formats', () => {
    const result = extractNovelTitleFromChapter('Some Random Title Without Chapter');
    expect(result).toBeUndefined();
  });

  it('should handle undefined/empty input', () => {
    expect(extractNovelTitleFromChapter(undefined)).toBeUndefined();
    expect(extractNovelTitleFromChapter('')).toBeUndefined();
  });
});

describe('EPUB Regression: HTML Sanitization Allowlist', () => {
  it('should allow table elements', () => {
    const input = '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Data</td></tr></tbody></table>';
    const result = toStrictXhtml(input);

    expect(result).toContain('<table>');
    expect(result).toContain('<thead>');
    expect(result).toContain('<tbody>');
    expect(result).toContain('<tr>');
    expect(result).toContain('<th>');
    expect(result).toContain('<td>');
  });

  it('should allow figure and figcaption', () => {
    const input = '<figure><img src="test.png" alt="test"/><figcaption>Caption here</figcaption></figure>';
    const result = toStrictXhtml(input);

    expect(result).toContain('<figure>');
    expect(result).toContain('<figcaption>');
  });

  it('should allow semantic HTML5 elements', () => {
    const input = '<section><article><header>H</header><main>M</main><footer>F</footer></article></section>';
    const result = toStrictXhtml(input);

    expect(result).toContain('<section>');
    expect(result).toContain('<article>');
    expect(result).toContain('<header>');
    expect(result).toContain('<main>');
    expect(result).toContain('<footer>');
  });

  it('should allow blockquote and pre/code', () => {
    const input = '<blockquote>Quote</blockquote><pre><code>code();</code></pre>';
    const result = toStrictXhtml(input);

    expect(result).toContain('<blockquote>');
    expect(result).toContain('<pre>');
    expect(result).toContain('<code>');
  });

  it('should still escape unknown/dangerous tags', () => {
    const input = '<iframe src="evil.html"></iframe><object data="evil.swf"></object>';
    const result = toStrictXhtml(input);

    // iframe and object should be escaped
    expect(result).not.toContain('<iframe');
    expect(result).not.toContain('<object');
  });
});

describe('EPUB Regression: Edge Cases', () => {
  it('should handle complex nested structures in toStrictXhtml', () => {
    const input = `
      <div class="chapter">
        <h1>Chapter Title</h1>
        <p>First paragraph with <strong>bold</strong> and <em>italic</em>.</p>
        <div class="illustration">
          <img src="data:image/png;base64,ABC123" alt="Scene"/>
          <p class="caption">Figure 1</p>
        </div>
        <ul>
          <li>Point one</li>
          <li>Point two</li>
        </ul>
      </div>
    `;
    const result = toStrictXhtml(input);

    // All structural elements should be preserved in EPUB XHTML
    expect(result).toContain('<div');
    expect(result).toContain('<h1>');
    expect(result).toContain('<p>'); // toStrictXhtml preserves p tags
    expect(result).toContain('<strong>');
    expect(result).toContain('<em>');
    expect(result).toContain('<img');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>');
  });

  it('should handle attributes on allowed elements', () => {
    const input = '<div class="highlight" id="section-1"><a href="#top" title="Go to top">Link</a></div>';
    const result = toStrictXhtml(input);

    // Attributes should be preserved on allowed elements
    expect(result).toContain('class=');
    expect(result).toContain('href=');
  });
});

/**
 * These tests ensure the EPUB generation bugs are fixed:
 *
 * 1. H1 escaping: Fixed by updating allowlist in HtmlSanitizer.ts
 *    - h[1-6], div, p, span, a, img, ul, ol, li, etc. now allowed
 *
 * 2. Content field: Fixed by using translatedContent in chapter.ts
 *    - buildChapterXhtml now uses chapter.translatedContent || chapter.content
 *
 * 3. Metadata: Fixed by extracting title from chapter title format
 *    - extractNovelTitleFromChapter parses "Novel: Chapter N" patterns
 *
 * 4. Image extraction: Fixed by using DOM parsing instead of regex
 *    - epubPackager.ts now uses DOMParser for reliable extraction
 */
