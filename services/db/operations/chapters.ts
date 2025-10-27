import type { Chapter } from '../../../types';
import { indexedDBService } from '../../indexeddb';
import { StableIdManager } from '../core/stable-ids';
import { STORE_NAMES } from '../core/schema';
import { withReadTxn, withWriteTxn, promisifyRequest } from '../core/txn';
import { isModernDbEnabled } from '../utils/featureFlags';
import { generateStableChapterId, normalizeUrlAggressively } from '../../stableIdService';

const CHAPTER_DOMAIN = 'chapters';

type ChapterRecord = {
  url: string;
  title: string;
  content: string;
  originalUrl: string;
  nextUrl?: string;
  prevUrl?: string;
  fanTranslation?: string;
  chapterNumber?: number;
  canonicalUrl?: string;
  stableId?: string;
  dateAdded: string;
  lastAccessed: string;
};

export type ChapterStoreRecord = ChapterRecord;

type TranslationRecord = {
  chapterUrl: string;
  translatedTitle?: string;
  suggestedIllustrations?: Array<{ url?: string; generatedImage?: string }>;
  createdAt?: string;
  isActive?: boolean;
};

type ChapterSummaryRecord = {
  stableId: string;
  canonicalUrl?: string;
  title: string;
  translatedTitle?: string;
  chapterNumber?: number;
  hasTranslation: boolean;
  hasImages: boolean;
  lastAccessed?: string;
  lastTranslatedAt?: string;
};

const shouldUseLegacy = () => !isModernDbEnabled(CHAPTER_DOMAIN);

export const ensureChapterUrlMappings = async (originalUrl: string, stableId: string) => {
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

const findChapterModernByUrl = async (url: string) => {
  const record = await getChapterModernByUrl(url);
  if (!record) return null;

  const stableId = record.stableId || generateStableChapterId(record.content || '', record.chapterNumber || 0, record.title || '');

  return {
    stableId,
    canonicalUrl: record.canonicalUrl || record.url,
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

export class ChapterOps {
  static async store(chapter: Chapter & { stableId?: string }): Promise<void> {
    if (shouldUseLegacy()) {
      await indexedDBService.storeChapter(chapter);
      if (chapter.stableId) {
        await StableIdManager.ensureUrlMappings(chapter.originalUrl, chapter.stableId);
      }
      return;
    }

    await storeChapterModern(chapter);
  }

  static async getByUrl(url: string) {
    if (shouldUseLegacy()) {
      return indexedDBService.getChapter(url);
    }

    return getChapterModernByUrl(url);
  }

  static async getByStableId(stableId: string) {
    if (shouldUseLegacy()) {
      return indexedDBService.getChapterByStableId(stableId);
    }

    return getChapterModernByStableId(stableId);
  }

  static async getAll() {
    if (shouldUseLegacy()) {
      return indexedDBService.getAllChapters();
    }

    return getAllChaptersModern();
  }

  static async findByUrl(pattern: string) {
    if (shouldUseLegacy()) {
      return indexedDBService.findChapterByUrl(pattern as any);
    }

    return findChapterModernByUrl(pattern);
  }

  static async storeEnhanced(enhanced: any) {
    if (shouldUseLegacy()) {
      return indexedDBService.storeEnhancedChapter(enhanced);
    }

    const chapter: Chapter = {
      title: enhanced.title,
      content: enhanced.content,
      originalUrl: enhanced.canonicalUrl || enhanced.originalUrl,
      nextUrl: enhanced.nextUrl,
      prevUrl: enhanced.prevUrl,
      chapterNumber: enhanced.chapterNumber,
    };

    await storeChapterModern({ ...chapter, stableId: enhanced.id });
  }
}
