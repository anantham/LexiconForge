import { generateStableChapterId } from '../../stableIdService';
import type { Chapter } from '../../../types';
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

  async storeChapter(chapter: Chapter): Promise<ChapterRecord> {
    const db = await this.deps.getDb();
    const originalUrl = chapter.originalUrl || chapter.url;

    if (!originalUrl) {
      throw new Error('[ChapterRepository] Chapter must include originalUrl');
    }

    const nowIso = new Date().toISOString();
    const canonical = this.deps.normalizeUrl(originalUrl) || originalUrl;
    const stableId = generateStableChapterId(chapter.content || '', chapter.chapterNumber || 0, chapter.title || '');

    const record: ChapterRecord = {
      url: originalUrl,
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

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([this.deps.stores.CHAPTERS], 'readwrite');
      const store = transaction.objectStore(this.deps.stores.CHAPTERS);
      const getRequest = store.get(originalUrl);

      getRequest.onsuccess = () => {
        const existing = getRequest.result as ChapterRecord | undefined;
        if (existing) {
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

        const putRequest = store.put(record);
        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });

    return record;
  }

  async getChapter(chapterUrl: string): Promise<ChapterRecord | null> {
    const db = await this.deps.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.deps.stores.CHAPTERS], 'readonly');
      const store = transaction.objectStore(this.deps.stores.CHAPTERS);
      const request = store.get(chapterUrl);
      request.onsuccess = () => resolve((request.result as ChapterRecord) || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getChapterByStableId(stableId: string): Promise<ChapterRecord | null> {
    const db = await this.deps.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.deps.stores.CHAPTERS], 'readonly');
      const store = transaction.objectStore(this.deps.stores.CHAPTERS);
      const index = store.index('stableId');
      const request = index.get(stableId);
      request.onsuccess = () => resolve((request.result as ChapterRecord) || null);
      request.onerror = () => reject(request.error);
    });
  }

  async setChapterNumberByStableId(stableId: string, chapterNumber: number): Promise<void> {
    const db = await this.deps.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.deps.stores.CHAPTERS], 'readwrite');
      const store = transaction.objectStore(this.deps.stores.CHAPTERS);
      const index = store.index('stableId');
      const request = index.get(stableId);

      request.onsuccess = () => {
        const record = request.result as ChapterRecord | undefined;
        if (!record) {
          reject(new Error(`No chapter found for stableId=${stableId}`));
          return;
        }
        record.chapterNumber = chapterNumber;
        record.lastAccessed = new Date().toISOString();
        const putRequest = store.put(record);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getAllChapters(): Promise<ChapterRecord[]> {
    const db = await this.deps.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.deps.stores.CHAPTERS], 'readonly');
      const store = transaction.objectStore(this.deps.stores.CHAPTERS);
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result as ChapterRecord[]) || []);
      request.onerror = () => reject(request.error);
    });
  }
}
