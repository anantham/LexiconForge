/**
 * Tests for EPUB Data Collector
 *
 * The data collector walks the session state and hydrates raw chapter data
 * needed for export: chapters, translations, metadata, and asset references.
 */

import { describe, it, expect } from 'vitest';
import { collectExportData } from '../../services/epub/dataCollector';
import type { EpubExportOptions } from '../../services/epub/types';
import { createMockEnhancedChapter, createMockTranslationResult, createMockUsageMetrics } from '../utils/test-data';

describe('collectExportData', () => {
  it('collects chapters with basic metadata from store snapshot', async () => {
    // Arrange: Create minimal fixture
    const translation = createMockTranslationResult({
      translatedTitle: 'Translated Chapter 1',
      translatedContent: '<p>Translated content</p>',
      translation: '<p>Translated content</p>',
      footnotes: [{ marker: 'FN-1', text: 'Footnote text' }],
      suggestedIllustrations: [
        {
          placementMarker: 'ILL-1',
          imagePrompt: 'A hero standing',
          generatedImage: {
            imageData: 'data:image/png;base64,abc123',
            requestTime: 1.5,
            cost: 0.04
          }
        }
      ],
      usageMetrics: createMockUsageMetrics({
        estimatedCost: 0.001,
        requestTime: 2.3,
        provider: 'Gemini',
        model: 'gemini-2.0-flash-exp',
        totalTokens: 1000,
        promptTokens: 600,
        completionTokens: 400
      })
    });

    const chapter1 = createMockEnhancedChapter({
      id: 'ch-1',
      chapterNumber: 1,
      title: 'Chapter 1',
      content: '<p>Original content</p>',
      translationResult: translation,
      url: 'https://example.com/ch1',
      originalUrl: 'https://example.com/ch1',
      canonicalUrl: 'https://example.com/ch1',
      prevUrl: null,
      nextUrl: 'https://example.com/ch2'
    });

    const storeSnapshot = {
      chapters: new Map([['ch-1', chapter1]]),
      currentNovelTitle: 'Test Novel'
    };

    const options: EpubExportOptions = {
      order: 'number',
      includeTitlePage: true,
      includeStatsPage: true,
      settings: {} as any // Minimal for this test
    };

    // Act: Collect data
    const result = await collectExportData(options, storeSnapshot);

    // Assert: Verify structure
    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0]).toMatchObject({
      id: 'ch-1',
      chapterNumber: 1,
      title: 'Chapter 1',
      content: '<p>Original content</p>',
      translatedTitle: 'Translated Chapter 1',
      translatedContent: '<p>Translated content</p>'
    });

    expect(result.chapters[0].footnotes).toHaveLength(1);
    expect(result.chapters[0].footnotes[0]).toMatchObject({
      marker: 'FN-1',
      text: 'Footnote text'
    });

    expect(result.chapters[0].imageReferences).toHaveLength(1);
    expect(result.chapters[0].imageReferences[0]).toMatchObject({
      placementMarker: 'ILL-1',
      prompt: 'A hero standing',
      base64Fallback: 'data:image/png;base64,abc123'
    });

    expect(result.metadata).toMatchObject({
      novelTitle: 'Test Novel',
      totalChapters: 1,
      translatedChapters: 1
    });

    expect(result.warnings).toEqual([]);
  });
});
