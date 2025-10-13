/**
 * Integration Tests for EPUB Export Service
 *
 * The export service orchestrates the entire pipeline:
 * 1. Collect data from store
 * 2. Resolve assets from cache
 * 3. Build XHTML content
 * 4. Package into EPUB ZIP
 * 5. Report progress at each phase
 */

import { describe, it, expect, vi } from 'vitest';
import { exportEpub } from '../../services/epub/exportService';
import type { EpubExportOptions } from '../../services/epub/types';
import type { EnhancedChapter } from '../../services/stableIdService';

// Mock ImageCacheStore
vi.mock('../../services/imageCacheService', () => ({
  ImageCacheStore: {
    getImageBlob: vi.fn().mockResolvedValue(null) // Return null (cache miss, use fallback)
  }
}));

describe('exportEpub', () => {
  it('orchestrates full pipeline and returns EPUB blob', async () => {
    // Arrange: Create store snapshot with sample chapter
    const chapter1: EnhancedChapter = {
      id: 'ch-1',
      chapterNumber: 1,
      title: 'Chapter One',
      content: '<p>Original text</p>',
      translationResult: {
        translatedTitle: 'Capítulo Uno',
        translatedContent: '<p>Texto traducido [ILL-1] aquí.</p>',
        footnotes: [
          { marker: 'FN-1', text: 'Una nota al pie' }
        ],
        suggestedIllustrations: [
          {
            placementMarker: 'ILL-1',
            imagePrompt: 'A dramatic scene',
            generatedImage: {
              imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
              requestTime: 1.5,
              cost: 0.04
            }
          }
        ],
        provider: 'google',
        model: 'gemini-2.0-flash-exp',
        cost: 0.002,
        tokens: 1500,
        requestTime: 3.2
      },
      url: 'https://example.com/ch1',
      prevUrl: null,
      nextUrl: 'https://example.com/ch2'
    };

    const storeSnapshot = {
      chapters: new Map([['ch-1', chapter1]]),
      currentNovelTitle: 'Integration Test Novel'
    };

    const options: EpubExportOptions = {
      order: 'number',
      includeTitlePage: true,
      includeStatsPage: true,
      metadata: {
        gratitudeMessage: 'Thanks for testing!'
      },
      settings: {
        novelTitle: 'Integration Test Novel'
      } as any
    };

    const progressUpdates: any[] = [];
    const progressCallback = (progress: any) => {
      progressUpdates.push(progress);
    };

    // Act: Export EPUB
    const result = await exportEpub(options, storeSnapshot, progressCallback);

    // Assert: Success
    expect(result.success).toBe(true);
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.blob!.size).toBeGreaterThan(0);

    // Assert: Statistics
    expect(result.stats.totalChapters).toBe(1);
    expect(result.stats.assetsResolved).toBe(1); // Fallback to base64
    expect(result.stats.assetsMissing).toBe(0);
    expect(result.stats.durationMs).toBeGreaterThan(0);

    // Assert: Progress reported for all phases
    const phases = progressUpdates.map(p => p.phase);
    expect(phases).toContain('collecting');
    expect(phases).toContain('resolving');
    expect(phases).toContain('building');
    expect(phases).toContain('packaging');
    expect(phases).toContain('complete');

    // Assert: Progress percentages increase
    const percents = progressUpdates.map(p => p.percent);
    expect(percents[0]).toBeLessThan(percents[percents.length - 1]);
    expect(percents[percents.length - 1]).toBe(100);
  });

  it('handles errors gracefully and returns error result', async () => {
    // Arrange: Invalid store snapshot (empty)
    const storeSnapshot = {
      chapters: new Map(),
      currentNovelTitle: undefined
    };

    const options: EpubExportOptions = {
      order: 'number',
      includeTitlePage: false,
      includeStatsPage: false,
      settings: {} as any
    };

    // Act: Export should handle empty chapters
    const result = await exportEpub(options, storeSnapshot);

    // Assert: Returns error result
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.blob).toBeUndefined();
  });
});
