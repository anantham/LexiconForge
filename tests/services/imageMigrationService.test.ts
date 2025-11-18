/**
 * Tests for Image Migration Service
 *
 * Migrates legacy base64 images from chapter data to Cache API
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';
import { createChaptersSlice, type ChaptersSlice } from '../../store/slices/chaptersSlice';
import { migrateImagesToCache } from '../../services/imageMigrationService';
import { ImageCacheStore } from '../../services/imageCacheService';
import { createMockEnhancedChapter, createMockImageCacheKey, createMockTranslationResult, createMockUsageMetrics } from '../utils/test-data';

// Create a test store
const createTestStore = () => {
  return create<ChaptersSlice>()((...args) => createChaptersSlice(...args));
};

describe('imageMigrationService', () => {
  beforeEach(async () => {
    // Clear cache before each test
    if (ImageCacheStore.isSupported()) {
      await ImageCacheStore.clear();
    }
  });

  it('migrates chapters with legacy base64 images to Cache API', async () => {
    const store = createTestStore();

    // Create chapter with legacy base64 image (no cache key)
    const legacyTranslation = createMockTranslationResult({
      translatedTitle: 'Capítulo Legacy',
      translation: '<p>Contenido viejo</p>',
      translatedContent: '<p>Contenido viejo</p>',
      suggestedIllustrations: [
        {
          placementMarker: 'ILL-OLD-1',
          imagePrompt: 'A legacy scene',
          generatedImage: {
            imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            requestTime: 1.5,
            cost: 0.04
          }
        }
      ],
      usageMetrics: createMockUsageMetrics({
        estimatedCost: 0.001,
        requestTime: 2.5,
        provider: 'Gemini',
        model: 'gemini-2.0-flash-exp',
        totalTokens: 1000,
        promptTokens: 600,
        completionTokens: 400
      })
    });

    const legacyChapter = createMockEnhancedChapter({
      id: 'ch-legacy',
      chapterNumber: 1,
      title: 'Legacy Chapter',
      content: '<p>Old content</p>',
      translationResult: legacyTranslation,
      url: 'https://example.com/legacy',
      originalUrl: 'https://example.com/legacy',
      canonicalUrl: 'https://example.com/legacy',
      prevUrl: null,
      nextUrl: null
    });

    // Import legacy chapter
    store.getState().importChapter(legacyChapter);

    // Act: Run migration
    const result = await migrateImagesToCache(store.getState().chapters);

    // Assert: Migration completed successfully
    expect(result.success).toBe(true);
    expect(result.migratedImages).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Assert: Image is now in cache
    const cacheKey = createMockImageCacheKey({ chapterId: 'ch-legacy', placementMarker: 'ILL-OLD-1' });
    const inCache = await ImageCacheStore.has(cacheKey);
    expect(inCache).toBe(true);

    // Assert: Chapter updated to use cache key
    const updatedChapter = store.getState().chapters.get('ch-legacy');
    expect(updatedChapter).toBeDefined();
    const illustration = updatedChapter!.translationResult!.suggestedIllustrations[0];
    expect(illustration.generatedImage?.imageCacheKey).toEqual(expect.objectContaining({
      chapterId: 'ch-legacy',
      placementMarker: 'ILL-OLD-1'
    }));
    expect(illustration.generatedImage?.imageData).toBe(''); // Cleared
  });

  it('skips chapters that already use cache keys', async () => {
    const store = createTestStore();

    // Create chapter with modern cache key (no base64)
    const modernTranslation = createMockTranslationResult({
      translatedTitle: 'Capítulo Modern',
      translation: '<p>Contenido nuevo</p>',
      translatedContent: '<p>Contenido nuevo</p>',
      suggestedIllustrations: [
        {
          placementMarker: 'ILL-NEW-1',
          imagePrompt: 'A modern scene',
          generatedImage: {
            imageData: '',
            imageCacheKey: createMockImageCacheKey({ chapterId: 'ch-modern', placementMarker: 'ILL-NEW-1' }),
            requestTime: 1.2,
            cost: 0.03
          }
        }
      ],
      usageMetrics: createMockUsageMetrics({
        estimatedCost: 0.002,
        requestTime: 3.0,
        provider: 'Gemini',
        model: 'gemini-2.0-flash-exp',
        totalTokens: 1500,
        promptTokens: 900,
        completionTokens: 600
      })
    });

    const modernChapter = createMockEnhancedChapter({
      id: 'ch-modern',
      chapterNumber: 2,
      title: 'Modern Chapter',
      content: '<p>New content</p>',
      translationResult: modernTranslation,
      url: 'https://example.com/modern',
      originalUrl: 'https://example.com/modern',
      canonicalUrl: 'https://example.com/modern',
      prevUrl: null,
      nextUrl: null
    });

    store.getState().importChapter(modernChapter);

    // Act: Run migration
    const result = await migrateImagesToCache(store.getState().chapters);

    // Assert: Nothing migrated
    expect(result.success).toBe(true);
    expect(result.migratedImages).toBe(0);
    expect(result.skippedImages).toBe(1);
  });

  it('handles chapters without translations', async () => {
    const store = createTestStore();

    const plainChapter = createMockEnhancedChapter({
      id: 'ch-plain',
      chapterNumber: 3,
      title: 'Plain Chapter',
      content: '<p>Just content</p>',
      url: 'https://example.com/plain',
      originalUrl: 'https://example.com/plain',
      canonicalUrl: 'https://example.com/plain',
      prevUrl: null,
      nextUrl: null
    });

    store.getState().importChapter(plainChapter);

    // Act: Run migration
    const result = await migrateImagesToCache(store.getState().chapters);

    // Assert: No errors
    expect(result.success).toBe(true);
    expect(result.migratedImages).toBe(0);
  });

  it('provides dry-run preview without modifying data', async () => {
    const store = createTestStore();

    const dryTranslation = createMockTranslationResult({
      translatedTitle: 'Título',
      translation: '<p>Contenido</p>',
      translatedContent: '<p>Contenido</p>',
      suggestedIllustrations: [
        {
          placementMarker: 'ILL-DRY-1',
          imagePrompt: 'Scene',
          generatedImage: {
            imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            requestTime: 1.0,
            cost: 0.02
          }
        }
      ],
      usageMetrics: createMockUsageMetrics({
        estimatedCost: 0.001,
        requestTime: 1.5,
        provider: 'Gemini',
        model: 'gemini-2.0-flash-exp',
        totalTokens: 500,
        promptTokens: 300,
        completionTokens: 200
      })
    });

    const legacyChapter = createMockEnhancedChapter({
      id: 'ch-dry',
      chapterNumber: 4,
      title: 'Dry Run Chapter',
      content: '<p>Content</p>',
      translationResult: dryTranslation,
      url: 'https://example.com/dry',
      originalUrl: 'https://example.com/dry',
      canonicalUrl: 'https://example.com/dry',
      prevUrl: null,
      nextUrl: null
    });

    store.getState().importChapter(legacyChapter);

    // Act: Dry run
    const result = await migrateImagesToCache(store.getState().chapters, { dryRun: true });

    // Assert: Reports what would be migrated
    expect(result.success).toBe(true);
    expect(result.wouldMigrate).toBe(1);
    expect(result.migratedImages).toBe(0); // Nothing actually migrated

    // Assert: Image NOT in cache (dry run)
    const cacheKey = createMockImageCacheKey({ chapterId: 'ch-dry', placementMarker: 'ILL-DRY-1' });
    const inCache = await ImageCacheStore.has(cacheKey);
    expect(inCache).toBe(false);

    // Assert: Chapter unchanged
    const chapter = store.getState().chapters.get('ch-dry');
    const imageData = chapter!.translationResult!.suggestedIllustrations[0].generatedImage?.imageData;
    expect(imageData).toContain('base64'); // Still has base64 data
  });
});
