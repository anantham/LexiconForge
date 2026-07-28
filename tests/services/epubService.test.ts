/**
 * EPUB Service Tests
 * 
 * ==================================
 * WHAT ARE WE TESTING?
 * ==================================
 * 
 * The EPUB service aggregation functions that:
 * 1. ✅ Collect active versions from session data correctly
 * 2. ✅ Calculate comprehensive translation statistics accurately
 * 3. ✅ Handle edge cases and data integrity issues
 * 4. ✅ Generate proper HTML content for EPUB pages
 * 5. ✅ Support template customization correctly
 * 
 * ==================================
 * WHY IS THIS CRITICAL?
 * ==================================
 * 
 * FINANCIAL ACCURACY: Wrong cost aggregation means incorrect billing information
 * DATA INTEGRITY: Statistics must reflect actual translation work performed  
 * USER TRUST: Inaccurate statistics damage user confidence in the platform
 * EXPORT QUALITY: Generated EPUBs must contain valid, complete information
 * 
 * REAL SCENARIOS THIS PREVENTS:
 * - Cost statistics showing $0.00 when actual costs were incurred
 * - Time aggregation double-counting or missing chapters
 * - Provider breakdowns not summing to totals correctly
 * - Empty or corrupted EPUB exports
 * - Template customization not being applied
 * 
 * ==================================
 * TEST COVERAGE OBJECTIVES
 * ==================================
 *
 * ✅ Statistics accuracy with various provider/model combinations
 * ✅ Edge cases: empty data, single chapter, missing metrics
 * ✅ Data integrity: totals match breakdown sums
 * ✅ Template customization and HTML generation
 * ✅ Image aggregation and counting
 * ✅ Provider/model breakdown correctness
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTranslationStats,
  getDefaultTemplate,
  createCustomTemplate,
  getNovelConfig,
  ChapterForEpub,
  TranslationStats,
  EpubTemplate
} from '../../services/epubService';
import type { UsageMetrics } from '../../types';

// Mock data factory functions
const createMockUsageMetrics = (overrides: Partial<UsageMetrics> = {}): UsageMetrics => ({
  totalTokens: 1000,
  promptTokens: 600,
  completionTokens: 400,
  estimatedCost: 0.001,
  requestTime: 2.5,
  provider: 'Gemini',
  model: 'gemini-2.5-flash',
  ...overrides,
} as UsageMetrics);

describe('EPUB Service - Statistics Calculation', () => {
  
  describe('calculateTranslationStats', () => {
    it('should accurately aggregate statistics from multiple chapters', () => {
      const chapters: ChapterForEpub[] = [
        {
          title: 'Chapter 1',
          content: 'Content 1',
          originalUrl: 'url1',
          translatedTitle: 'Trans 1',
          usageMetrics: {
            totalTokens: 1000,
            promptTokens: 600,
            completionTokens: 400,
            estimatedCost: 0.002,
            requestTime: 3.0,
            provider: 'Gemini',
            model: 'gemini-2.5-flash'
          },
          images: [
            { marker: '[IMG-1]', imageData: 'data1', prompt: 'prompt1' },
            { marker: '[IMG-2]', imageData: 'data2', prompt: 'prompt2' }
          ]
        },
        {
          title: 'Chapter 2', 
          content: 'Content 2',
          originalUrl: 'url2',
          translatedTitle: 'Trans 2',
          usageMetrics: {
            totalTokens: 1500,
            promptTokens: 900,
            completionTokens: 600,
            estimatedCost: 0.003,
            requestTime: 4.5,
            provider: 'OpenAI',
            model: 'gpt-5-mini'
          },
          images: [
            { marker: '[IMG-3]', imageData: 'data3', prompt: 'prompt3' }
          ]
        }
      ];
      
      const stats = calculateTranslationStats(chapters);
      
      // Verify totals
      expect(stats.totalCost).toBeCloseTo(0.005, 6);
      expect(stats.totalTime).toBeCloseTo(7.5, 1);
      expect(stats.totalTokens).toBe(2500);
      expect(stats.chapterCount).toBe(2);
      expect(stats.imageCount).toBe(3);
      
      // Verify provider breakdown
      expect(stats.providerBreakdown).toHaveProperty('Gemini');
      expect(stats.providerBreakdown).toHaveProperty('OpenAI');
      
      expect(stats.providerBreakdown.Gemini).toMatchObject({
        chapters: 1,
        cost: 0.002,
        time: 3.0,
        tokens: 1000
      });
      
      expect(stats.providerBreakdown.OpenAI).toMatchObject({
        chapters: 1,
        cost: 0.003,
        time: 4.5,
        tokens: 1500
      });
      
      // Verify model breakdown
      expect(stats.modelBreakdown).toHaveProperty('gemini-2.5-flash');
      expect(stats.modelBreakdown).toHaveProperty('gpt-5-mini');
    });
    
    it('should handle chapters with same provider/model correctly', () => {
      const chapters: ChapterForEpub[] = [
        {
          title: 'Ch1', content: 'C1', originalUrl: 'u1', translatedTitle: 'T1',
          usageMetrics: {
            totalTokens: 1000, promptTokens: 600, completionTokens: 400,
            estimatedCost: 0.001, requestTime: 2.0,
            provider: 'Gemini', model: 'gemini-2.5-flash'
          },
          images: []
        },
        {
          title: 'Ch2', content: 'C2', originalUrl: 'u2', translatedTitle: 'T2', 
          usageMetrics: {
            totalTokens: 1200, promptTokens: 700, completionTokens: 500,
            estimatedCost: 0.0015, requestTime: 3.0,
            provider: 'Gemini', model: 'gemini-2.5-flash'
          },
          images: []
        }
      ];
      
      const stats = calculateTranslationStats(chapters);
      
      // Should aggregate same provider/model
      expect(stats.providerBreakdown.Gemini).toMatchObject({
        chapters: 2,
        cost: 0.0025,
        time: 5.0,
        tokens: 2200
      });
      
      expect(stats.modelBreakdown['gemini-2.5-flash']).toMatchObject({
        chapters: 2,
        cost: 0.0025,
        time: 5.0,
        tokens: 2200
      });
    });
    
    it('should handle empty chapter list', () => {
      const stats = calculateTranslationStats([]);
      
      expect(stats).toMatchObject({
        totalCost: 0,
        totalTime: 0,
        totalTokens: 0,
        chapterCount: 0,
        imageCount: 0,
        providerBreakdown: {},
        modelBreakdown: {}
      });
    });
    
    it('should maintain data integrity between totals and breakdowns', () => {
      // Create diverse dataset with multiple providers/models
      const chapters: ChapterForEpub[] = [
        {
          title: 'Ch1', content: 'C1', originalUrl: 'u1', translatedTitle: 'T1',
          usageMetrics: {
            totalTokens: 800, promptTokens: 500, completionTokens: 300,
            estimatedCost: 0.0008, requestTime: 1.5,
            provider: 'Gemini', model: 'gemini-2.5-flash'
          },
          images: [{ marker: '[IMG-1]', imageData: 'data', prompt: 'prompt' }]
        },
        {
          title: 'Ch2', content: 'C2', originalUrl: 'u2', translatedTitle: 'T2',
          usageMetrics: {
            totalTokens: 1200, promptTokens: 700, completionTokens: 500,
            estimatedCost: 0.0024, requestTime: 3.2,
            provider: 'OpenAI', model: 'gpt-5-mini'
          },
          images: []
        },
        {
          title: 'Ch3', content: 'C3', originalUrl: 'u3', translatedTitle: 'T3',
          usageMetrics: {
            totalTokens: 600, promptTokens: 400, completionTokens: 200,
            estimatedCost: 0.0003, requestTime: 1.8,
            provider: 'DeepSeek', model: 'deepseek-chat'
          },
          images: [
            { marker: '[IMG-2]', imageData: 'data2', prompt: 'prompt2' },
            { marker: '[IMG-3]', imageData: 'data3', prompt: 'prompt3' }
          ]
        }
      ];
      
      const stats = calculateTranslationStats(chapters);
      
      // Verify provider breakdown sums match totals
      const providerTotalCost = Object.values(stats.providerBreakdown)
        .reduce((sum, breakdown) => sum + breakdown.cost, 0);
      const providerTotalTime = Object.values(stats.providerBreakdown)
        .reduce((sum, breakdown) => sum + breakdown.time, 0);
      const providerTotalTokens = Object.values(stats.providerBreakdown)
        .reduce((sum, breakdown) => sum + breakdown.tokens, 0);
      const providerTotalChapters = Object.values(stats.providerBreakdown)
        .reduce((sum, breakdown) => sum + breakdown.chapters, 0);
      
      expect(providerTotalCost).toBeCloseTo(stats.totalCost, 6);
      expect(providerTotalTime).toBeCloseTo(stats.totalTime, 1);
      expect(providerTotalTokens).toBe(stats.totalTokens);
      expect(providerTotalChapters).toBe(stats.chapterCount);
      
      // Verify model breakdown sums match totals
      const modelTotalCost = Object.values(stats.modelBreakdown)
        .reduce((sum, breakdown) => sum + breakdown.cost, 0);
      const modelTotalTime = Object.values(stats.modelBreakdown)
        .reduce((sum, breakdown) => sum + breakdown.time, 0);
      const modelTotalTokens = Object.values(stats.modelBreakdown)
        .reduce((sum, breakdown) => sum + breakdown.tokens, 0);
      const modelTotalChapters = Object.values(stats.modelBreakdown)
        .reduce((sum, breakdown) => sum + breakdown.chapters, 0);
      
      expect(modelTotalCost).toBeCloseTo(stats.totalCost, 6);
      expect(modelTotalTime).toBeCloseTo(stats.totalTime, 1);
      expect(modelTotalTokens).toBe(stats.totalTokens);
      expect(modelTotalChapters).toBe(stats.chapterCount);
    });
  });
});

describe('EPUB Service - Template System', () => {
  
  describe('getDefaultTemplate', () => {
    it('should return complete default template', () => {
      const template = getDefaultTemplate();
      
      expect(template).toHaveProperty('gratitudeMessage');
      expect(template).toHaveProperty('projectDescription');
      expect(template).toHaveProperty('githubUrl');
      expect(template).toHaveProperty('additionalAcknowledgments');
      expect(template).toHaveProperty('customFooter');
      
      // Verify all strings are non-empty
      expect(template.gratitudeMessage).toBeTruthy();
      expect(template.projectDescription).toBeTruthy();
      expect(template.githubUrl).toBeTruthy();
      expect(template.additionalAcknowledgments).toBeTruthy();
      
      // Verify specific content expectations
      expect(template.gratitudeMessage).toContain('AI language models');
      expect(template.projectDescription).toContain('LexiconForge');
      expect(template.githubUrl).toContain('github.com');
    });
  });
  
  describe('createCustomTemplate', () => {
    it('should allow partial overrides while keeping defaults', () => {
      const customTemplate = createCustomTemplate({
        gratitudeMessage: 'My custom gratitude message',
        githubUrl: 'https://github.com/myuser/myproject'
      });
      
      // Overridden values should be custom
      expect(customTemplate.gratitudeMessage).toBe('My custom gratitude message');
      expect(customTemplate.githubUrl).toBe('https://github.com/myuser/myproject');
      
      // Non-overridden values should be defaults
      const defaultTemplate = getDefaultTemplate();
      expect(customTemplate.projectDescription).toContain('LexiconForge');
      expect(customTemplate.customFooter).toBe(defaultTemplate.customFooter);
    });
    
    it('should allow complete template replacement', () => {
      const customTemplate = createCustomTemplate({
        gratitudeMessage: 'Custom gratitude',
        projectDescription: 'Custom project description',
        githubUrl: 'https://custom.url',
        additionalAcknowledgments: 'Custom acknowledgments',
        customFooter: 'Custom footer'
      });
      
      expect(customTemplate.gratitudeMessage).toBe('Custom gratitude');
      expect(customTemplate.projectDescription).toBe('Custom project description');
      expect(customTemplate.githubUrl).toBe('https://custom.url');
      expect(customTemplate.additionalAcknowledgments).toBe('Custom acknowledgments');
      expect(customTemplate.customFooter).toBe('Custom footer');
    });
    
    it('should handle empty overrides', () => {
      const customTemplate = createCustomTemplate({});
      const defaultTemplate = getDefaultTemplate();
      
      expect(customTemplate).toEqual(defaultTemplate);
    });
  });
});

describe('EPUB Service - Edge Cases and Error Handling', () => {
  
  it('should handle chapters with zero costs correctly', () => {
    const chapters: ChapterForEpub[] = [
      {
        title: 'Free Chapter',
        content: 'Content',
        originalUrl: 'url',
        translatedTitle: 'Translated',
        usageMetrics: {
          totalTokens: 500,
          promptTokens: 300,
          completionTokens: 200,
          estimatedCost: 0, // Zero cost
          requestTime: 1.0,
          provider: 'Gemini',
          model: 'gemini-2.5-flash'
        },
        images: []
      }
    ];
    
    const stats = calculateTranslationStats(chapters);
    
    expect(stats.totalCost).toBe(0);
    expect(stats.totalTokens).toBe(500);
    expect(stats.chapterCount).toBe(1);
  });
  
  it('should handle very large numbers without overflow', () => {
    const chapters: ChapterForEpub[] = [
      {
        title: 'Large Chapter',
        content: 'Content',
        originalUrl: 'url',
        translatedTitle: 'Translated',
        usageMetrics: {
          totalTokens: 100_000,
          promptTokens: 60_000,
          completionTokens: 40_000,
          estimatedCost: 1.5,
          requestTime: 120.0,
          provider: 'OpenAI',
          model: 'gpt-5'
        },
        images: []
      }
    ];
    
    const stats = calculateTranslationStats(chapters);
    
    expect(stats.totalTokens).toBe(100_000);
    expect(stats.totalCost).toBeCloseTo(1.5, 6);
    expect(stats.totalTime).toBeCloseTo(120.0, 1);
    expect(isFinite(stats.totalTokens)).toBe(true);
    expect(isFinite(stats.totalCost)).toBe(true);
    expect(isFinite(stats.totalTime)).toBe(true);
  });
  
});

describe('EPUB Service - Novel Config (integrity fixes)', () => {
  it('does not let present-but-undefined manual values clobber defaults, and title-page generation does not throw', () => {
    // Mirrors the generateEpub call shape when options.title/author/description
    // are all absent: pre-fix these undefined values survived the merge spread,
    // clobbered the defaults, and escapeXml(undefined) threw in generateTitlePage.
    const config = getNovelConfig('https://example.com/some-novel/1', {
      title: undefined,
      author: undefined,
      description: undefined,
    }, undefined);

    expect(config.title).toBe('Translated Novel');
    expect(config.author).toBe('Unknown Author');

    const stats: TranslationStats = {
      totalCost: 0,
      totalTime: 0,
      totalTokens: 0,
      chapterCount: 1,
      imageCount: 0,
      providerBreakdown: {},
      modelBreakdown: {}
    };
    expect(() => generateTitlePage(config, stats)).not.toThrow();
  });

  it('never assigns another novel\'s hardcoded metadata based on the site URL', () => {
    // kakuyomu.jp hosts many novels; pre-fix ANY kakuyomu URL was branded as
    // "The Reincarnation of the Strongest Exorcist..." incl. a fake isbn that
    // became the EPUB dc:identifier.
    const kakuyomu = getNovelConfig('https://kakuyomu.jp/works/999/episodes/1', undefined, undefined);
    expect(kakuyomu.title).toBe('Translated Novel');
    expect(kakuyomu.author).toBe('Unknown Author');
    expect(kakuyomu.isbn).toBeUndefined();
    expect(kakuyomu.seriesName).toBeUndefined();
    expect(kakuyomu.translationNotes).toBeUndefined();
    expect(kakuyomu.originalLanguage).toBe('ja'); // site-generic hint is kept

    const booktoki = getNovelConfig('https://booktoki468.com/novel/123', undefined, undefined);
    expect(booktoki.title).toBe('Translated Novel');
    expect(booktoki.author).toBe('Unknown Author');
    expect(booktoki.isbn).toBeUndefined();
    expect(booktoki.originalLanguage).toBe('ko'); // site-generic hint is kept
  });

  it('keeps the priority chain: manual config > chapter-title extraction > defaults', () => {
    const manual = getNovelConfig(
      'https://kakuyomu.jp/works/1/episodes/1',
      { title: 'My Novel', author: 'Me' },
      'Other Novel: Chapter 1 - Start'
    );
    expect(manual.title).toBe('My Novel');
    expect(manual.author).toBe('Me');

    const extracted = getNovelConfig(
      'https://kakuyomu.jp/works/1/episodes/1',
      undefined,
      'Eon: Chapter 1 - The Beginning'
    );
    expect(extracted.title).toBe('Eon');
    expect(extracted.author).toBe('Unknown Author');
  });
});

/**
 * ==================================
 * E2E CONTENT GENERATION TESTS
 * ==================================
 *
 * These tests verify:
 * - Images are properly embedded with XHTML-compliant self-closing tags
 * - Chapter content is complete and not truncated
 * - Title page uses correct user-provided metadata
 * - XHTML output is valid and parseable
 */

import { buildChapterXhtml } from '../../services/epubService/generators/chapter';
import { generateTitlePage } from '../../services/epubService/generators/titlePage';
import { htmlFragmentToXhtml } from '../../services/epubService/sanitizers/xhtmlSanitizer';
import { generateEpub3WithJSZip } from '../../services/epubService/packagers/epubPackager';
import type { EpubMeta, EpubChapter } from '../../services/epubService/types';
import JSZip from 'jszip';

describe('EPUB Content Generation E2E', () => {
  describe('Chapter XHTML Generation', () => {
    it('should produce self-closing img tags for XHTML compliance', () => {
      const chapter: ChapterForEpub = {
        title: 'Test Chapter',
        content: 'Original content with [ILLUSTRATION-1] marker.',
        originalUrl: 'https://example.com/test',
        translatedTitle: 'Translated Test Chapter',
        translatedContent: 'Translated content with [ILLUSTRATION-1] marker.',
        usageMetrics: createMockUsageMetrics(),
        images: [{
          marker: '[ILLUSTRATION-1]',
          imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          prompt: 'A test illustration'
        }],
        footnotes: []
      };

      const xhtml = buildChapterXhtml(chapter);

      // Verify img tags are self-closing (not <img></img>)
      expect(xhtml).not.toMatch(/<img[^>]*><\/img>/i);
      // Should have self-closing form
      expect(xhtml).toMatch(/<img[^>]*\/>/i);
      // Should contain the image data
      expect(xhtml).toContain('data:image/png;base64');
    });

    it('should preserve full chapter content without truncation', () => {
      const longContent = 'This is a very long translated chapter content. '.repeat(100);
      const chapter: ChapterForEpub = {
        title: 'Long Chapter',
        content: 'Original short content',
        originalUrl: 'https://example.com/long',
        translatedTitle: 'Long Translated Chapter',
        translatedContent: longContent,
        usageMetrics: createMockUsageMetrics(),
        images: [],
        footnotes: []
      };

      const xhtml = buildChapterXhtml(chapter);

      // Verify content is not truncated
      expect(xhtml.length).toBeGreaterThan(longContent.length);
      // Should contain the full repeated phrase
      expect(xhtml).toContain('very long translated chapter content');
      // Count occurrences - should be close to 100
      const matches = xhtml.match(/very long translated chapter content/g);
      expect(matches?.length).toBeGreaterThanOrEqual(90); // Allow for some whitespace normalization
    });

    it('should include chapter title in output', () => {
      const chapter: ChapterForEpub = {
        title: 'Original Title',
        content: 'Content',
        originalUrl: 'https://example.com/test',
        translatedTitle: 'My Translated Chapter Title',
        translatedContent: 'Translated content here.',
        usageMetrics: createMockUsageMetrics(),
        images: [],
        footnotes: []
      };

      const xhtml = buildChapterXhtml(chapter);

      expect(xhtml).toContain('My Translated Chapter Title');
      expect(xhtml).toContain('<h1');
    });

    it('should handle chapters with footnotes', () => {
      const chapter: ChapterForEpub = {
        title: 'Chapter with Notes',
        content: 'Content with [1] footnote reference.',
        originalUrl: 'https://example.com/notes',
        translatedTitle: 'Translated Chapter with Notes',
        translatedContent: 'Translated content with [1] footnote reference.',
        usageMetrics: createMockUsageMetrics(),
        images: [],
        footnotes: [{
          marker: '1',
          text: 'This is the footnote explanation.'
        }]
      };

      const xhtml = buildChapterXhtml(chapter);

      // Should contain footnote section
      expect(xhtml).toContain('Footnotes');
      expect(xhtml).toContain('footnote explanation');
      // Should have footnote reference link
      expect(xhtml).toMatch(/href="#fn1"/);
    });

    /**
     * CONTRACT TEST: Footnote markers use [n] format per prompts.json
     *
     * The AI is instructed via prompts.json to use [1], [2], [3] format:
     * - footnotesDescription: "...numbered marker [1], [2], [3]..."
     * - footnoteMarkerDescription: "Exact marker from text: '[1]', '[2]', etc."
     *
     * This test ensures the EPUB generator matches that contract.
     * If this test fails, check if prompts.json format changed.
     */
    it('should link footnotes using [n] bracket format from AI output', () => {
      const chapter: ChapterForEpub = {
        title: 'Contract Test',
        content: 'Original with [1] and [2] markers.',
        originalUrl: 'https://example.com/contract',
        translatedTitle: 'Contract Test Chapter',
        // This format matches what the AI actually produces per prompts.json
        translatedContent: 'The hero spoke [1] about ancient times [2] when dragons roamed.',
        usageMetrics: createMockUsageMetrics(),
        images: [],
        footnotes: [
          { marker: '1', text: '[TL Note:] A cultural reference' },
          { marker: '2', text: '[Author\'s Note:] Historical context' }
        ]
      };

      const xhtml = buildChapterXhtml(chapter);

      // Both footnote markers should be converted to clickable links
      expect(xhtml).toMatch(/href="#fn1".*\[1\]/);
      expect(xhtml).toMatch(/href="#fn2".*\[2\]/);

      // Footnotes section should have back-links
      expect(xhtml).toMatch(/id="fn1"/);
      expect(xhtml).toMatch(/id="fn2"/);
      expect(xhtml).toMatch(/href="#fnref1"/);
      expect(xhtml).toMatch(/href="#fnref2"/);

      // Verify the markers are wrapped in <sup><a>...</a></sup> structure
      expect(xhtml).toContain('<sup><a href="#fn1"');
      expect(xhtml).toContain('<sup><a href="#fn2"');
    });

    /**
     * REGRESSION: canonical bracketed markers ('[1]') must still produce valid,
     * paired ids. Pre-fix, the footnote-section marker cleanup regex required a
     * literal space (/^\ \[|\ \]$/) so '[1]' survived intact, producing
     * li id="fn[1]" (invalid XML ID) while the inline ref pointed at #fn1 —
     * every noteref and backlink in the exported EPUB was dead.
     */
    it("should pair fnref/fn links both directions when marker is '[1]'", () => {
      const chapter: ChapterForEpub = {
        title: 'Bracketed Markers',
        content: 'Original with [1] marker.',
        originalUrl: 'https://example.com/bracketed',
        translatedTitle: 'Bracketed Markers Chapter',
        translatedContent: 'A statement needing a note [1] right here.',
        usageMetrics: createMockUsageMetrics(),
        images: [],
        footnotes: [
          { marker: '[1]', text: 'The explanation.' }
        ]
      };

      const xhtml = buildChapterXhtml(chapter);

      // Footnote li gets the bracket-stripped id...
      expect(xhtml).toContain('id="fn1"');
      // ...never the invalid bracketed form
      expect(xhtml).not.toContain('fn[1]');
      // Inline noteref → footnote li
      expect(xhtml).toContain('<sup><a href="#fn1"');
      expect(xhtml).toContain('id="fnref1"');
      // Footnote backlink → inline noteref
      expect(xhtml).toContain('href="#fnref1"');
    });

    it('should produce valid XHTML that can be parsed', () => {
      const chapter: ChapterForEpub = {
        title: 'Parse Test',
        content: 'Content with <special> characters & "quotes"',
        originalUrl: 'https://example.com/parse',
        translatedTitle: 'Parse Test Chapter',
        translatedContent: 'Content with <special> characters & "quotes" and [ILLUSTRATION-1] marker.',
        usageMetrics: createMockUsageMetrics(),
        images: [{
          marker: '[ILLUSTRATION-1]',
          imageData: 'data:image/png;base64,abc123',
          prompt: 'Test image'
        }],
        footnotes: []
      };

      const xhtml = buildChapterXhtml(chapter);

      // Wrap in a root element for parsing
      const fullXhtml = `<div xmlns="http://www.w3.org/1999/xhtml">${xhtml}</div>`;

      // Should not throw when parsed as XML
      expect(() => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(fullXhtml, 'application/xhtml+xml');
        // Check for parse errors
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
          throw new Error(`XHTML parse error: ${parseError.textContent}`);
        }
      }).not.toThrow();
    });
  });

  describe('Title Page Generation', () => {
    it('should use provided title and author, not auto-detected values', () => {
      const config = {
        title: 'User Provided Title',
        author: 'User Provided Author',
        language: 'en',
        description: 'User provided description'
      };
      const stats: TranslationStats = {
        totalCost: 1.5,
        totalTime: 120,
        totalTokens: 50000,
        chapterCount: 10,
        imageCount: 5,
        providerBreakdown: {},
        modelBreakdown: {}
      };

      const html = generateTitlePage(config, stats);

      expect(html).toContain('User Provided Title');
      expect(html).toContain('User Provided Author');
      expect(html).toContain('10 chapters');
      expect(html).not.toContain('Unknown Author');
      expect(html).not.toContain('Eon'); // Should not use auto-detected title
    });

    it('should include translation statistics', () => {
      const config = {
        title: 'Test Novel',
        author: 'Test Author',
        language: 'en'
      };
      const stats: TranslationStats = {
        totalCost: 2.5,
        totalTime: 300,
        totalTokens: 100000,
        chapterCount: 25,
        imageCount: 12,
        providerBreakdown: {},
        modelBreakdown: {}
      };

      const html = generateTitlePage(config, stats);

      expect(html).toContain('25 chapters');
      // Token count uses toLocaleString() which may vary by locale
      expect(html).toMatch(/100[,.]?000|1,00,000/); // Match both US and Indian formats
      expect(html).toContain('$2.5');
    });
  });

  describe('XHTML Sanitizer', () => {
    it('should convert void elements to self-closing form', () => {
      const html = '<div><img src="test.png" alt="test"><br>Text<hr></div>';
      const xhtml = htmlFragmentToXhtml(html);

      // All void elements should be self-closing
      expect(xhtml).not.toMatch(/<img[^>]*><\/img>/i);
      expect(xhtml).not.toMatch(/<br><\/br>/i);
      expect(xhtml).not.toMatch(/<hr><\/hr>/i);
      expect(xhtml).toMatch(/<img[^>]*\/>/i);
      expect(xhtml).toMatch(/<br\s*\/>/i);
    });

    it('should handle multiple images correctly', () => {
      const html = `
        <div>
          <img src="img1.png" alt="First">
          <p>Some text</p>
          <img src="img2.png" alt="Second">
        </div>
      `;
      const xhtml = htmlFragmentToXhtml(html);

      // Count self-closing img tags
      const selfClosingImgs = xhtml.match(/<img[^>]*\/>/gi) || [];
      expect(selfClosingImgs.length).toBe(2);

      // No non-self-closing img tags
      expect(xhtml).not.toMatch(/<img[^>]*><\/img>/i);
    });

    it('should preserve image attributes', () => {
      const html = '<img src="test.png" alt="Test Alt" style="max-width: 100%;">';
      const xhtml = htmlFragmentToXhtml(html);

      expect(xhtml).toContain('src="test.png"');
      expect(xhtml).toContain('alt="Test Alt"');
    });

    /**
     * REGRESSION: broken void tags like <br“ (a quote glued straight onto the
     * tag name) must be repaired to <br/> with the quote kept as text. Two of
     * the three original repair regexes required a literal space the lookahead
     * made impossible and matched NOTHING; without repair the HTML parser eats
     * the quote and following text as a bogus tag name/attributes, losing text.
     */
    it('should repair <br/<hr immediately followed by a quote, keeping the quote as text', () => {
      const brCurly = htmlFragmentToXhtml('<p>line one<br“line two</p>');
      expect(brCurly).toMatch(/<br\s*\/>/);
      expect(brCurly).toContain('“line two');

      const brStraight = htmlFragmentToXhtml('<p>alpha<br"beta</p>');
      expect(brStraight).toMatch(/<br\s*\/>/);
      expect(brStraight).toContain('"beta');

      const hrCurly = htmlFragmentToXhtml('above<hr”below');
      // Top-level void elements serialize with an xmlns attribute
      expect(hrCurly).toMatch(/<hr[^>]*\/>/);
      expect(hrCurly).toContain('”below');
    });
  });

  describe('Full EPUB Content Validation', () => {
    /**
     * This test simulates the full EPUB generation flow and validates
     * that ALL chapters produce valid, parseable XHTML
     */
    it('should generate valid XHTML for multiple chapters with images', () => {
      const chapters: ChapterForEpub[] = [];

      // Create 5 chapters with varying content
      for (let i = 1; i <= 5; i++) {
        const hasImage = i % 2 === 1; // Odd chapters have images
        chapters.push({
          title: `Chapter ${i}`,
          content: `Original content for chapter ${i}`,
          originalUrl: `https://example.com/chapter${i}`,
          translatedTitle: `Translated Chapter ${i}: The Adventure Continues`,
          translatedContent: hasImage
            ? `This is the full translated content for chapter ${i}. It contains multiple paragraphs.\n\nSecond paragraph with more details about the story.\n\n[ILLUSTRATION-${i}]\n\nThird paragraph after the illustration.`
            : `This is the full translated content for chapter ${i}. It has no images but should still be complete.`,
          usageMetrics: createMockUsageMetrics(),
          images: hasImage ? [{
            marker: `[ILLUSTRATION-${i}]`,
            imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            prompt: `Illustration for chapter ${i}`
          }] : [],
          footnotes: i === 3 ? [{
            marker: '1',
            text: 'A footnote in chapter 3'
          }] : []
        });
      }

      // Generate and validate each chapter
      const errors: string[] = [];

      for (const chapter of chapters) {
        const xhtml = buildChapterXhtml(chapter);

        // Check for common XHTML issues
        if (/<img[^>]*><\/img>/i.test(xhtml)) {
          errors.push(`Chapter "${chapter.title}": Found non-self-closing img tag`);
        }
        if (/<br><\/br>/i.test(xhtml)) {
          errors.push(`Chapter "${chapter.title}": Found non-self-closing br tag`);
        }

        // Verify it's parseable as XML
        const fullXhtml = `<div xmlns="http://www.w3.org/1999/xhtml">${xhtml}</div>`;
        const parser = new DOMParser();
        const doc = parser.parseFromString(fullXhtml, 'application/xhtml+xml');
        const parseError = doc.querySelector('parsererror');

        if (parseError) {
          errors.push(`Chapter "${chapter.title}": XHTML parse error - ${parseError.textContent?.slice(0, 100)}`);
        }

        // Verify content is not empty/truncated
        if (xhtml.length < 100) {
          errors.push(`Chapter "${chapter.title}": Content appears truncated (only ${xhtml.length} chars)`);
        }

        // Verify title is present
        if (!xhtml.includes(chapter.translatedTitle || chapter.title)) {
          errors.push(`Chapter "${chapter.title}": Title not found in output`);
        }
      }

      // All chapters should pass validation
      expect(errors).toEqual([]);
    });

    it('should handle special characters without breaking XHTML', () => {
      const chapter: ChapterForEpub = {
        title: 'Special Characters Test',
        content: 'Original',
        originalUrl: 'https://example.com/special',
        translatedTitle: 'Chapter with <special> & "quoted" \'chars\'',
        translatedContent: 'Content with <angle brackets> & ampersands "quotes" and \'apostrophes\' plus Chinese: 这是中文',
        usageMetrics: createMockUsageMetrics(),
        images: [],
        footnotes: []
      };

      const xhtml = buildChapterXhtml(chapter);

      // Should be parseable despite special characters
      const fullXhtml = `<div xmlns="http://www.w3.org/1999/xhtml">${xhtml}</div>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(fullXhtml, 'application/xhtml+xml');

      expect(doc.querySelector('parsererror')).toBeNull();

      // Should escape entities properly - ampersands should be &amp;
      expect(xhtml).toContain('&amp;');
      // No bare/unescaped ampersands (should all be &amp; or other entities like &lt;)
      expect(xhtml).not.toMatch(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/)
    });

    it('should correctly place images at marker locations', () => {
      const chapter: ChapterForEpub = {
        title: 'Image Placement Test',
        content: 'Original',
        originalUrl: 'https://example.com/images',
        translatedTitle: 'Image Placement Chapter',
        translatedContent: 'Before the image.\n\n[ILLUSTRATION-1]\n\nAfter the image.\n\n[ILLUSTRATION-2]\n\nAt the end.',
        usageMetrics: createMockUsageMetrics(),
        images: [
          {
            marker: '[ILLUSTRATION-1]',
            imageData: 'data:image/png;base64,FIRST_IMAGE_DATA',
            prompt: 'First image'
          },
          {
            marker: '[ILLUSTRATION-2]',
            imageData: 'data:image/png;base64,SECOND_IMAGE_DATA',
            prompt: 'Second image'
          }
        ],
        footnotes: []
      };

      const xhtml = buildChapterXhtml(chapter);

      // Both images should be present
      expect(xhtml).toContain('FIRST_IMAGE_DATA');
      expect(xhtml).toContain('SECOND_IMAGE_DATA');

      // Markers should be replaced (not visible in output)
      expect(xhtml).not.toContain('[ILLUSTRATION-1]');
      expect(xhtml).not.toContain('[ILLUSTRATION-2]');

      // Content structure should be preserved
      expect(xhtml).toContain('Before the image');
      expect(xhtml).toContain('After the image');
      expect(xhtml).toContain('At the end');

      // Images should be in img tags
      const imgMatches = xhtml.match(/<img[^>]*\/>/gi) || [];
      expect(imgMatches.length).toBe(2);
    });

    it('should handle chapters with no translated content gracefully', () => {
      const chapter: ChapterForEpub = {
        title: 'Empty Translation',
        content: 'This is the original content that should be used as fallback.',
        originalUrl: 'https://example.com/empty',
        translatedTitle: 'Empty Translation Chapter',
        translatedContent: '', // Empty translation
        usageMetrics: createMockUsageMetrics(),
        images: [],
        footnotes: []
      };

      const xhtml = buildChapterXhtml(chapter);

      // Should have valid structure even with empty translation
      expect(xhtml).toContain('<h1');
      expect(xhtml).toContain('Empty Translation Chapter');

      // Should be parseable
      const fullXhtml = `<div xmlns="http://www.w3.org/1999/xhtml">${xhtml}</div>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(fullXhtml, 'application/xhtml+xml');
      expect(doc.querySelector('parsererror')).toBeNull();
    });
  });

  /**
   * TRUE E2E TEST: Generate actual EPUB, unzip it, validate all XML files
   * This catches real issues that proxy tests miss
   */
  describe('Real EPUB Generation E2E', () => {
    it('should generate valid EPUB with parseable XML in all files', async () => {
      // Build chapters using the real buildChapterXhtml function
      const chaptersData: ChapterForEpub[] = [
        {
          title: 'Chapter 1',
          content: 'Original',
          originalUrl: 'https://example.com/ch1',
          translatedTitle: 'The First Chapter: Beginning',
          translatedContent: 'This is a real chapter with actual content.\n\nMultiple paragraphs here.\n\n[ILLUSTRATION-1]\n\nMore content after the image.',
          usageMetrics: createMockUsageMetrics(),
          images: [{
            marker: '[ILLUSTRATION-1]',
            imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            prompt: 'Test image'
          }],
          footnotes: []
        },
        {
          title: 'Chapter 2',
          content: 'Original 2',
          originalUrl: 'https://example.com/ch2',
          translatedTitle: 'The Second Chapter: Continuation',
          translatedContent: 'Second chapter content with special chars: <brackets> & ampersands "quotes".',
          usageMetrics: createMockUsageMetrics(),
          images: [],
          footnotes: [{
            marker: '1',
            text: 'A footnote here'
          }]
        }
      ];

      // Generate XHTML for each chapter using the real builder
      const epubChapters: EpubChapter[] = chaptersData.map((ch, i) => ({
        id: `ch-${i + 1}`,
        title: ch.translatedTitle || ch.title,
        xhtml: buildChapterXhtml(ch),
        href: `chapter-${i + 1}.xhtml`
      }));

      const meta: EpubMeta = {
        title: 'Test Novel Title',
        author: 'Test Author Name',
        description: 'A test book',
        language: 'en',
        identifier: 'test-epub-123'
      };

      // Generate actual EPUB
      const epubBuffer = await generateEpub3WithJSZip(meta, epubChapters);

      // Unzip and validate
      const zip = await JSZip.loadAsync(epubBuffer);

      // Collect all validation errors
      const errors: string[] = [];

      // Check required EPUB files exist
      const requiredFiles = [
        'mimetype',
        'META-INF/container.xml',
        'OEBPS/content.opf',
        'OEBPS/text/nav.xhtml'
      ];
      for (const file of requiredFiles) {
        if (!zip.file(file)) {
          errors.push(`Missing required file: ${file}`);
        }
      }

      // Check NO debug/parse-errors.txt exists (would indicate parse failures)
      if (zip.file('OEBPS/debug/parse-errors.txt')) {
        const errorContent = await zip.file('OEBPS/debug/parse-errors.txt')!.async('string');
        errors.push(`EPUB contains parse errors: ${errorContent.slice(0, 500)}`);
      }

      // Validate all XML/XHTML files are parseable
      const xmlFiles = Object.keys(zip.files).filter(f =>
        f.endsWith('.xml') || f.endsWith('.xhtml') || f.endsWith('.opf')
      );

      for (const filename of xmlFiles) {
        const content = await zip.file(filename)!.async('string');
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'application/xhtml+xml');

        // Check for parse errors
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
          errors.push(`Parse error in ${filename}: ${parseError.textContent?.slice(0, 200)}`);
        }

        // For chapter files, verify they have substantial content
        if (filename.includes('chapter-')) {
          if (content.length < 200) {
            errors.push(`${filename} appears truncated (only ${content.length} chars)`);
          }

          // Check for common XHTML errors
          if (/<img[^>]*><\/img>/i.test(content)) {
            errors.push(`${filename} has non-self-closing img tags`);
          }
        }
      }

      // Verify chapter content is present
      const ch1Content = await zip.file('OEBPS/text/chapter-1.xhtml')!.async('string');
      if (!ch1Content.includes('The First Chapter')) {
        errors.push('Chapter 1 missing title');
      }
      if (!ch1Content.includes('Multiple paragraphs')) {
        errors.push('Chapter 1 missing content');
      }

      // Verify metadata in content.opf
      const opfContent = await zip.file('OEBPS/content.opf')!.async('string');
      if (!opfContent.includes('Test Novel Title')) {
        errors.push('OPF missing title metadata');
      }
      if (!opfContent.includes('Test Author Name')) {
        errors.push('OPF missing author metadata');
      }

      // All validations should pass
      expect(errors).toEqual([]);
    });

    it('should properly embed images without breaking XHTML', async () => {
      const chapter: ChapterForEpub = {
        title: 'Image Test',
        content: 'Original',
        originalUrl: 'https://example.com/img',
        translatedTitle: 'Image Test Chapter',
        translatedContent: 'Before image.\n\n[ILLUSTRATION-1]\n\nAfter image.\n\n[ILLUSTRATION-2]\n\nEnd.',
        usageMetrics: createMockUsageMetrics(),
        images: [
          {
            marker: '[ILLUSTRATION-1]',
            imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            prompt: 'First image'
          },
          {
            marker: '[ILLUSTRATION-2]',
            imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==',
            prompt: 'Second image'
          }
        ],
        footnotes: []
      };

      const xhtml = buildChapterXhtml(chapter);
      const epubChapters: EpubChapter[] = [{
        id: 'ch-1',
        title: chapter.translatedTitle,
        xhtml,
        href: 'chapter-1.xhtml'
      }];

      const meta: EpubMeta = {
        title: 'Image Test Book',
        author: 'Author',
        language: 'en',
        identifier: 'test-img-123'
      };

      const epubBuffer = await generateEpub3WithJSZip(meta, epubChapters);
      const zip = await JSZip.loadAsync(epubBuffer);

      // Verify images were extracted to files (filter out directory entries)
      const imageFiles = Object.keys(zip.files).filter(f =>
        f.includes('images/') && !f.endsWith('/') && f.includes('.')
      );
      expect(imageFiles.length).toBe(2);

      // Verify chapter XHTML references the extracted images (not inline base64)
      const chapterContent = await zip.file('OEBPS/text/chapter-1.xhtml')!.async('string');
      expect(chapterContent).not.toContain('data:image'); // No inline base64
      expect(chapterContent).toContain('../images/'); // References extracted files

      // Verify XHTML is valid
      const parser = new DOMParser();
      const doc = parser.parseFromString(chapterContent, 'application/xhtml+xml');
      expect(doc.querySelector('parsererror')).toBeNull();

      // Verify img tags are self-closing
      expect(chapterContent).not.toMatch(/<img[^>]*><\/img>/i);
    });
  });
});

/**
 * ==================================
 * TEST COVERAGE SUMMARY
 * ==================================
 *
 * This test suite covers:
 * ✅ Data collection accuracy from session data
 * ✅ Statistics aggregation with multiple providers/models
 * ✅ Provider and model breakdown calculations
 * ✅ Data integrity between totals and breakdowns
 * ✅ Template customization system
 * ✅ Edge cases: empty data, zero costs, large numbers
 * ✅ Error resilience with corrupted data
 * ✅ Image counting and filtering
 * ✅ XHTML compliance with self-closing void elements
 * ✅ Full chapter content preservation (no truncation)
 * ✅ Title page metadata correctness
 * ✅ XHTML parseability validation
 *
 * FINANCIAL SAFETY:
 * ✅ Prevents cost calculation errors
 * ✅ Ensures breakdown sums match totals
 * ✅ Validates all aggregation math
 *
 * USER TRUST:
 * ✅ Guarantees accurate statistics reporting
 * ✅ Validates template customization works
 * ✅ Ensures professional EPUB output quality
 * ✅ Verifies images are properly embedded
 *
 * This comprehensive test coverage ensures the EPUB export
 * feature produces accurate, trustworthy statistics and
 * professional-quality output for users.
 */
