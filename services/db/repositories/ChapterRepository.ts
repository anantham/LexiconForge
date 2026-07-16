import { generateStableChapterId } from '../../stableIdService';
import type { Chapter } from '../../../types';
import { DbError } from '../core/errors';
import {
  promisifyRequest,
  runTransaction,
  type TransactionMode,
} from '../core/txn';
import type { ChapterRecord } from '../types';
import type { IChapterRepository } from './interfaces/IChapterRepository';

interface ChapterRepositoryDeps {
  getDb: () => Promise<IDBDatabase>;
  normalizeUrl: (url: string) => string | null;
  stores: {
    CHAPTERS: string;
  };
}

export class ChapterRepository implements IChapterRepository {
  constructor(private readonly deps: ChapterRepositoryDeps) {}

  private async withStore<T>(
    mode: TransactionMode,
    operationName: string,
    fn: (store: IDBObjectStore) => Promise<T> | T
  ): Promise<T> {
    const db = await this.deps.getDb();
    const storeName = this.deps.stores.CHAPTERS;
    return runTransaction(
      db,
      storeName,
      mode,
      (_transaction, stores) => fn(stores[storeName]),
      'chapters',
      'ChapterRepository',
      operationName
    );
  }

  private async findByStableId(
    store: IDBObjectStore,
    stableId: string
  ): Promise<ChapterRecord | null> {
    if (store.indexNames.contains('stableId')) {
      const record = await promisifyRequest<ChapterRecord | undefined>(
        store.index('stableId').get(stableId)
      );
      return record ?? null;
    }

    console.warn('[ChapterRepository] stableId index missing, falling back to table scan');
    return new Promise<ChapterRecord | null>((resolve, reject) => {
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(null);
          return;
        }

        const record = cursor.value as ChapterRecord;
        if (record.stableId === stableId) {
          resolve(record);
          return;
        }
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async storeChapter(chapter: Chapter): Promise<ChapterRecord> {
    const originalUrl = chapter.originalUrl || chapter.url;

    if (!originalUrl) {
      throw new Error('[ChapterRepository] Chapter must include originalUrl');
    }

    const nowIso = new Date().toISOString();
    const canonical = this.deps.normalizeUrl(originalUrl) || originalUrl;
    const stableId = generateStableChapterId(
      chapter.content || '',
      chapter.chapterNumber || 0,
      chapter.title || ''
    );

    const record: ChapterRecord = {
      url: originalUrl,
      novelId: chapter.novelId ?? null,
      title: chapter.title || '',
      content: chapter.content ?? '',
      originalUrl,
      nextUrl: chapter.nextUrl ?? undefined,
      prevUrl: chapter.prevUrl ?? undefined,
      fanTranslation: chapter.fanTranslation ?? undefined,
      chapterNumber: chapter.chapterNumber ?? undefined,
      canonicalUrl: canonical || undefined,
      stableId,
      dateAdded: nowIso,
      lastAccessed: nowIso,
    };

    await this.withStore('readwrite', 'storeChapter', async store => {
      const existing = await promisifyRequest<ChapterRecord | undefined>(
        store.get(originalUrl)
      );
      if (existing) {
        record.novelId = existing.novelId ?? record.novelId;
        record.dateAdded = existing.dateAdded;
        record.stableId = existing.stableId || record.stableId;
        record.canonicalUrl = existing.canonicalUrl || record.canonicalUrl;
        if (existing.fanTranslation && !record.fanTranslation) {
          record.fanTranslation = existing.fanTranslation;
        }
        if (existing.chapterNumber != null && record.chapterNumber == null) {
          record.chapterNumber = existing.chapterNumber;
        }
      }

      await promisifyRequest(store.put(record));
    });

    return record;
  }

  async getChapter(chapterUrl: string): Promise<ChapterRecord | null> {
    return this.withStore('readonly', 'getChapter', async store => {
      const record = await promisifyRequest<ChapterRecord | undefined>(
        store.get(chapterUrl)
      );
      return record ?? null;
    });
  }

  async getChapterByStableId(stableId: string): Promise<ChapterRecord | null> {
    return this.withStore('readonly', 'getChapterByStableId', store => {
      return this.findByStableId(store, stableId);
    });
  }

  async setChapterNumberByStableId(stableId: string, chapterNumber: number): Promise<void> {
    await this.withStore('readwrite', 'setChapterNumberByStableId', async store => {
      const record = await this.findByStableId(store, stableId);
      if (!record) {
        throw new DbError(
          'NotFound',
          'chapters',
          'ChapterRepository',
          `Cannot set chapter number: no chapter found for stableId=${stableId}`
        );
      }

      await promisifyRequest(
        store.put({
          ...record,
          chapterNumber,
          lastAccessed: new Date().toISOString(),
        })
      );
    });
  }

  async getAllChapters(): Promise<ChapterRecord[]> {
    return this.withStore('readonly', 'getAllChapters', async store => {
      return promisifyRequest<ChapterRecord[]>(store.getAll());
    });
  }
}
