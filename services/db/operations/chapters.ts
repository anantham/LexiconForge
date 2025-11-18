import type { Chapter } from '../../../types';
import type { ChapterLookupResult, ChapterRecord, ChapterSummaryRecord, TranslationRecord } from '../types';
import { StableIdManager } from '../core/stable-ids';
import { STORE_NAMES } from '../core/schema';
import { withReadTxn, withWriteTxn, promisifyRequest } from '../core/txn';
import { generateStableChapterId, normalizeUrlAggressively } from '../../stableIdService';

const CHAPTER_DOMAIN = 'chapters';

export type ChapterStoreRecord = ChapterRecord;

export const ensureChapterUrlMappings = async (originalUrl: string, stableId: string): Promise<void> => {
  const canonical = normalizeUrlAggressively(originalUrl) || originalUrl;
  const nowIso = new Date().toISOString();

  await withWriteTxn(
    STORE_NAMES.URL_MAPPINGS,
    async (_txn, stores) => {
      const store = stores[STORE_NAMES.URL_MAPPINGS];

      const upsert = async (url: string, isCanonical: boolean) => {
        const existing = (await promisifyRequest(store.get(url))) as
          | { url: string; stableId: string; isCanonical: boolean; dateAdded: string }
          | undefined;

        const record = {
          url,
          stableId,
          isCanonical,
          dateAdded: existing?.dateAdded ?? nowIso,
        };

        await promisifyRequest(store.put(record));
      };

      await upsert(canonical, true);
      if (canonical !== originalUrl) {
        await upsert(originalUrl, false);
      }
    },
    CHAPTER_DOMAIN,
    'operations',
    'ensureUrlMappings'
  );
};

const getActiveTranslation = async (chapterUrl: string): Promise<TranslationRecord | null> => {
  return withReadTxn(
    STORE_NAMES.TRANSLATIONS,
    async (_txn, stores) => {
      const store = stores[STORE_NAMES.TRANSLATIONS];
      const index = store.index('chapterUrl');
      const results = (await promisifyRequest(
        index.getAll(IDBKeyRange.only(chapterUrl))
      )) as TranslationRecord[];
      return results.find(record => record.isActive) || null;
    },
    CHAPTER_DOMAIN,
    'operations',
    'getActiveTranslation'
  ).catch(() => null);
};

export const recomputeChapterSummary = async (chapter: ChapterRecord): Promise<void> => {
  const stableId = chapter.stableId;
  if (!stableId) return;

  const active = await getActiveTranslation(chapter.url);
  const hasImages = Boolean(
    active?.suggestedIllustrations?.some(illustration => illustration?.url || illustration?.generatedImage)
  );

  const summary: ChapterSummaryRecord = {
    stableId,
    canonicalUrl: chapter.canonicalUrl,
    title: chapter.title,
    translatedTitle: active?.translatedTitle,
    chapterNumber: chapter.chapterNumber,
    hasTranslation: Boolean(active),
    hasImages,
    lastAccessed: chapter.lastAccessed,
    lastTranslatedAt: active?.createdAt,
  };

  await withWriteTxn(
    STORE_NAMES.CHAPTER_SUMMARIES,
    async (_txn, stores) => {
      const store = stores[STORE_NAMES.CHAPTER_SUMMARIES];
      await promisifyRequest(store.put(summary));
    },
    CHAPTER_DOMAIN,
    'operations',
    'recomputeSummary'
  ).catch(() => {
    // summaries store is optional; ignore errors to avoid blocking write path
  });
};

const storeChapterModern = async (chapter: Chapter & { stableId?: string }) => {
  const originalUrl = chapter.originalUrl || (chapter as any).url;
  if (!originalUrl) {
    throw new Error('[ChapterOps] Chapter must include originalUrl');
  }

  const nowIso = new Date().toISOString();
  const canonical = normalizeUrlAggressively(originalUrl) || originalUrl;
  const computedStableId =
    chapter.stableId ||
    generateStableChapterId(chapter.content || '', chapter.chapterNumber || 0, chapter.title || '');

  const record = await withWriteTxn(
    STORE_NAMES.CHAPTERS,
    async (_txn, stores) => {
      const store = stores[STORE_NAMES.CHAPTERS];
      const existing = (await promisifyRequest(store.get(originalUrl))) as ChapterRecord | undefined;

      const chapterRecord: ChapterRecord = {
        url: originalUrl,
        title: chapter.title || existing?.title || '',
        content: chapter.content || existing?.content || '',
        originalUrl,
        nextUrl: chapter.nextUrl ?? existing?.nextUrl,
        prevUrl: chapter.prevUrl ?? existing?.prevUrl,
        fanTranslation: chapter.fanTranslation ?? existing?.fanTranslation,
        chapterNumber: chapter.chapterNumber ?? existing?.chapterNumber,
        canonicalUrl: existing?.canonicalUrl || canonical,
        stableId: existing?.stableId || computedStableId,
        dateAdded: existing?.dateAdded || nowIso,
        lastAccessed: nowIso,
      };

      await promisifyRequest(store.put(chapterRecord));
      return chapterRecord;
    },
    CHAPTER_DOMAIN,
    'operations',
    'store'
  );

  if (record.stableId) {
    await ensureChapterUrlMappings(originalUrl, record.stableId);
  }

  await recomputeChapterSummary(record);
};

const getChapterModernByUrl = async (url: string): Promise<ChapterRecord | null> => {
  return withReadTxn(
    STORE_NAMES.CHAPTERS,
    async (_txn, stores) => {
      const store = stores[STORE_NAMES.CHAPTERS];
      const result = (await promisifyRequest(store.get(url))) as ChapterRecord | undefined;
      return result || null;
    },
    CHAPTER_DOMAIN,
    'operations',
    'getByUrl'
  );
};

const getChapterModernByStableId = async (stableId: string): Promise<ChapterRecord | null> => {
  return withReadTxn(
    STORE_NAMES.CHAPTERS,
    async (_txn, stores) => {
      const store = stores[STORE_NAMES.CHAPTERS];
      if (store.indexNames.contains('stableId')) {
        const index = store.index('stableId');
        const result = (await promisifyRequest(index.get(stableId))) as ChapterRecord | undefined;
        if (result) return result;
      }

      // Fallback: scan all chapters
      const all = (await promisifyRequest(store.getAll())) as ChapterRecord[];
      return all.find(ch => ch.stableId === stableId) || null;
    },
    CHAPTER_DOMAIN,
    'operations',
    'getByStableId'
  );
};

const getAllChaptersModern = async (): Promise<ChapterRecord[]> => {
  return withReadTxn(
    STORE_NAMES.CHAPTERS,
    async (_txn, stores) => {
      const store = stores[STORE_NAMES.CHAPTERS];
      return (await promisifyRequest(store.getAll())) as ChapterRecord[];
    },
    CHAPTER_DOMAIN,
    'operations',
    'getAll'
  );
};

const findChapterModernByUrl = async (url: string): Promise<ChapterLookupResult | null> => {
  const record = await getChapterModernByUrl(url);
  if (!record) return null;

  const stableId = record.stableId || generateStableChapterId(record.content || '', record.chapterNumber || 0, record.title || '');

  return {
    stableId,
    canonicalUrl: record.canonicalUrl || record.url,
    title: record.title,
    content: record.content,
    nextUrl: record.nextUrl,
    prevUrl: record.prevUrl,
    chapterNumber: record.chapterNumber,
    fanTranslation: record.fanTranslation,
    data: {
      chapter: {
        title: record.title,
        content: record.content,
        originalUrl: record.url,
        nextUrl: record.nextUrl,
        prevUrl: record.prevUrl,
        chapterNumber: record.chapterNumber,
      },
      translationResult: null,
    },
  };
};

const findChapterModernByNumber = async (chapterNumber: number): Promise<ChapterRecord | null> => {
  return withReadTxn(
    STORE_NAMES.CHAPTERS,
    async (_txn, stores) => {
      const store = stores[STORE_NAMES.CHAPTERS];
      if (store.indexNames.contains('chapterNumber')) {
        const index = store.index('chapterNumber');
        const result = (await promisifyRequest(index.get(chapterNumber))) as ChapterRecord | undefined;
        return result || null;
      }

      const chapters = (await promisifyRequest(store.getAll())) as ChapterRecord[];
      return chapters.find(ch => ch.chapterNumber === chapterNumber) || null;
    },
    CHAPTER_DOMAIN,
    'operations',
    'findByNumber'
  );
};

const setChapterNumberByStableIdModern = async (stableId: string, chapterNumber: number): Promise<void> => {
  await withWriteTxn(
    STORE_NAMES.CHAPTERS,
    async (_txn, stores) => {
      const store = stores[STORE_NAMES.CHAPTERS];
      let record: ChapterRecord | undefined;

      if (store.indexNames.contains('stableId')) {
        const index = store.index('stableId');
        record = (await promisifyRequest(index.get(stableId))) as ChapterRecord | undefined;
      } else {
        const all = (await promisifyRequest(store.getAll())) as ChapterRecord[];
        record = all.find(ch => ch.stableId === stableId);
      }

      if (!record) return;
      record.chapterNumber = chapterNumber;
      record.lastAccessed = new Date().toISOString();
      await promisifyRequest(store.put(record));
    },
    CHAPTER_DOMAIN,
    'operations',
    'setChapterNumberByStableId'
  );
};

const deleteChapterModernByUrl = async (chapterUrl: string): Promise<void> => {
  await withWriteTxn(
    [STORE_NAMES.CHAPTERS, STORE_NAMES.CHAPTER_SUMMARIES, STORE_NAMES.TRANSLATIONS],
    async (_txn, stores) => {
      const chaptersStore = stores[STORE_NAMES.CHAPTERS];
      const summariesStore = stores[STORE_NAMES.CHAPTER_SUMMARIES];
      const translationsStore = stores[STORE_NAMES.TRANSLATIONS];

      const chapter = (await promisifyRequest(chaptersStore.get(chapterUrl))) as ChapterRecord | undefined;
      if (!chapter) return;

      await promisifyRequest(chaptersStore.delete(chapterUrl));
      if (chapter.stableId && summariesStore) {
        await promisifyRequest(summariesStore.delete(chapter.stableId));
      }

      const index = translationsStore.index('chapterUrl');
      await new Promise<void>((resolve, reject) => {
        const cursorReq = index.openCursor(IDBKeyRange.only(chapter.url));
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result as IDBCursorWithValue | null;
          if (!cursor) {
            resolve();
            return;
          }
          cursor.delete();
          cursor.continue();
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
    },
    CHAPTER_DOMAIN,
    'operations',
    'deleteByUrl'
  );
};

const getMostRecentChapterModern = async (): Promise<ChapterRecord | null> => {
  return withReadTxn(
    STORE_NAMES.CHAPTERS,
    async (_txn, stores) => {
      const store = stores[STORE_NAMES.CHAPTERS];
      const hasIndex = store.indexNames.contains('lastAccessed');
      if (hasIndex) {
        const index = store.index('lastAccessed');
        return await new Promise<ChapterRecord | null>((resolve, reject) => {
          const cursorReq = index.openCursor(null, 'prev');
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result as IDBCursorWithValue | null;
            if (!cursor) {
              resolve(null);
              return;
            }
            resolve(cursor.value as ChapterRecord);
          };
          cursorReq.onerror = () => reject(cursorReq.error);
        });
      }

      const all = (await promisifyRequest(store.getAll())) as ChapterRecord[];
      if (!all.length) return null;
      const sorted = all.slice().sort((a, b) => {
        const aTime = Date.parse(a.lastAccessed || '') || 0;
        const bTime = Date.parse(b.lastAccessed || '') || 0;
        return bTime - aTime;
      });
      return sorted[0] || null;
    },
    CHAPTER_DOMAIN,
    'operations',
    'getMostRecentChapter'
  );
};

export class ChapterOps {
  static async store(chapter: Chapter & { stableId?: string }): Promise<void> {
    await storeChapterModern(chapter);
  }

  static async getByUrl(url: string): Promise<ChapterRecord | null> {
    return getChapterModernByUrl(url);
  }

  static async getByStableId(stableId: string): Promise<ChapterRecord | null> {
    return getChapterModernByStableId(stableId);
  }

  static async getAll(): Promise<ChapterRecord[]> {
    return getAllChaptersModern();
  }

  static async findByUrl(pattern: string): Promise<ChapterLookupResult | null> {
    return findChapterModernByUrl(pattern);
  }

  static async storeEnhanced(enhanced: any): Promise<void> {
    const originalUrl = enhanced.originalUrl || enhanced.canonicalUrl;
    if (!originalUrl) {
      throw new Error('[ChapterOps] Enhanced chapter requires originalUrl or canonicalUrl');
    }

    const chapter: Chapter = {
      title: enhanced.title,
      content: enhanced.content,
      originalUrl,
      canonicalUrl: enhanced.canonicalUrl || enhanced.originalUrl,
      nextUrl: enhanced.nextUrl,
      prevUrl: enhanced.prevUrl,
      chapterNumber: enhanced.chapterNumber,
      fanTranslation: enhanced.fanTranslation ?? null,
    };

    await storeChapterModern({ ...chapter, stableId: enhanced.id });
  }

  static async findByNumber(chapterNumber: number): Promise<ChapterRecord | null> {
    return findChapterModernByNumber(chapterNumber);
  }

  static async deleteByUrl(chapterUrl: string): Promise<void> {
    await deleteChapterModernByUrl(chapterUrl);
  }

  static async setChapterNumberByStableId(stableId: string, chapterNumber: number): Promise<void> {
    await setChapterNumberByStableIdModern(stableId, chapterNumber);
  }

  static async getActiveTranslation(chapterUrl: string): Promise<TranslationRecord | null> {
    return getActiveTranslation(chapterUrl);
  }

  static normalizeUrl(url: string): string | null {
    return normalizeUrlAggressively(url);
  }

  static async getMostRecentStableReference(): Promise<{ stableId: string; canonicalUrl: string } | null> {
    const record = await getMostRecentChapterModern();
    if (!record) return null;

    const stableId =
      record.stableId ||
      generateStableChapterId(record.content || '', record.chapterNumber || 0, record.title || '');
    if (!stableId) return null;

    return {
      stableId,
      canonicalUrl: record.canonicalUrl || record.url,
    };
  }

  static async ensureUrlMappings(originalUrl: string, stableId?: string): Promise<void> {
    if (!originalUrl || !stableId) return;
    await ensureChapterUrlMappings(originalUrl, stableId);
  }
}
