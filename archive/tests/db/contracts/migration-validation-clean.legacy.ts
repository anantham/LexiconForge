/**
 * Migration-Aware Contract Tests - Modern System Validation
 *
 * Revalidates the original contracts purely against ChapterOps/TranslationOps so
 * we can retire the legacy repo shim while preserving intent coverage.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { AppSettings, Chapter, TranslationResult } from '../../../types';
import { StableIdManager } from '../../../services/db/core/stable-ids';
import { TranslationOps } from '../../../services/db/operations';
import { resetModernDb, storeChapterForTest } from './helpers/modernDbHarness';

const generateTestData = (testId: string) => {
  const timestamp = Date.now();
  const uniqueId = `${testId}-${timestamp}`;

  const chapter: Chapter = {
    url: `https://migration-test-${uniqueId}.com/ch1`,
    originalUrl: `https://migration-test-${uniqueId}.com/ch1`,
    title: `Migration Test Chapter ${uniqueId}`,
    content: `Test content for migration validation ${uniqueId}`,
    stableId: `migration-test-${uniqueId}-ch-001`,
    nextUrl: null,
    prevUrl: null,
  };

  const translation: TranslationResult = {
    translatedTitle: `Migrated Title ${uniqueId}`,
    translation: `Migration-tested translation content ${uniqueId}`,
    footnotes: [{ marker: '[1]', text: `Test footnote ${uniqueId}` }],
    suggestedIllustrations: [
      {
        placementMarker: '<img>',
        imagePrompt: `Test illustration ${uniqueId}`,
      },
    ],
    usageMetrics: {
      totalTokens: 150,
      promptTokens: 100,
      completionTokens: 50,
      estimatedCost: 0.08,
      requestTime: 1.2,
      provider: 'openai',
      model: 'gpt-4',
    },
    proposal: null,
    version: 1,
    isActive: true,
    id: `test-${uniqueId}`,
    chapterUrl: chapter.url,
    timestamp,
  };

  const settings: AppSettings = {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
    systemPrompt: `Migration test prompt ${uniqueId}`,
    promptId: `test-prompt-${uniqueId}`,
    promptName: `Test Prompt ${uniqueId}`,
    contextDepth: 1,
    preloadCount: 0,
    fontSize: 16,
    fontStyle: 'sans',
    lineHeight: 1.5,
    negativePrompt: '',
    defaultNegativePrompt: '',
    translateOnScroll: false,
    autoTranslate: false,
    useFanTranslations: false,
    showRomaji: false,
    showPronunciations: false,
    streamingMode: 'paragraph',
    imageModel: 'flux',
    autoGenerateImages: false,
    theme: 'light',
  };

  return { chapter, translation, settings, uniqueId };
};

describe('Migration-Aware Contract Tests (modern ops)', () => {
  beforeEach(async () => {
    await resetModernDb();
  });

  describe('Contract 1: Basic Translation Storage', () => {
    it('stores and retrieves translations through TranslationOps', async () => {
      const { chapter, translation, settings } = generateTestData('contract1');
      await storeChapterForTest(chapter);

      const stored = await TranslationOps.store({
        ref: { url: chapter.url },
        result: translation,
        settings,
      });

      expect(stored.version).toBe(1);
      const active = await TranslationOps.getActiveByUrl(chapter.url);
      expect(active?.translation).toBe(translation.translation);
    });
  });

  describe('Contract 2: Stable ID Operations', () => {
    it('stores via stable ID with automatic URL-mapping repairs', async () => {
      const { chapter, translation, settings } = generateTestData('contract2');
      await storeChapterForTest(chapter);

      const record = await TranslationOps.storeByStableId(
        chapter.stableId!,
        { ...translation, translation: 'Stable ID test' },
        settings
      );

      expect(record.isActive).toBe(true);
      expect(record.translation).toBe('Stable ID test');
    });

    it('auto-repairs hyphen/underscore mismatches', async () => {
      const { chapter, translation, settings } = generateTestData('contract2b');
      const underscoreStableId = `test_${Date.now()}_ch_001`;
      const hyphenStableId = underscoreStableId.replace(/_/g, '-');
      const testChapter = { ...chapter, stableId: underscoreStableId };
      await storeChapterForTest(testChapter);

      const resolvedUrl = await StableIdManager.getUrlForStableId(hyphenStableId);
      expect(resolvedUrl).toBe(testChapter.url);

      const stored = await TranslationOps.store({
        ref: { stableId: hyphenStableId },
        result: translation,
        settings,
      });
      expect(stored.translation).toBe(translation.translation);
    });
  });

  describe('Contract 3: Error Handling', () => {
    it('provides descriptive errors for unknown stable IDs', async () => {
      const { translation, settings } = generateTestData('contract3');
      let error: Error | undefined;

      try {
        await TranslationOps.storeByStableId('nonexistent-stable-id', translation, settings);
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeDefined();
      expect(error!.message).toContain('nonexistent-stable-id');
      expect(error!.message).toContain('StableId not found');
    });
  });

  describe('Contract 4: Data Compatibility', () => {
    it('maintains the expected translation record shape', async () => {
      const { chapter, translation, settings } = generateTestData('contract4');
      await storeChapterForTest(chapter);

      const stored = await TranslationOps.store({
        ref: { url: chapter.url },
        result: translation,
        settings,
      });

      [
        'id',
        'version',
        'isActive',
        'translation',
        'translatedTitle',
        'footnotes',
        'suggestedIllustrations',
        'provider',
        'model',
      ].forEach(field => expect(stored).toHaveProperty(field));
      expect(stored.translation).toBe(translation.translation);
      expect(Array.isArray(stored.footnotes)).toBe(true);
    });
  });
});
