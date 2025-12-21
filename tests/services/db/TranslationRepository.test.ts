import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import type { Chapter, AppSettings, TranslationResult } from '../../../types';
import { ChapterRepository } from '../../../services/db/repositories/ChapterRepository';
import { TranslationRepository } from '../../../services/db/repositories/TranslationRepository';
import { createMockAppSettings, createMockChapter, createMockTranslationResult } from '../../utils/test-data';

const DB_NAME = 'translation-repo-test';
const CHAPTER_STORE = 'chapters';
const TRANSLATION_STORE = 'translations';
const URL_MAPPING_STORE = 'url_mappings';

const baseSettings: AppSettings = createMockAppSettings({
  provider: 'OpenAI',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  systemPrompt: 'You are a helpful translator.',
  contextDepth: 3,
  preloadCount: 3,
  fontSize: 16,
  fontStyle: 'sans',
  lineHeight: 1.5,
  promptId: 'prompt-1',
  promptName: 'Default',
});

const baseChapter: Chapter = createMockChapter({
  originalUrl: 'https://example.com/ch1',  // Use originalUrl, not url, to match storage key
  chapterNumber: 1,
});

const baseTranslation: TranslationResult = createMockTranslationResult({
  translatedTitle: 'Translated 1',
  translation: '<p>Hola</p>',
  provider: 'OpenAI',
  model: 'gpt-4o-mini',
});

let db: IDBDatabase;
let chapterRepo: ChapterRepository;
let translationRepo: TranslationRepository;

const openTestDb = async (): Promise<IDBDatabase> => {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const upgradeDb = request.result;
      if (!upgradeDb.objectStoreNames.contains(CHAPTER_STORE)) {
        const store = upgradeDb.createObjectStore(CHAPTER_STORE, { keyPath: 'url' });
        store.createIndex('stableId', 'stableId', { unique: false });
      }
      if (!upgradeDb.objectStoreNames.contains(TRANSLATION_STORE)) {
        const store = upgradeDb.createObjectStore(TRANSLATION_STORE, { keyPath: 'id' });
        store.createIndex('chapterUrl', 'chapterUrl', { unique: false });
        store.createIndex('stableId', 'stableId', { unique: false });
      }
      if (!upgradeDb.objectStoreNames.contains(URL_MAPPING_STORE)) {
        const store = upgradeDb.createObjectStore(URL_MAPPING_STORE, { keyPath: 'url' });
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

const writeUrlMapping = async (stableId: string, url: string) => {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([URL_MAPPING_STORE], 'readwrite');
    const store = tx.objectStore(URL_MAPPING_STORE);
    const request = store.put({ url, stableId, isCanonical: true, dateAdded: new Date().toISOString() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const ensureStableMapping = async (): Promise<string> => {
  // Use originalUrl to match the storage key (ChapterRepository stores by originalUrl)
  const chapterRecord = await chapterRepo.getChapter(baseChapter.originalUrl!);
  if (!chapterRecord?.stableId) {
    throw new Error('Expected stored chapter to include stableId');
  }
  await writeUrlMapping(chapterRecord.stableId, baseChapter.originalUrl!);
  return chapterRecord.stableId;
};

beforeEach(async () => {
  await deleteDb();
  db = await openTestDb();
  chapterRepo = new ChapterRepository({
    getDb: () => Promise.resolve(db),
    normalizeUrl: url => url,
    stores: { CHAPTERS: CHAPTER_STORE },
  });
  translationRepo = new TranslationRepository({
    getDb: () => Promise.resolve(db),
    getChapter: (url) => chapterRepo.getChapter(url),
    stores: {
      TRANSLATIONS: TRANSLATION_STORE,
      CHAPTERS: CHAPTER_STORE,
      URL_MAPPINGS: URL_MAPPING_STORE,
    },
  });
  await chapterRepo.storeChapter(baseChapter);
});

afterEach(async () => {
  db.close();
  await deleteDb();
});

describe('TranslationRepository', () => {
  it('stores translations with incrementing versions and single active record', async () => {
    const first = await translationRepo.storeTranslation(baseChapter.originalUrl!, baseTranslation, baseSettings);
    expect(first.version).toBe(1);
    const second = await translationRepo.storeTranslation(baseChapter.originalUrl!, {
      ...baseTranslation,
      translatedTitle: 'Translated 2',
      translation: '<p>Hola Mundo</p>',
    }, baseSettings);
    expect(second.version).toBe(2);

    const active = await translationRepo.getActiveTranslation(baseChapter.originalUrl!);
    expect(active?.version).toBe(2);

    const versions = await translationRepo.getTranslationVersions(baseChapter.originalUrl!);
    expect(versions).toHaveLength(2);
    expect(versions.filter(v => v.isActive)).toHaveLength(1);
  });

  it('allows overriding active translation', async () => {
    await translationRepo.storeTranslation(baseChapter.originalUrl!, baseTranslation, baseSettings);
    const second = await translationRepo.storeTranslation(baseChapter.originalUrl!, {
      ...baseTranslation,
      translatedTitle: 'Alt',
    }, baseSettings);

    await translationRepo.setActiveTranslation(baseChapter.originalUrl!, 1);
    const active = await translationRepo.getActiveTranslation(baseChapter.originalUrl!);
    expect(active?.version).toBe(1);

    const versions = await translationRepo.getTranslationVersions(baseChapter.originalUrl!);
    const activeCount = versions.filter(v => v.isActive).length;
    expect(activeCount).toBe(1);
    expect(second.isActive).toBe(true); // stored record remains true, but DB state toggled
  });

  it('resolves stableId lookups for storeTranslationByStableId', async () => {
    const stableId = await ensureStableMapping();
    const record = await translationRepo.storeTranslationByStableId(stableId, baseTranslation, baseSettings);
    expect(record.stableId).toBe(stableId);
    const versions = await translationRepo.getTranslationVersionsByStableId(stableId);
    expect(versions).toHaveLength(1);
    expect(versions[0].stableId).toBe(stableId);
  });

  it('deletes translation versions and reactivates latest', async () => {
    await translationRepo.storeTranslation(baseChapter.originalUrl!, baseTranslation, baseSettings);
    const second = await translationRepo.storeTranslation(baseChapter.originalUrl!, {
      ...baseTranslation,
      translatedTitle: 'Another',
    }, baseSettings);

    await translationRepo.deleteTranslationVersion(second.id);
    const versions = await translationRepo.getTranslationVersions(baseChapter.originalUrl!);
    expect(versions).toHaveLength(1);
    expect(versions[0].isActive).toBeTruthy();
  });

  it('retrieves translations by id and lists all translations', async () => {
    const first = await translationRepo.storeTranslation(baseChapter.originalUrl!, baseTranslation, baseSettings);
    const second = await translationRepo.storeTranslation(baseChapter.originalUrl!, {
      ...baseTranslation,
      translatedTitle: 'Third',
    }, baseSettings);

    const byId = await translationRepo.getTranslationById(second.id);
    expect(byId?.id).toBe(second.id);
    expect(byId?.translatedTitle).toBe('Third');

    const all = await translationRepo.getAllTranslations();
    const ids = all.map(t => t.id);
    expect(ids).toEqual(expect.arrayContaining([first.id, second.id]));
  });

  it('sets active translation via stableId', async () => {
    await translationRepo.storeTranslation(baseChapter.originalUrl!, baseTranslation, baseSettings);
    await translationRepo.storeTranslation(baseChapter.originalUrl!, { ...baseTranslation, translatedTitle: 'Alt' }, baseSettings);
    const stableId = await ensureStableMapping();

    await translationRepo.setActiveTranslationByStableId(stableId, 1);
    const active = await translationRepo.getActiveTranslationByStableId(stableId);
    expect(active?.version).toBe(1);
    expect(active?.stableId).toBe(stableId);
  });

  it('ensures an active translation exists per stableId', async () => {
    await translationRepo.storeTranslation(baseChapter.originalUrl!, baseTranslation, baseSettings);
    await translationRepo.storeTranslation(baseChapter.originalUrl!, { ...baseTranslation, translatedTitle: 'Alt' }, baseSettings);
    const stableId = await ensureStableMapping();

    const versions = await translationRepo.getTranslationVersionsByStableId(stableId);
    for (const record of versions) {
      record.isActive = false;
      await translationRepo.updateTranslation(record);
    }

    const ensured = await translationRepo.ensureActiveTranslationByStableId(stableId);
    expect(ensured?.isActive).toBe(true);
    expect(ensured?.version).toBe(versions[0].version);

    const refreshed = await translationRepo.getActiveTranslationByStableId(stableId);
    expect(refreshed?.version).toBe(versions[0].version);
  });
});
