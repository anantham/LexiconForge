import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import type { Chapter, AppSettings, TranslationResult } from '../../../types';
import type { TranslationRecord } from '../../../services/indexeddb';
import { ChapterRepository } from '../../../services/db/repositories/ChapterRepository';
import { TranslationRepository } from '../../../services/db/repositories/TranslationRepository';

const DB_NAME = 'translation-contracts-modern';
const STORES = {
  CHAPTERS: 'chapters',
  TRANSLATIONS: 'translations',
  URL_MAPPINGS: 'url_mappings',
};

interface ContractRepo {
  storeChapter(chapter: Chapter): Promise<void>;
  getStableIdByUrl(url: string): Promise<string | null>;
  storeTranslation(
    url: string,
    translation: TranslationResult,
    settings: AppSettings
  ): Promise<TranslationRecord>;
  storeTranslationByStableId(
    stableId: string,
    translation: TranslationResult,
    settings: AppSettings
  ): Promise<TranslationRecord>;
  getActiveTranslation(url: string): Promise<TranslationRecord | null>;
  getActiveTranslationByStableId(stableId: string): Promise<TranslationRecord | null>;
  getTranslationVersions(url: string): Promise<TranslationRecord[]>;
  getTranslationVersionsByStableId(stableId: string): Promise<TranslationRecord[]>;
  setActiveTranslation(url: string, version: number): Promise<void>;
  setActiveTranslationByStableId(stableId: string, version: number): Promise<void>;
  cleanup(): Promise<void>;
  ensureUrlMapping(stableId: string, url: string): Promise<void>;
}

const openDb = async (): Promise<IDBDatabase> => {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.CHAPTERS)) {
        const chapters = db.createObjectStore(STORES.CHAPTERS, { keyPath: 'url' });
        chapters.createIndex('stableId', 'stableId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.TRANSLATIONS)) {
        const translations = db.createObjectStore(STORES.TRANSLATIONS, { keyPath: 'id' });
        translations.createIndex('chapterUrl', 'chapterUrl', { unique: false });
        translations.createIndex('stableId', 'stableId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.URL_MAPPINGS)) {
        const mappings = db.createObjectStore(STORES.URL_MAPPINGS, { keyPath: 'url' });
        mappings.createIndex('stableId', 'stableId', { unique: false });
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
    const request = store.put({
      url,
      stableId,
      isCanonical: true,
      dateAdded: new Date().toISOString(),
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const createRepo = async (): Promise<ContractRepo> => {
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

  return {
    async storeChapter(chapter) {
      await chapterRepo.storeChapter(chapter);
    },
    async getStableIdByUrl(url) {
      const record = await chapterRepo.getChapter(url);
      return record?.stableId ?? null;
    },
    storeTranslation(url, translation, settings) {
      return translationRepo.storeTranslation(url, translation, settings);
    },
    storeTranslationByStableId(stableId, translation, settings) {
      return translationRepo.storeByStableId(stableId, translation, settings);
    },
    getActiveTranslation(url) {
      return translationRepo.getActiveTranslation(url);
    },
    getActiveTranslationByStableId(stableId) {
      return translationRepo.getActiveTranslationByStableId(stableId);
    },
    getTranslationVersions(url) {
      return translationRepo.getTranslationVersions(url);
    },
    getTranslationVersionsByStableId(stableId) {
      return translationRepo.getTranslationVersionsByStableId(stableId);
    },
    setActiveTranslation(url, version) {
      return translationRepo.setActiveTranslation(url, version);
    },
    setActiveTranslationByStableId(stableId, version) {
      return translationRepo.setActiveTranslationByStableId(stableId, version);
    },
    async ensureUrlMapping(stableId, url) {
      await writeUrlMapping(db, stableId, url);
    },
    async cleanup() {
      db.close();
      await deleteDb();
    },
  };
};

// Test fixtures
const mockChapterUrl = 'https://example.com/chapter/1';
const mockStableId = 'novel-123-ch-001';

const mockChapter: Chapter = {
  url: mockChapterUrl,
  title: 'Test Chapter',
  content: 'Original chapter content',
  stableId: mockStableId,
  nextUrl: null,
  prevUrl: null,
};

const mockSettings: AppSettings = {
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.7,
  systemPrompt: 'You are a translator',
  promptId: 'test-prompt-id',
  promptName: 'Test Prompt',
  contextDepth: 2,
  preloadCount: 2,
  fontSize: 16,
  fontStyle: 'sans',
  lineHeight: 1.5,
  negativePrompt: '',
  defaultNegativePrompt: '',
  translateOnScroll: true,
  autoTranslate: false,
  useFanTranslations: false,
  showRomaji: false,
  showPronunciations: false,
  streamingMode: 'paragraph',
  imageModel: 'flux',
  autoGenerateImages: false,
  theme: 'light',
};

const mockTranslation: TranslationResult = {
  translatedTitle: 'Translated Title',
  translation: '<p>This is a test translation</p>',
  footnotes: [],
  suggestedIllustrations: [],
  usageMetrics: {
    totalTokens: 10,
    promptTokens: 6,
    completionTokens: 4,
    estimatedCost: 0.01,
    requestTime: 0.5,
    provider: 'openai',
    model: 'gpt-4',
  },
};

describe('Translation Contracts (modern repo)', () => {
  let repo: ContractRepo;

  beforeEach(async () => {
    repo = await createRepo();
    await repo.storeChapter(mockChapter);
    const stableId = (await repo.getStableIdByUrl(mockChapterUrl)) || mockStableId;
    await repo.ensureUrlMapping(stableId, mockChapterUrl);
  });

  afterEach(async () => {
    await repo.cleanup();
  });

  describe('Basic Translation CRUD', () => {
    it('should store and retrieve translation by URL', async () => {
      await repo.storeTranslation(mockChapterUrl, mockTranslation, mockSettings);
      const retrieved = await repo.getActiveTranslation(mockChapterUrl);
      expect(retrieved).toBeDefined();
      expect(retrieved?.translation).toBe(mockTranslation.translation);
    });

    it('should store and retrieve translation by stable ID', async () => {
      await repo.storeTranslationByStableId(mockStableId, mockTranslation, mockSettings);
      const retrieved = await repo.getActiveTranslationByStableId(mockStableId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.translation).toBe(mockTranslation.translation);
    });

    it('should return null for non-existent translations', async () => {
      expect(await repo.getActiveTranslation('missing')).toBeNull();
      expect(await repo.getActiveTranslationByStableId('missing')).toBeNull();
    });
  });

  describe('Translation Versioning', () => {
    it('should handle multiple translation versions', async () => {
      await repo.storeTranslation(mockChapterUrl, mockTranslation, mockSettings);
      await repo.storeTranslation(
        mockChapterUrl,
        { ...mockTranslation, translation: 'Updated translation' },
        mockSettings
      );
      const versions = await repo.getTranslationVersions(mockChapterUrl);
      expect(versions.length).toBeGreaterThanOrEqual(2);
      const active = await repo.getActiveTranslation(mockChapterUrl);
      expect(active?.translation).toBe('Updated translation');
    });

    it('should correctly set active translation version', async () => {
      await repo.storeTranslation(mockChapterUrl, mockTranslation, mockSettings);
      await repo.storeTranslation(
        mockChapterUrl,
        { ...mockTranslation, translation: 'Version 2' },
        mockSettings
      );
      await repo.setActiveTranslation(mockChapterUrl, 1);
      const active = await repo.getActiveTranslation(mockChapterUrl);
      expect(active?.translation).toBe(mockTranslation.translation);
    });

    it('should handle stable ID versioning', async () => {
      await repo.storeTranslationByStableId(mockStableId, mockTranslation, mockSettings);
      await repo.storeTranslationByStableId(
        mockStableId,
        { ...mockTranslation, translation: 'Version 2 by ID' },
        mockSettings
      );
      const versions = await repo.getTranslationVersionsByStableId(mockStableId);
      expect(versions.length).toBeGreaterThanOrEqual(2);
      await repo.setActiveTranslationByStableId(mockStableId, 1);
      const active = await repo.getActiveTranslationByStableId(mockStableId);
      expect(active?.translation).toBe(mockTranslation.translation);
    });
  });

  describe('Translation Metadata Preservation', () => {
    it('should preserve usage metrics', async () => {
      await repo.storeTranslation(mockChapterUrl, mockTranslation, mockSettings);
      const retrieved = await repo.getActiveTranslation(mockChapterUrl);
      expect(retrieved?.usageMetrics?.estimatedCost).toBe(
        mockTranslation.usageMetrics?.estimatedCost
      );
      expect(retrieved?.usageMetrics?.totalTokens).toBe(mockTranslation.usageMetrics?.totalTokens);
    });

    it('should snapshot provider/model info', async () => {
      await repo.storeTranslation(mockChapterUrl, mockTranslation, mockSettings);
      const retrieved = await repo.getActiveTranslation(mockChapterUrl);
      expect(retrieved?.provider).toBe(mockSettings.provider);
      expect(retrieved?.model).toBe(mockSettings.model);
      expect(retrieved?.temperature).toBe(mockSettings.temperature);
    });
  });
});
