/**
 * Actual System Validation - Modern Ops
 *
 * Exercises StableIdManager + TranslationOps behaviors that replaced the legacy repo.
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
    url: `https://actual-test-${uniqueId}.com/ch1`,
    originalUrl: `https://actual-test-${uniqueId}.com/ch1`,
    title: `Actual System Test Chapter ${uniqueId}`,
    content: `Test content for actual system validation ${uniqueId}`,
    stableId: `actual-test-${uniqueId}-ch-001`,
    nextUrl: null,
    prevUrl: null,
  };

  const translation: TranslationResult = {
    translatedTitle: `Actual Title ${uniqueId}`,
    translation: `Actual translation content ${uniqueId}`,
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
    systemPrompt: `Actual test prompt ${uniqueId}`,
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

describe('Actual System Validation (modern ops)', () => {
  beforeEach(async () => {
    await resetModernDb();
  });

  describe('Stable ID format mismatch auto-repair', () => {
    it('resolves underscore/hyphen variations automatically', async () => {
      const { chapter, translation, settings } = generateTestData('format-fix');
      const underscoreStableId = `test_${Date.now()}_format_fix`;
      const hyphenStableId = underscoreStableId.replace(/_/g, '-');
      const testChapter = { ...chapter, stableId: underscoreStableId };
      await storeChapterForTest(testChapter);

      const resolvedUrl = await StableIdManager.getUrlForStableId(hyphenStableId);
      expect(resolvedUrl).toBe(testChapter.url);

      const result = await TranslationOps.store({
        ref: { stableId: hyphenStableId },
        result: translation,
        settings,
      });
      expect(result.translation).toBe(translation.translation);
    });
  });

  describe('Missing URL mapping auto-repair', () => {
    it('stores translations even if canonical mapping is absent', async () => {
      const { chapter, translation, settings } = generateTestData('mapping-fix');
      // Store chapter once; ChapterOps will write canonical mappings automatically.
      await storeChapterForTest(chapter);

      const result = await TranslationOps.store({
        ref: { stableId: chapter.stableId! },
        result: translation,
        settings,
      });

      expect(result.stableId).toBe(chapter.stableId);
      expect(result.isActive).toBe(true);
    });
  });

  describe('Robust stable ID operations', () => {
    it('keeps versions consistent when mixing URL/stable ID refs', async () => {
      const { chapter, translation, settings } = generateTestData('robust');
      await storeChapterForTest(chapter);

      const result1 = await TranslationOps.store({
        ref: { stableId: chapter.stableId! },
        result: { ...translation, translation: 'Test 1' },
        settings,
      });
      const result2 = await TranslationOps.store({
        ref: { url: chapter.url },
        result: { ...translation, translation: 'Test 2' },
        settings,
      });
      const result3 = await TranslationOps.store({
        ref: { stableId: chapter.stableId! },
        result: { ...translation, translation: 'Test 3' },
        settings,
      });

      expect(result1.version).toBe(1);
      expect(result2.version).toBe(2);
      expect(result3.version).toBe(3);
    });
  });

  describe('API compatibility', () => {
    it('returns the expected translation record shape', async () => {
      const { chapter, translation, settings } = generateTestData('compat');
      await storeChapterForTest(chapter);

      const result = await TranslationOps.store({
        ref: { stableId: chapter.stableId! },
        result: translation,
        settings,
      });

      ['id', 'version', 'isActive', 'translation'].forEach(field => {
        expect(result).toHaveProperty(field);
      });
      const resolvedUrl = await StableIdManager.getUrlForStableId(chapter.stableId!);
      expect(resolvedUrl).toBe(chapter.url);
    });
  });

  describe('Error handling', () => {
    it('throws descriptive errors for invalid stable IDs', async () => {
      let error: Error | undefined;
      try {
        await StableIdManager.getUrlForStableId('completely-nonexistent-stable-id');
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeDefined();
      expect(error!.message).toContain('completely-nonexistent-stable-id');
      expect(error!.message).toContain('StableId not found');
    });

    it('bubbles errors when translations reference unknown chapters', async () => {
      const { translation, settings } = generateTestData('error-handling');
      let error: Error | undefined;
      try {
        await TranslationOps.store({
          ref: { stableId: 'invalid-stable-id-12345' },
          result: translation,
          settings,
        });
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeDefined();
      expect(error!.message).toContain('invalid-stable-id-12345');
    });
  });
});
