import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Chapter, AppSettings, TranslationResult } from '../../../types';
import type { TranslationRecord } from '../../../services/indexeddb';
import { ChapterRepository } from '../../../services/db/repositories/ChapterRepository';
import { TranslationRepository } from '../../../services/db/repositories/TranslationRepository';

const DB_NAME = 'translation-accurate-modern';
const STORES = {
  CHAPTERS: 'chapters',
  TRANSLATIONS: 'translations',
  URL_MAPPINGS: 'url_mappings',
};

interface RepoContext {
  chapterRepo: ChapterRepository;
  translationRepo: TranslationRepository;
  db: IDBDatabase;
}

const openDb = async (): Promise<IDBDatabase> => {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.CHAPTERS)) {
        const store = db.createObjectStore(STORES.CHAPTERS, { keyPath: 'url' });
        store.createIndex('stableId', 'stableId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.TRANSLATIONS)) {
        const store = db.createObjectStore(STORES.TRANSLATIONS, { keyPath: 'id' });
        store.createIndex('chapterUrl', 'chapterUrl', { unique: false });
        store.createIndex('stableId', 'stableId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.URL_MAPPINGS)) {
        const store = db.createObjectStore(STORES.URL_MAPPINGS, { keyPath: 'url' });
        store.createIndex('stableId', 'stableId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const deleteDb = async () => {
  await new Promise<void>(resolve => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
};

const writeUrlMapping = async (db: IDBDatabase, stableId: string, url: string) => {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORES.URL_MAPPINGS], 'readwrite');
    const store = tx.objectStore(STORES.URL_MAPPINGS);
    const request = store.put({ url, stableId, isCanonical: true, dateAdded: new Date().toISOString() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const createContext = async (): Promise<RepoContext> => {
  await deleteDb();
  const db = await openDb();
  const chapterRepo = new ChapterRepository({
    getDb: () => Promise.resolve(db),
    normalizeUrl: url => url,
    stores: { CHAPTERS: STORES.CHAPTERS },
  });
  const translationRepo = new TranslationRepository({
    getDb: () => Promise.resolve(db),
    getChapter: url => chapterRepo.getChapter(url),
    stores: {
      TRANSLATIONS: STORES.TRANSLATIONS,
      CHAPTERS: STORES.CHAPTERS,
      URL_MAPPINGS: STORES.URL_MAPPINGS,
    },
  });
  return { chapterRepo, translationRepo, db };
};

const cleanupContext = async (ctx: RepoContext) => {
  ctx.db.close();
  await deleteDb();
};

const accurateChapter: Chapter = {
  url: 'https://accurate-test.com/novel/ch1',
  originalUrl: 'https://accurate-test.com/novel/ch1',
  title: 'Accurate Test Chapter',
  content: 'Test chapter content for accurate testing.',
  stableId: 'accurate-test-ch-001',
  nextUrl: null,
  prevUrl: null,
};

const accurateTranslation: TranslationResult = {
  translatedTitle: 'Accurate Translated Title',
  translation: '<p>This is accurate translated content.</p>',
  footnotes: [{ marker: '[1]', text: 'Test footnote' }],
  suggestedIllustrations: [{ placementMarker: '<img1>', imagePrompt: 'Test illustration' }],
  usageMetrics: {
    totalTokens: 100,
    promptTokens: 80,
    completionTokens: 20,
    estimatedCost: 0.05,
    requestTime: 1.5,
    provider: 'openai',
    model: 'gpt-4',
  },
};

const accurateSettings: AppSettings = {
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.7,
  systemPrompt: 'You are an accurate translation system test.',
  promptId: 'accurate-test-prompt-id',
  promptName: 'Accurate Test Prompt',
  contextDepth: 2,
  preloadCount: 2,
  fontSize: 16,
  fontStyle: 'sans',
  lineHeight: 1.5,
  negativePrompt: '',
  defaultNegativePrompt: '',
  defaultGuidanceScale: 1,
  exportOrder: 'number',
  includeTitlePage: true,
  includeStatsPage: true,
  imageModel: 'flux',
  includeFanTranslationInPrompt: false,
  translateOnScroll: true,
  autoTranslate: false,
  showDiffHeatmap: true,
};

describe('Accurate Translation Contracts (modern repo)', () => {
  let ctx: RepoContext;

  beforeEach(async () => {
    ctx = await createContext();
    await ctx.chapterRepo.storeChapter(accurateChapter);
    const stored = await ctx.chapterRepo.getChapter(accurateChapter.url);
    if (stored?.stableId) {
      await writeUrlMapping(ctx.db, stored.stableId, accurateChapter.url);
    }
  });

  afterEach(async () => {
    await cleanupContext(ctx);
  });

  const storeViaUrl = () =>
    ctx.translationRepo.storeTranslation(accurateChapter.url, accurateTranslation, accurateSettings);

  const storeViaStableId = () =>
    ctx.translationRepo.storeByStableId(accurateChapter.stableId!, accurateTranslation, accurateSettings);

  describe('Field mappings', () => {
    it('stores translation fields in the correct record slots', async () => {
      const stored = await storeViaUrl();
      expect(stored.translation).toBe(accurateTranslation.translation);
      expect(stored.translatedTitle).toBe(accurateTranslation.translatedTitle);
      expect(stored.suggestedIllustrations?.length).toBe(1);
      expect(stored.provider).toBe(accurateSettings.provider);
      expect(stored.model).toBe(accurateSettings.model);
    });

    it('retrieves active translation with matching structure', async () => {
      await storeViaUrl();
      const active = await ctx.translationRepo.getActiveTranslation(accurateChapter.url);
      expect(active?.translation).toBe(accurateTranslation.translation);
      expect(active?.translatedTitle).toBe(accurateTranslation.translatedTitle);
      expect(active?.usageMetrics?.estimatedCost).toBe(accurateTranslation.usageMetrics?.estimatedCost);
    });
  });

  describe('Stable ID operations', () => {
    it('stores translations by stable ID when mapping exists', async () => {
      const stored = await storeViaStableId();
      expect(stored.stableId).toBe(accurateChapter.stableId);
      const retrieved = await ctx.translationRepo.getActiveTranslationByStableId(accurateChapter.stableId!);
      expect(retrieved?.translation).toBe(accurateTranslation.translation);
    });
  });

  describe('Version management', () => {
    it('increments versions sequentially', async () => {
      const v1 = await storeViaUrl();
      const v2 = await ctx.translationRepo.storeTranslation(
        accurateChapter.url,
        { ...accurateTranslation, translation: 'Version 2' },
        accurateSettings
      );
      expect(v2.version).toBeGreaterThan(v1.version);
      const versions = await ctx.translationRepo.getTranslationVersions(accurateChapter.url);
      expect(versions.length).toBeGreaterThanOrEqual(2);
      const active = await ctx.translationRepo.getActiveTranslation(accurateChapter.url);
      expect(active?.translation).toBe('Version 2');
    });

    it('sets active translation by stable ID', async () => {
      await storeViaStableId();
      await ctx.translationRepo.storeByStableId(
        accurateChapter.stableId!,
        { ...accurateTranslation, translation: 'Stable version 2' },
        accurateSettings
      );
      await ctx.translationRepo.setActiveTranslationByStableId(accurateChapter.stableId!, 1);
      const active = await ctx.translationRepo.getActiveTranslationByStableId(accurateChapter.stableId!);
      expect(active?.translation).toBe(accurateTranslation.translation);
    });
  });

  describe('Metadata preservation', () => {
    it('keeps usage metrics intact', async () => {
      await storeViaUrl();
      const active = await ctx.translationRepo.getActiveTranslation(accurateChapter.url);
      expect(active?.usageMetrics?.totalTokens).toBe(accurateTranslation.usageMetrics?.totalTokens);
      expect(active?.usageMetrics?.estimatedCost).toBe(accurateTranslation.usageMetrics?.estimatedCost);
    });

    it('records settings snapshot fields', async () => {
      await storeViaUrl();
      const active = await ctx.translationRepo.getActiveTranslation(accurateChapter.url);
      expect(active?.temperature).toBe(accurateSettings.temperature);
      expect(active?.systemPrompt).toBe(accurateSettings.systemPrompt);
    });
  });
});
