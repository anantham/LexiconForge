import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import type { Chapter } from '../../../types';
import { ChapterRepository } from '../../../services/db/repositories/ChapterRepository';

const DB_NAME = 'chapter-repo-test';
const CHAPTER_STORE = 'chapters';

const openTestDb = async (): Promise<IDBDatabase> => {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CHAPTER_STORE)) {
        const store = db.createObjectStore(CHAPTER_STORE, { keyPath: 'url' });
        store.createIndex('stableId', 'stableId', { unique: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const deleteTestDb = async () => {
  await new Promise<void>((resolve) => {
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
    deleteRequest.onsuccess = () => resolve();
    deleteRequest.onerror = () => resolve();
    deleteRequest.onblocked = () => resolve();
  });
};

const baseChapter: Chapter = {
  url: 'https://example.com/ch1',
  originalUrl: 'https://example.com/ch1',
  title: 'Chapter 1',
  content: '<p>Hello</p>',
  chapterNumber: 1,
};

const makeRepo = (db: IDBDatabase) =>
  new ChapterRepository({
    getDb: () => Promise.resolve(db),
    normalizeUrl: (url) => url?.toLowerCase() ?? null,
    stores: { CHAPTERS: CHAPTER_STORE },
  });

let db: IDBDatabase;
let repo: ChapterRepository;

beforeEach(async () => {
  await deleteTestDb();
  db = await openTestDb();
  repo = makeRepo(db);
});

afterEach(async () => {
  db.close();
  await deleteTestDb();
});

describe('ChapterRepository', () => {
  it('stores and retrieves chapters', async () => {
    await repo.storeChapter(baseChapter);
    const stored = await repo.getChapter(baseChapter.originalUrl);
    expect(stored).toBeTruthy();
    expect(stored?.title).toBe(baseChapter.title);
    expect(stored?.canonicalUrl).toBe(baseChapter.originalUrl.toLowerCase());
  });

  it('preserves existing metadata when overwriting', async () => {
    await repo.storeChapter(baseChapter);
    const first = await repo.getChapter(baseChapter.originalUrl);
    expect(first?.dateAdded).toBeDefined();

    const updated = { ...baseChapter, title: 'New Title', chapterNumber: undefined };
    await repo.storeChapter(updated);

    const stored = await repo.getChapter(baseChapter.originalUrl);
    expect(stored?.title).toBe('New Title');
    expect(stored?.chapterNumber).toBe(1); // preserved
    expect(stored?.dateAdded).toBe(first?.dateAdded);
  });

  it('finds chapters by stableId and updates chapter number', async () => {
    const record = await repo.storeChapter(baseChapter);
    expect(record.stableId).toBeTruthy();

    const byStable = await repo.getChapterByStableId(record.stableId!);
    expect(byStable?.url).toBe(baseChapter.originalUrl);

    await repo.setChapterNumberByStableId(record.stableId!, 5);
    const updated = await repo.getChapter(baseChapter.originalUrl);
    expect(updated?.chapterNumber).toBe(5);
  });

  it('lists all chapters', async () => {
    await repo.storeChapter(baseChapter);
    await repo.storeChapter({
      ...baseChapter,
      url: 'https://example.com/ch2',
      originalUrl: 'https://example.com/ch2',
      title: 'Chapter 2',
      chapterNumber: 2,
    });

    const all = await repo.getAllChapters();
    expect(all).toHaveLength(2);
  });
});
