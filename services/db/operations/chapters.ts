import type { Chapter } from '../../../types';
import type { ChapterLookupResult, ChapterRecord, ChapterSummaryRecord, TranslationRecord, UrlMappingRecord } from '../types';
import { StableIdManager } from '../core/stable-ids';
import { STORE_NAMES } from '../core/schema';
import { withReadTxn, withWriteTxn, promisifyRequest } from '../core/txn';
import { generateStableChapterId, normalizeUrlAggressively } from '../../stableIdService';
import { buildScopedStorageUrl } from '../../libraryScope';
import { debugLog, debugWarn } from '../../../utils/debug';

const CHAPTER_DOMAIN = 'chapters';

export type ChapterStoreRecord = ChapterRecord;

export interface ChapterDeleteScope {
  novelId?: string | null;
  libraryVersionId?: string | null;
}

export const ensureChapterUrlMappings = async (
  originalUrl: string,
  stableId: string,
  novelId: string | null = null,
  libraryVersionId: string | null = null,
  chapterNumber?: number
): Promise<void> => {
  const canonical = normalizeUrlAggressively(originalUrl) || originalUrl;
  const nowIso = new Date().toISOString();

  await withWriteTxn(
    STORE_NAMES.URL_MAPPINGS,
    async (_txn, stores) => {
      const store = stores[STORE_NAMES.URL_MAPPINGS];

      const upsert = async (url: string, isCanonical: boolean) => {
        const existing = (await promisifyRequest(store.get(url))) as UrlMappingRecord | undefined;

        const record = {
          url,
          stableId,
          novelId: existing?.novelId ?? novelId,
          libraryVersionId: existing?.libraryVersionId ?? libraryVersionId,
          chapterNumber: existing?.chapterNumber ?? chapterNumber,
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
    novelId: chapter.novelId ?? null,
    libraryVersionId: chapter.libraryVersionId ?? null,
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

const matchesChapterSourceUrl = (chapter: ChapterRecord, candidateUrl: string): boolean => {
  const normalizedCandidate = normalizeUrlAggressively(candidateUrl) || candidateUrl;
  const urls = [
    chapter.originalUrl,
    chapter.canonicalUrl,
    chapter.url,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  return urls.some((url) => {
    if (url === candidateUrl || url === normalizedCandidate) {
      return true;
    }
    const normalizedUrl = normalizeUrlAggressively(url) || url;
    return normalizedUrl === normalizedCandidate;
  });
};

const chapterDiagnosticFingerprint = (chapter: ChapterRecord) => ({
  stableId: chapter.stableId ?? null,
  url: chapter.url,
  originalUrl: chapter.originalUrl ?? null,
  canonicalUrl: chapter.canonicalUrl ?? null,
  normalizedOriginalUrl: normalizeUrlAggressively(chapter.originalUrl || chapter.url) || chapter.originalUrl || chapter.url,
  normalizedCanonicalUrl: normalizeUrlAggressively(chapter.canonicalUrl || chapter.url) || chapter.canonicalUrl || chapter.url,
  chapterNumber: chapter.chapterNumber ?? null,
  title: chapter.title ?? null,
  novelId: chapter.novelId ?? null,
  libraryVersionId: chapter.libraryVersionId ?? null,
});

const toChapterLookupResult = (record: ChapterRecord): ChapterLookupResult => {
  const stableId = record.stableId || generateStableChapterId(record.content || '', record.chapterNumber || 0, record.title || '');

  return {
    stableId,
    canonicalUrl: record.canonicalUrl || record.url,
    novelId: record.novelId ?? null,
    libraryVersionId: record.libraryVersionId ?? null,
    title: record.title,
    content: record.content,
    nextUrl: record.nextUrl,
    prevUrl: record.prevUrl,
    chapterNumber: record.chapterNumber,
    fanTranslation: record.fanTranslation,
    suttaStudio: record.suttaStudio ?? null,
    blurb: record.blurb ?? null,
    sourceLanguage: record.sourceLanguage ?? null,
    data: {
      chapter: {
        title: record.title,
        content: record.content,
        originalUrl: record.originalUrl || record.canonicalUrl || record.url,
        novelId: record.novelId ?? null,
        libraryVersionId: record.libraryVersionId ?? null,
        nextUrl: record.nextUrl,
        prevUrl: record.prevUrl,
        chapterNumber: record.chapterNumber,
        suttaStudio: record.suttaStudio ?? null,
        blurb: record.blurb ?? null,
        sourceLanguage: record.sourceLanguage ?? null,
      },
      translationResult: null,
    },
  };
};

const storeChapterModern = async (
  chapter: Chapter & { stableId?: string; novelId?: string | null; libraryVersionId?: string | null }
) => {
  const originalUrl = chapter.originalUrl || (chapter as any).url;
  if (!originalUrl) {
    throw new Error('[ChapterOps] Chapter must include originalUrl');
  }

  const nowIso = new Date().toISOString();
  const canonical = normalizeUrlAggressively(originalUrl) || originalUrl;
  const computedStableId =
    chapter.stableId ||
    generateStableChapterId(chapter.content || '', chapter.chapterNumber || 0, chapter.title || '');
  const libraryVersionId = chapter.libraryVersionId ?? null;
  const storageUrl =
    chapter.novelId
      ? buildScopedStorageUrl(computedStableId, chapter.novelId, libraryVersionId)
      : originalUrl;

  const record = await withWriteTxn(
    STORE_NAMES.CHAPTERS,
    async (_txn, stores) => {
      const store = stores[STORE_NAMES.CHAPTERS];
      const existing = (await promisifyRequest(store.get(storageUrl))) as ChapterRecord | undefined;

      const chapterRecord: ChapterRecord = {
        url: storageUrl,
        novelId: chapter.novelId ?? existing?.novelId ?? null,
        libraryVersionId,
        title: chapter.title || existing?.title || '',
        content: chapter.content || existing?.content || '',
        originalUrl,
        nextUrl: chapter.nextUrl ?? existing?.nextUrl,
        prevUrl: chapter.prevUrl ?? existing?.prevUrl,
        fanTranslation: chapter.fanTranslation ?? existing?.fanTranslation,
        suttaStudio: chapter.suttaStudio ?? existing?.suttaStudio ?? null,
        blurb: (chapter as any).blurb ?? existing?.blurb ?? null,
        sourceLanguage: (chapter as any).sourceLanguage ?? existing?.sourceLanguage ?? null,
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
    await ensureChapterUrlMappings(
      originalUrl,
      record.stableId,
      record.novelId,
      record.libraryVersionId ?? null,
      record.chapterNumber
    );
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
  return toChapterLookupResult(record);
};

const findChapterModernBySourceUrl = async (
  url: string,
  novelId: string,
  libraryVersionId: string | null = null
): Promise<ChapterLookupResult | null> => {
  return withReadTxn(
    STORE_NAMES.CHAPTERS,
    async (_txn, stores) => {
      const store = stores[STORE_NAMES.CHAPTERS];
      let candidates: ChapterRecord[] = [];

      if (store.indexNames.contains('novelVersion')) {
        const index = store.index('novelVersion');
        candidates = (await promisifyRequest(
          index.getAll([novelId, libraryVersionId])
        )) as ChapterRecord[];
      } else if (store.indexNames.contains('novelId')) {
        const index = store.index('novelId');
        const rows = (await promisifyRequest(index.getAll(novelId))) as ChapterRecord[];
        candidates = rows.filter((row) => (row.libraryVersionId ?? null) === libraryVersionId);
      } else {
        const rows = (await promisifyRequest(store.getAll())) as ChapterRecord[];
        candidates = rows.filter((row) => {
          return (
            (row.novelId ?? null) === novelId &&
            (row.libraryVersionId ?? null) === libraryVersionId
          );
        });
      }

      const matched = candidates.find((record) => matchesChapterSourceUrl(record, url)) || null;
      return matched ? toChapterLookupResult(matched) : null;
    },
    CHAPTER_DOMAIN,
    'operations',
    'findBySourceUrl'
  );
};

const findChapterModernByNumber = async (
  chapterNumber: number,
  novelId?: string | null,
  libraryVersionId?: string | null
): Promise<ChapterRecord | null> => {
  return withReadTxn(
    STORE_NAMES.CHAPTERS,
    async (_txn, stores) => {
      const store = stores[STORE_NAMES.CHAPTERS];
      if (novelId && store.indexNames.contains('novelVersionChapter')) {
        const index = store.index('novelVersionChapter');
        const result = (await promisifyRequest(
          index.get([novelId, libraryVersionId ?? null, chapterNumber])
        )) as ChapterRecord | undefined;
        return result || null;
      }

      if (novelId && store.indexNames.contains('novelId')) {
        const index = store.index('novelId');
        const rows = (await promisifyRequest(index.getAll(novelId))) as ChapterRecord[];
        return (
          rows.find(ch => {
            return (
              ch.chapterNumber === chapterNumber &&
              (ch.libraryVersionId ?? null) === (libraryVersionId ?? null)
            );
          }) || null
        );
      }

      if (!novelId && store.indexNames.contains('chapterNumber')) {
        const index = store.index('chapterNumber');
        const result = (await promisifyRequest(index.get(chapterNumber))) as ChapterRecord | undefined;
        return result || null;
      }

      const chapters = (await promisifyRequest(store.getAll())) as ChapterRecord[];
      return chapters.find(
        ch =>
          ch.chapterNumber === chapterNumber &&
          (typeof novelId === 'undefined' ? true : (ch.novelId ?? null) === novelId) &&
          (typeof novelId === 'undefined'
            ? true
            : (ch.libraryVersionId ?? null) === (libraryVersionId ?? null))
      ) || null;
    },
    CHAPTER_DOMAIN,
    'operations',
    'findByNumber'
  );
};

const getChaptersByNovelAndVersion = async (
  novelId: string,
  libraryVersionId: string
): Promise<ChapterRecord[]> => {
  return withReadTxn(
    STORE_NAMES.CHAPTERS,
    async (_txn, stores) => {
      const store = stores[STORE_NAMES.CHAPTERS];

      // Use novelId index if available
      if (store.indexNames.contains('novelId')) {
        const index = store.index('novelId');
        const rows = (await promisifyRequest(index.getAll(novelId))) as ChapterRecord[];
        return rows.filter(
          ch => (ch.libraryVersionId ?? null) === (libraryVersionId ?? null)
        );
      }

      // Fallback: full scan
      const all = (await promisifyRequest(store.getAll())) as ChapterRecord[];
      return all.filter(
        ch =>
          (ch.novelId ?? null) === novelId &&
          (ch.libraryVersionId ?? null) === (libraryVersionId ?? null)
      );
    },
    CHAPTER_DOMAIN,
    'operations',
    'getByNovelAndVersion'
  );
};

// Parse embedded chapter number from a stableId baseHash like
// "lf-library:NOVEL::VERSION:ch339_60hkvy_65g6" -> 339.
// Returns null when the stableId does not match the chN_ convention.
const parseChapterNumberFromStableId = (stableId: string): number | null => {
  const m = /:ch(\d+)_/.exec(stableId);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const setChapterNumberByStableIdModern = async (stableId: string, chapterNumber: number): Promise<void> => {
  // Defensive guard (issue #20). Historical writers (history walker in
  // translationService) called this with inferred numbers that disagreed
  // with the stableId's own baseHash, corrupting chapter rows. Refuse
  // the write on mismatch.
  const fromStableId = parseChapterNumberFromStableId(stableId);
  if (fromStableId !== null && fromStableId !== chapterNumber) {
    debugWarn('indexeddb', 'summary', '[ChapterOps.setChapterNumberByStableId] REFUSED: argument disagrees with stableId baseHash', {
      stableId,
      requestedChapterNumber: chapterNumber,
      stableIdEncodes: fromStableId,
    });
    return;
  }

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
  debugLog('indexeddb', 'summary', '[ChapterOps] deleteByUrl:start', {
    chapterUrl,
    normalizedChapterUrl: normalizeUrlAggressively(chapterUrl) || chapterUrl,
  });

  await withWriteTxn(
    [STORE_NAMES.CHAPTERS, STORE_NAMES.CHAPTER_SUMMARIES, STORE_NAMES.TRANSLATIONS],
    async (_txn, stores) => {
      const chaptersStore = stores[STORE_NAMES.CHAPTERS];
      const summariesStore = stores[STORE_NAMES.CHAPTER_SUMMARIES];
      const translationsStore = stores[STORE_NAMES.TRANSLATIONS];

      const chapter = (await promisifyRequest(chaptersStore.get(chapterUrl))) as ChapterRecord | undefined;
      if (!chapter) {
        debugWarn('indexeddb', 'summary', '[ChapterOps] deleteByUrl:chapter_missing', {
          chapterUrl,
          normalizedChapterUrl: normalizeUrlAggressively(chapterUrl) || chapterUrl,
        });
        return;
      }

      const allChaptersBefore = (await promisifyRequest(chaptersStore.getAll())) as ChapterRecord[];
      const targetNormalizedOriginal =
        normalizeUrlAggressively(chapter.originalUrl || chapter.url) || chapter.originalUrl || chapter.url;
      const targetNormalizedCanonical =
        normalizeUrlAggressively(chapter.canonicalUrl || chapter.url) || chapter.canonicalUrl || chapter.url;
      const duplicateCandidatesBefore = allChaptersBefore
        .filter((candidate) => {
          if (candidate.url === chapter.url) return false;
          const candidateNormalizedOriginal =
            normalizeUrlAggressively(candidate.originalUrl || candidate.url) || candidate.originalUrl || candidate.url;
          const candidateNormalizedCanonical =
            normalizeUrlAggressively(candidate.canonicalUrl || candidate.url) || candidate.canonicalUrl || candidate.url;

          return (
            (chapter.chapterNumber != null &&
              candidate.chapterNumber != null &&
              chapter.chapterNumber === candidate.chapterNumber) ||
            candidateNormalizedOriginal === targetNormalizedOriginal ||
            candidateNormalizedOriginal === targetNormalizedCanonical ||
            candidateNormalizedCanonical === targetNormalizedOriginal ||
            candidateNormalizedCanonical === targetNormalizedCanonical
          );
        })
        .map(chapterDiagnosticFingerprint);

      debugLog('indexeddb', 'summary', '[ChapterOps] deleteByUrl:resolved_chapter', {
        target: chapterDiagnosticFingerprint(chapter),
        duplicateCandidatesBefore,
      });

      await promisifyRequest(chaptersStore.delete(chapterUrl));
      if (chapter.stableId && summariesStore) {
        await promisifyRequest(summariesStore.delete(chapter.stableId));
      }

      const index = translationsStore.index('chapterUrl');
      let deletedTranslationCount = 0;
      await new Promise<void>((resolve, reject) => {
        const cursorReq = index.openCursor(IDBKeyRange.only(chapter.url));
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result as IDBCursorWithValue | null;
          if (!cursor) {
            resolve();
            return;
          }
          deletedTranslationCount += 1;
          cursor.delete();
          cursor.continue();
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });

      const remainingChaptersAfter = (await promisifyRequest(chaptersStore.getAll())) as ChapterRecord[];
      const duplicateCandidatesAfter = remainingChaptersAfter
        .filter((candidate) => {
          const candidateNormalizedOriginal =
            normalizeUrlAggressively(candidate.originalUrl || candidate.url) || candidate.originalUrl || candidate.url;
          const candidateNormalizedCanonical =
            normalizeUrlAggressively(candidate.canonicalUrl || candidate.url) || candidate.canonicalUrl || candidate.url;

          return (
            (chapter.chapterNumber != null &&
              candidate.chapterNumber != null &&
              chapter.chapterNumber === candidate.chapterNumber) ||
            candidateNormalizedOriginal === targetNormalizedOriginal ||
            candidateNormalizedOriginal === targetNormalizedCanonical ||
            candidateNormalizedCanonical === targetNormalizedOriginal ||
            candidateNormalizedCanonical === targetNormalizedCanonical
          );
        })
        .map(chapterDiagnosticFingerprint);

      debugLog('indexeddb', 'summary', '[ChapterOps] deleteByUrl:complete', {
        target: chapterDiagnosticFingerprint(chapter),
        deletedSummary: Boolean(chapter.stableId),
        deletedTranslationCount,
        duplicateCandidatesAfter,
      });
    },
    CHAPTER_DOMAIN,
    'operations',
    'deleteByUrl'
  );
};

const deleteChapterModernByStableId = async (
  stableId: string,
  scope: ChapterDeleteScope = {}
): Promise<void> => {
  debugLog('indexeddb', 'summary', '[ChapterOps] deleteByStableId:start', {
    stableId,
    requestedNovelId: scope.novelId ?? null,
    requestedLibraryVersionId: scope.libraryVersionId ?? null,
  });

  await withWriteTxn(
    [STORE_NAMES.CHAPTERS, STORE_NAMES.CHAPTER_SUMMARIES, STORE_NAMES.TRANSLATIONS, STORE_NAMES.URL_MAPPINGS],
    async (_txn, stores) => {
      const chaptersStore = stores[STORE_NAMES.CHAPTERS];
      const summariesStore = stores[STORE_NAMES.CHAPTER_SUMMARIES];
      const translationsStore = stores[STORE_NAMES.TRANSLATIONS];
      const mappingsStore = stores[STORE_NAMES.URL_MAPPINGS];

      let chapter: ChapterRecord | null = null;
      if (chaptersStore.indexNames.contains('stableId')) {
        const stableIndex = chaptersStore.index('stableId');
        chapter = ((await promisifyRequest(stableIndex.get(stableId))) as ChapterRecord | undefined) ?? null;
      } else {
        const allChapters = (await promisifyRequest(chaptersStore.getAll())) as ChapterRecord[];
        chapter = allChapters.find((candidate) => candidate.stableId === stableId) ?? null;
      }

      if (!chapter) {
        debugWarn('indexeddb', 'summary', '[ChapterOps] deleteByStableId:chapter_missing', {
          stableId,
          requestedNovelId: scope.novelId ?? null,
          requestedLibraryVersionId: scope.libraryVersionId ?? null,
        });
        return;
      }

      debugLog('indexeddb', 'summary', '[ChapterOps] deleteByStableId:resolved_chapter', {
        stableId,
        chapterUrl: chapter.url,
        originalUrl: chapter.originalUrl ?? null,
        canonicalUrl: chapter.canonicalUrl ?? null,
        storedNovelId: chapter.novelId ?? null,
        storedLibraryVersionId: chapter.libraryVersionId ?? null,
      });

      if (typeof scope.novelId !== 'undefined' && (chapter.novelId ?? null) !== (scope.novelId ?? null)) {
        throw new Error(
          `[ChapterOps] deleteByStableId novel scope mismatch for ${stableId}: stored=${chapter.novelId ?? 'null'} requested=${scope.novelId ?? 'null'}`
        );
      }

      if (
        typeof scope.libraryVersionId !== 'undefined' &&
        (chapter.libraryVersionId ?? null) !== (scope.libraryVersionId ?? null)
      ) {
        throw new Error(
          `[ChapterOps] deleteByStableId version scope mismatch for ${stableId}: stored=${chapter.libraryVersionId ?? 'null'} requested=${scope.libraryVersionId ?? 'null'}`
        );
      }

      await promisifyRequest(chaptersStore.delete(chapter.url));
      await promisifyRequest(summariesStore.delete(stableId));

      let deletedTranslationCount = 0;
      if (translationsStore.indexNames.contains('stableId')) {
        const stableIndex = translationsStore.index('stableId');
        await new Promise<void>((resolve, reject) => {
          const cursorReq = stableIndex.openCursor(IDBKeyRange.only(stableId));
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result as IDBCursorWithValue | null;
            if (!cursor) {
              resolve();
              return;
            }
            deletedTranslationCount += 1;
            cursor.delete();
            cursor.continue();
          };
          cursorReq.onerror = () => reject(cursorReq.error);
        });
      } else {
        const chapterUrlIndex = translationsStore.index('chapterUrl');
        await new Promise<void>((resolve, reject) => {
          const cursorReq = chapterUrlIndex.openCursor(IDBKeyRange.only(chapter.url));
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result as IDBCursorWithValue | null;
            if (!cursor) {
              resolve();
              return;
            }
            deletedTranslationCount += 1;
            cursor.delete();
            cursor.continue();
          };
          cursorReq.onerror = () => reject(cursorReq.error);
        });
      }

      let deletedMappingCount = 0;
      if (mappingsStore.indexNames.contains('stableId')) {
        const stableIndex = mappingsStore.index('stableId');
        await new Promise<void>((resolve, reject) => {
          const cursorReq = stableIndex.openCursor(IDBKeyRange.only(stableId));
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result as IDBCursorWithValue | null;
            if (!cursor) {
              resolve();
              return;
            }
            deletedMappingCount += 1;
            cursor.delete();
            cursor.continue();
          };
          cursorReq.onerror = () => reject(cursorReq.error);
        });
      }

      debugLog('indexeddb', 'summary', '[ChapterOps] deleteByStableId:complete', {
        stableId,
        chapterUrl: chapter.url,
        deletedSummary: true,
        deletedTranslationCount,
        deletedMappingCount,
      });
    },
    CHAPTER_DOMAIN,
    'operations',
    'deleteByStableId'
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
  static async store(
    chapter: Chapter & { stableId?: string; novelId?: string | null; libraryVersionId?: string | null }
  ): Promise<void> {
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

  static async findBySourceUrl(
    url: string,
    novelId: string,
    libraryVersionId: string | null = null
  ): Promise<ChapterLookupResult | null> {
    return findChapterModernBySourceUrl(url, novelId, libraryVersionId);
  }

  static async storeEnhanced(enhanced: any): Promise<void> {
    const preferredOriginalUrl = enhanced.originalUrl ?? null;
    const fallbackUrl = enhanced.canonicalUrl ?? null;
    const originalUrl = preferredOriginalUrl ?? fallbackUrl;
    if (!originalUrl) {
      throw new Error('[ChapterOps] Enhanced chapter requires originalUrl or canonicalUrl');
    }

    const canonicalUrl = enhanced.canonicalUrl ?? enhanced.originalUrl ?? undefined;

    const chapter: Chapter = {
      title: enhanced.title,
      content: enhanced.content,
      originalUrl,
      novelId: enhanced.novelId ?? null,
      libraryVersionId: enhanced.libraryVersionId ?? null,
      canonicalUrl,
      nextUrl: enhanced.nextUrl,
      prevUrl: enhanced.prevUrl,
      chapterNumber: enhanced.chapterNumber,
      fanTranslation: enhanced.fanTranslation ?? null,
      suttaStudio: enhanced.suttaStudio ?? null,
      blurb: enhanced.blurb ?? null,
      sourceLanguage: enhanced.sourceLanguage ?? null,
    };

    await storeChapterModern({ ...chapter, stableId: enhanced.id });
  }

  static async findByNumber(
    chapterNumber: number,
    novelId?: string | null,
    libraryVersionId?: string | null
  ): Promise<ChapterRecord | null> {
    return findChapterModernByNumber(chapterNumber, novelId, libraryVersionId);
  }

  static async getByNovelAndVersion(
    novelId: string,
    libraryVersionId: string
  ): Promise<ChapterRecord[]> {
    return getChaptersByNovelAndVersion(novelId, libraryVersionId);
  }

  static async deleteByUrl(chapterUrl: string): Promise<void> {
    await deleteChapterModernByUrl(chapterUrl);
  }

  static async deleteByStableId(stableId: string, scope: ChapterDeleteScope = {}): Promise<void> {
    await deleteChapterModernByStableId(stableId, scope);
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

  static async ensureUrlMappings(
    originalUrl: string,
    stableId?: string,
    novelId: string | null = null,
    libraryVersionId: string | null = null,
    chapterNumber?: number
  ): Promise<void> {
    if (!originalUrl || !stableId) return;
    await ensureChapterUrlMappings(originalUrl, stableId, novelId, libraryVersionId, chapterNumber);
  }
}
