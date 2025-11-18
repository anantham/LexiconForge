import type { ChapterRecord, TranslationRecord } from '../types';
import { generateStableChapterId } from '../../stableIdService';
import { telemetryService } from '../../telemetryService';
import {
  memoryDetail,
  memorySummary,
  memoryTimestamp,
  memoryTiming,
} from '../../../utils/memoryDiagnostics';
import { debugPipelineEnabled } from '../../../utils/debug';
import { getConnection } from '../core/connection';
import { TranslationOps } from './translations';

const dblog = (...args: any[]) => {
  if (debugPipelineEnabled('indexeddb', 'summary')) {
    console.log('[IndexedDB]', ...args);
  }
};

const dblogFull = (...args: any[]) => {
  if (debugPipelineEnabled('indexeddb', 'full')) {
    console.log('[IndexedDB][FULL]', ...args);
  }
};

export interface RenderingOpsDeps {
  openDatabase: () => Promise<IDBDatabase>;
  getActiveTranslation: (
    chapterUrl: string
  ) => Promise<TranslationRecord | null>;
}

export interface ChapterRenderingRecord {
  stableId: string;
  id: string;
  url: string;
  canonicalUrl: string;
  originalUrl: string;
  sourceUrls: string[];
  title: string;
  content: string;
  nextUrl: string | null;
  prevUrl: string | null;
  chapterNumber: number;
  fanTranslation: string | null;
  translationResult: TranslationRecord | null;
  data: {
    chapter: {
      title: string;
      content: string;
      originalUrl: string;
      nextUrl: string | null;
      prevUrl: string | null;
      chapterNumber: number;
      fanTranslation: string | null;
    };
    translationResult: TranslationRecord | null;
  };
}

export const getChaptersForReactRendering = async (
  deps: RenderingOpsDeps
): Promise<ChapterRenderingRecord[]> => {
  try {
    const opStart = memoryTimestamp();
    memorySummary('IndexedDB getChaptersForReactRendering started');
    dblogFull('[INDEXEDDB-DEBUG] getChaptersForReactRendering() called');

    const db = await deps.openDatabase();
    dblogFull('[INDEXEDDB-DEBUG] Database opened successfully');

    const transaction = db.transaction(['chapters'], 'readonly');
    const store = transaction.objectStore('chapters');
    dblogFull('[INDEXEDDB-DEBUG] Transaction and store created');

    return await new Promise<ChapterRenderingRecord[]>((resolve, reject) => {
      const request = store.getAll();
      dblogFull('[INDEXEDDB-DEBUG] getAll() request created');

      request.onsuccess = async () => {
        const chapters = request.result as ChapterRecord[];

        if (chapters.length === 0) {
          memorySummary('IndexedDB chapter fetch returned empty result');
        } else {
          memoryDetail('IndexedDB chapter fetch preview', {
            total: chapters.length,
            sample: chapters.slice(0, 3).map(ch => ({
              url: ch.url,
              title: ch.title,
              contentLength: ch.content?.length || 0,
              hasStableId: Boolean(ch.stableId),
            })),
          });
        }

        dblogFull('[INDEXEDDB-DEBUG] Raw chapters from IndexedDB:', {
          chaptersCount: chapters.length,
          chaptersData: chapters.map((ch, idx) => ({
            index: idx,
            url: ch.url,
            title: ch.title,
            hasContent: !!ch.content,
            contentLength: ch.content?.length || 0,
            chapterNumber: ch.chapterNumber,
            hasNextUrl: !!ch.nextUrl,
            hasPrevUrl: !!ch.prevUrl,
            hasStableId: !!ch.stableId,
            allFields: Object.keys(ch),
          })),
        });

        const chaptersWithStableIds = await Promise.all(
          chapters.map(async chapter => {
            const stableId =
              chapter.stableId ||
              generateStableChapterId(
                chapter.content,
                chapter.chapterNumber || 0,
                chapter.title
              );

            let translationResult: TranslationRecord | null = null;
            try {
              translationResult = await deps.getActiveTranslation(chapter.url);
            } catch (error) {
              dblog(
                '[IndexedDB] Failed to load translation for chapter:',
                chapter.url,
                error
              );
            }

            const canonicalUrl = chapter.canonicalUrl || chapter.url;
            const originalUrl = chapter.originalUrl || chapter.url;
            const nextUrl = chapter.nextUrl ?? null;
            const prevUrl = chapter.prevUrl ?? null;
            const fanTranslation = chapter.fanTranslation ?? null;

            return {
              stableId,
              id: stableId,
              url: chapter.url,
              canonicalUrl,
              originalUrl,
              sourceUrls: Array.from(
                new Set(
                  [chapter.url, canonicalUrl, originalUrl].filter(
                    Boolean
                  ) as string[]
                )
              ),
              title: chapter.title,
              content: chapter.content,
              nextUrl,
              prevUrl,
              chapterNumber: chapter.chapterNumber || 0,
              fanTranslation,
              translationResult,
              data: {
                chapter: {
                  title: chapter.title,
                  content: chapter.content,
                  originalUrl,
                  nextUrl,
                  prevUrl,
                  chapterNumber: chapter.chapterNumber,
                  fanTranslation,
                },
                translationResult,
              },
            };
          })
        );

        chaptersWithStableIds.sort(
          (a, b) => a.chapterNumber - b.chapterNumber
        );

        dblog(
          '[IndexedDB] getChaptersForReactRendering:',
          chaptersWithStableIds.length,
          'chapters with translations loaded'
        );
        const durationMs = memoryTiming(
          'IndexedDB getChaptersForReactRendering',
          opStart,
          {
            rawCount: chapters.length,
            processedCount: chaptersWithStableIds.length,
          }
        );
        telemetryService.capturePerformance(
          'ux:indexeddb:getChaptersForReactRendering',
          durationMs,
          {
            rawCount: chapters.length,
            processedCount: chaptersWithStableIds.length,
          }
        );
        resolve(chaptersWithStableIds);
      };

      request.onerror = () => {
        console.error('[INDEXEDDB-DEBUG] getAll() request failed:', request.error);
        memorySummary('IndexedDB getChaptersForReactRendering failed', {
          error: request.error?.message || request.error,
        });
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Failed to get chapters for rendering:', error);
    console.error(
      '[INDEXEDDB-DEBUG] getChaptersForReactRendering() failed with error:',
      error
    );
    memorySummary('IndexedDB getChaptersForReactRendering threw', {
      error: (error as Error)?.message || error,
    });
    return [];
  }
};

export const fetchChaptersForReactRendering = (): Promise<ChapterRenderingRecord[]> => {
  return getChaptersForReactRendering({
    openDatabase: () => getConnection(),
    getActiveTranslation: (chapterUrl: string) => TranslationOps.getActiveByUrl(chapterUrl),
  });
};
