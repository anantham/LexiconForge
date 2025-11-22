import type { ChapterRecord, ChapterSummaryRecord, TranslationRecord } from '../types';
import { generateStableChapterId } from '../../stableIdService';
import { STORE_NAMES } from '../core/schema';
import { getConnection } from '../core/connection';
import { ChapterOps } from './chapters';

export interface SummaryOpsDeps {
  openDatabase: () => Promise<IDBDatabase>;
  getChapter: (url: string) => Promise<ChapterRecord | null>;
  getChapterByStableId: (stableId: string) => Promise<ChapterRecord | null>;
  getActiveTranslation: (url: string) => Promise<TranslationRecord | null>;
  normalizeUrl: (url: string) => string | null;
}

const countStoreRecords = async (db: IDBDatabase, storeName: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([storeName], 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    } catch (error) {
      reject(error as Error);
    }
  });
};

const getAllChapterRecords = async (db: IDBDatabase): Promise<ChapterRecord[]> => {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_NAMES.CHAPTERS], 'readonly');
      const store = tx.objectStore(STORE_NAMES.CHAPTERS);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as ChapterRecord[]) || []);
      req.onerror = () => reject(req.error);
    } catch (error) {
      reject(error as Error);
    }
  });
};

const getActiveTranslationMap = async (db: IDBDatabase): Promise<Map<string, TranslationRecord>> => {
  return new Promise((resolve, reject) => {
    try {
      if (!db.objectStoreNames.contains(STORE_NAMES.TRANSLATIONS)) {
        resolve(new Map());
        return;
      }
      const tx = db.transaction([STORE_NAMES.TRANSLATIONS], 'readonly');
      const store = tx.objectStore(STORE_NAMES.TRANSLATIONS);
      const req = store.openCursor();
      const map = new Map<string, TranslationRecord>();
      req.onsuccess = () => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (!cursor) {
          resolve(map);
          return;
        }
        const record = cursor.value as TranslationRecord;
        if (Boolean(record.isActive)) {
          map.set(record.chapterUrl, record);
        }
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    } catch (error) {
      reject(error as Error);
    }
  });
};

export const seedChapterSummariesIfEmpty = async (
  deps: SummaryOpsDeps
): Promise<void> => {
  const db = await deps.openDatabase();
  if (!db.objectStoreNames.contains(STORE_NAMES.CHAPTER_SUMMARIES)) return;

  const count = await countStoreRecords(db, STORE_NAMES.CHAPTER_SUMMARIES);
  if (count > 0) return;

  const [chapters, activeTranslations] = await Promise.all([
    getAllChapterRecords(db),
    getActiveTranslationMap(db),
  ]);

  if (chapters.length === 0) return;

  await new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(
        [STORE_NAMES.CHAPTER_SUMMARIES, STORE_NAMES.CHAPTERS],
        'readwrite'
      );
      const summaryStore = tx.objectStore(STORE_NAMES.CHAPTER_SUMMARIES);
      const chaptersStore = tx.objectStore(STORE_NAMES.CHAPTERS);

      for (const chapter of chapters) {
        const { summary, chapterChanged } = buildSummaryRecord(
          chapter,
          activeTranslations.get(chapter.url) || null,
          deps.normalizeUrl
        );
        summaryStore.put(summary);
        if (chapterChanged) {
          chaptersStore.put(chapter);
        }
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (error) {
      reject(error as Error);
    }
  });
};

export interface RecomputeOptions {
  chapterUrl?: string;
  stableId?: string;
}

export const buildSummaryRecord = (
  chapter: ChapterRecord,
  translation: TranslationRecord | null,
  normalizeUrl: (url: string) => string | null
): { summary: ChapterSummaryRecord; chapterChanged: boolean } => {
  let chapterChanged = false;
  let stableId = chapter.stableId;
  if (!stableId) {
    stableId = generateStableChapterId(
      chapter.content || '',
      chapter.chapterNumber || 0,
      chapter.title || ''
    );
    chapter.stableId = stableId;
    chapterChanged = true;
  }

  const canonical =
    chapter.canonicalUrl ||
    normalizeUrl(chapter.originalUrl || chapter.url) ||
    chapter.url;
  if (chapter.canonicalUrl !== canonical) {
    chapter.canonicalUrl = canonical;
    chapterChanged = true;
  }

  const hasImages = Boolean(
    translation?.suggestedIllustrations?.some(
      (ill: any) => !!ill?.url || !!ill?.generatedImage
    )
  );

  const summary: ChapterSummaryRecord = {
    stableId,
    canonicalUrl: canonical || undefined,
    title: chapter.title,
    translatedTitle: translation?.translatedTitle || undefined,
    chapterNumber: chapter.chapterNumber,
    hasTranslation: Boolean(translation),
    hasImages,
    lastAccessed: chapter.lastAccessed,
    lastTranslatedAt: translation?.createdAt,
  };

  return { summary, chapterChanged };
};

export const deleteSummary = async (
  deps: SummaryOpsDeps,
  stableId: string
): Promise<void> => {
  const db = await deps.openDatabase();
  if (!db.objectStoreNames.contains(STORE_NAMES.CHAPTER_SUMMARIES)) return;

  await new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_NAMES.CHAPTER_SUMMARIES], 'readwrite');
      const store = tx.objectStore(STORE_NAMES.CHAPTER_SUMMARIES);
      const req = store.delete(stableId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    } catch (error) {
      reject(error as Error);
    }
  });
};

export const recomputeSummary = async (
  deps: SummaryOpsDeps,
  options: RecomputeOptions
): Promise<void> => {
  const db = await deps.openDatabase();
  if (!db.objectStoreNames.contains(STORE_NAMES.CHAPTER_SUMMARIES)) return;

  const { chapterUrl, stableId } = options;
  let chapter: ChapterRecord | null = null;

  if (chapterUrl) {
    chapter = await deps.getChapter(chapterUrl);
  }
  if (!chapter && stableId) {
    chapter = await deps.getChapterByStableId(stableId);
  }

  if (!chapter) {
    if (stableId) {
      await deleteSummary(deps, stableId);
    }
    return;
  }

  const active = await deps.getActiveTranslation(chapter.url).catch(() => null);
  const { summary, chapterChanged } = buildSummaryRecord(
    chapter,
    active || null,
    deps.normalizeUrl
  );

  await new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(
        [STORE_NAMES.CHAPTER_SUMMARIES, STORE_NAMES.CHAPTERS],
        'readwrite'
      );
      const summaryStore = tx.objectStore(STORE_NAMES.CHAPTER_SUMMARIES);
      summaryStore.put(summary);
      if (chapterChanged) {
        const chaptersStore = tx.objectStore(STORE_NAMES.CHAPTERS);
        chaptersStore.put(chapter);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (error) {
      reject(error as Error);
    }
  });
};

export const fetchChapterSummaries = async (): Promise<ChapterSummaryRecord[]> => {
  const db = await getConnection();
  if (!db.objectStoreNames.contains(STORE_NAMES.CHAPTER_SUMMARIES)) return [];

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORE_NAMES.CHAPTER_SUMMARIES], 'readonly');
      const store = tx.objectStore(STORE_NAMES.CHAPTER_SUMMARIES);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as ChapterSummaryRecord[]) || []);
      req.onerror = () => reject(req.error);
    } catch (error) {
      reject(error as Error);
    }
  });
};

export interface ChapterSummaryDiagnostics {
  totalChapters: number;
  totalSummaries: number;
  chaptersWithSummaries: ChapterRecord[];
  chaptersMissingSummaries: ChapterRecord[];
  orphanedSummaries: ChapterSummaryRecord[];
}

export const getChapterSummaryDiagnostics = async (): Promise<ChapterSummaryDiagnostics> => {
  const [chapters, summaries] = await Promise.all([ChapterOps.getAll(), fetchChapterSummaries()]);

  const summariesByStableId = new Map<string, ChapterSummaryRecord>();
  summaries.forEach(summary => summariesByStableId.set(summary.stableId, summary));

  const chaptersWithSummaries: ChapterRecord[] = [];
  const chaptersMissingSummaries: ChapterRecord[] = [];

  chapters.forEach(chapter => {
    if (chapter.stableId && summariesByStableId.has(chapter.stableId)) {
      chaptersWithSummaries.push(chapter);
    } else {
      chaptersMissingSummaries.push(chapter);
    }
  });

  const chapterStableIds = new Set(
    chapters.map(chapter => chapter.stableId).filter((stableId): stableId is string => Boolean(stableId))
  );

  const orphanedSummaries = summaries.filter(summary => !chapterStableIds.has(summary.stableId));

  return {
    totalChapters: chapters.length,
    totalSummaries: summaries.length,
    chaptersWithSummaries,
    chaptersMissingSummaries,
    orphanedSummaries,
  };
};

export const logSummaryDiagnostics = (diagnostics: ChapterSummaryDiagnostics): void => {
  const {
    totalChapters,
    totalSummaries,
    chaptersWithSummaries,
    chaptersMissingSummaries,
    orphanedSummaries,
  } = diagnostics;

  console.log('[🔍 DIAGNOSTIC] ========== CHAPTERS vs SUMMARIES COMPARISON ==========');
  console.log(`[🔍 DIAGNOSTIC] Total in CHAPTERS store: ${totalChapters}`);
  console.log(`[🔍 DIAGNOSTIC] Total in CHAPTER_SUMMARIES store: ${totalSummaries}`);
  console.log(`[🔍 DIAGNOSTIC] Chapters WITH summaries: ${chaptersWithSummaries.length}`);
  console.log(`[🔍 DIAGNOSTIC] Chapters WITHOUT summaries: ${chaptersMissingSummaries.length}`);

  if (chaptersMissingSummaries.length > 0) {
    console.log('[⚠️ DIAGNOSTIC] ===== MISSING SUMMARIES =====');
    chaptersMissingSummaries.forEach(chapter => {
      console.log(
        `[⚠️ DIAGNOSTIC]   Ch #${chapter.chapterNumber}: "${chapter.title}" (stableId: ${chapter.stableId}, url: ${chapter.url})`
      );
    });
  }

  if (orphanedSummaries.length > 0) {
    console.log('[⚠️ DIAGNOSTIC] ===== ORPHANED SUMMARIES (no matching chapter) =====');
    orphanedSummaries.forEach(summary => {
      console.log(
        `[⚠️ DIAGNOSTIC]   Summary stableId: ${summary.stableId}, Ch #${summary.chapterNumber}: "${summary.title}"`
      );
    });
  }

  console.log('[🔍 DIAGNOSTIC] ===== END COMPARISON =====');
};
