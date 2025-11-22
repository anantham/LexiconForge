/**
 * Simplified Translation Contract Tests - Modern Reality Check
 *
 * Exercises the modern ChapterOps/TranslationOps stack end-to-end to keep the
 * old “repo” contract coverage meaningful without depending on legacy shims.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Chapter, TranslationResult, AppSettings } from '../../../types';
import { ChapterOps, TranslationOps, SessionExportOps } from '../../../services/db/operations';
import { resetModernDb, storeChapterForTest } from './helpers/modernDbHarness';

type ModernRepo = ReturnType<typeof createModernRepo>;

const mockChapter: Chapter = {
  url: 'https://test.example.com/novel/ch1',
  originalUrl: 'https://test.example.com/novel/ch1',
  title: 'Test Chapter 1',
  content: 'This is test chapter content for translation.',
  stableId: 'test-novel-ch-001',
  nextUrl: null,
  prevUrl: null,
};

const mockTranslation: TranslationResult = {
  translatedTitle: 'Translated Title',
  translation: '<p>This is a test translation</p>',
  translatedContent: '<p>This is a test translation</p>',
  footnotes: [],
  suggestedIllustrations: [],
  usageMetrics: {
    totalTokens: 50,
    promptTokens: 30,
    completionTokens: 20,
    estimatedCost: 0.01,
    requestTime: 0.5,
    provider: 'openai',
    model: 'gpt-4',
  },
  proposal: null,
  provider: 'openai',
  model: 'gpt-4',
  cost: 0.05,
  version: 1,
  isActive: true,
  id: 'test-translation-1',
  chapterUrl: mockChapter.url,
  timestamp: Date.now(),
};

const mockSettings: AppSettings = {
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.7,
  systemPrompt: 'You are a professional translator.',
  promptId: 'default-prompt',
  promptName: 'Default Translation Prompt',
  contextDepth: 1,
  preloadCount: 0,
  fontSize: 16,
  fontStyle: 'serif',
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

const createModernRepo = () => ({
  storeChapter: (chapter: Chapter) => storeChapterForTest(chapter),
  getStableIdByUrl: async (url: string) => {
    const record = await ChapterOps.getByUrl(url);
    return record?.stableId ?? null;
  },
  storeTranslation: (chapterUrl: string, translation: TranslationResult, settings: AppSettings) =>
    TranslationOps.store({ ref: { url: chapterUrl }, result: translation, settings }),
  storeTranslationByStableId: (
    stableId: string,
    translation: TranslationResult,
    settings: AppSettings
  ) => TranslationOps.storeByStableId(stableId, translation, settings),
  getTranslationVersions: (chapterUrl: string) => TranslationOps.getVersionsByUrl(chapterUrl),
  getTranslationVersionsByStableId: (stableId: string) =>
    TranslationOps.getVersionsByStableId(stableId),
  getActiveTranslation: (chapterUrl: string) => TranslationOps.getActiveByUrl(chapterUrl),
  getActiveTranslationByStableId: (stableId: string) =>
    TranslationOps.getActiveByStableId(stableId),
  setActiveTranslation: (chapterUrl: string, version: number) =>
    TranslationOps.setActiveByUrl(chapterUrl, version),
  setActiveTranslationByStableId: (stableId: string, version: number) =>
    TranslationOps.setActiveByStableId(stableId, version),
  exportFullSessionToJson: () => SessionExportOps.exportFullSession(),
});

describe('Translation Migration Reality Check (modern ops)', () => {
  let repo: ModernRepo;

  beforeAll(async () => {
    await resetModernDb();
    repo = createModernRepo();
    await repo.storeChapter(mockChapter);
  });

  afterAll(async () => {
    await resetModernDb();
  });

  it('stores translations via TranslationOps', async () => {
    const storedTranslation = await repo.storeTranslation(
      mockChapter.url,
      mockTranslation,
      mockSettings
    );

    expect(storedTranslation).toBeDefined();
    expect(storedTranslation.chapterUrl).toBe(mockChapter.url);
    expect(storedTranslation.provider).toBe(mockSettings.provider);
    expect(storedTranslation.model).toBe(mockSettings.model);
  });

  it('retrieves the active translation', async () => {
    const activeTranslation = await repo.getActiveTranslation(mockChapter.url);

    expect(activeTranslation).toBeDefined();
    expect(activeTranslation?.chapterUrl).toBe(mockChapter.url);
    expect(activeTranslation?.translation).toBe(mockTranslation.translatedContent);
  });

  it('manages translation versions', async () => {
    const secondTranslation: TranslationResult = {
      ...mockTranslation,
      translatedContent: '<p>This is the second translation version</p>',
      translation: '<p>This is the second translation version</p>',
      id: 'test-translation-2',
      timestamp: Date.now() + 1000,
    };

    await repo.storeTranslation(mockChapter.url, secondTranslation, mockSettings);

    const versions = await repo.getTranslationVersions(mockChapter.url);
    expect(versions.length).toBeGreaterThanOrEqual(2);
    expect(new Set(versions.map(v => v.version)).size).toBe(versions.length);
  });

  it('supports stable ID translation storage', async () => {
    const stored = await repo.storeTranslationByStableId(
      mockChapter.stableId!,
      {
        ...mockTranslation,
        translatedContent: '<p>Stored via stable ID</p>',
        translation: '<p>Stored via stable ID</p>',
        id: 'stable-id-version',
      },
      mockSettings
    );

    expect(stored.stableId).toBe(mockChapter.stableId);
    const activeByStableId = await repo.getActiveTranslationByStableId(mockChapter.stableId!);
    expect(activeByStableId?.id).toBe(stored.id);
  });

  it('exports session data through SessionExportOps', async () => {
    const exported = await repo.exportFullSessionToJson();

    expect(exported).toBeDefined();
    expect(Array.isArray(exported.chapters)).toBe(true);
    expect(Array.isArray(exported.translations)).toBe(true);
    expect(exported.translations.length).toBeGreaterThan(0);
  });
});

export { mockChapter, mockTranslation, mockSettings };
