import { fetchAndParseUrl } from '../scraping/fetcher';
import { isUrlSupported } from '../scraping/urlUtils';
import { SettingsOps, ImportOps } from '../db/operations';
import { transformImportedChapters } from '../stableIdService';
import type { Chapter, ImportedChapter } from '../../types';
import { telemetryService } from '../telemetryService';
import { debugLog } from '../../utils/debug';
import { tryServeChapterFromCache } from './hydration';
import { slog, swarn } from './logging';
import type { FetchResult, LibraryFetchScope, StoredNovelMetadata } from './types';
import { getUserMessage } from '../appError';

// In-flight fetch management
const inflightFetches = new Map<string, Promise<void>>();

function normalizeLanguageLabel(lang: string | null | undefined): string | undefined {
  if (!lang) return undefined;
  const normalized = lang.toLowerCase();
  if (normalized === 'en') return 'English';
  if (normalized === 'pli' || normalized === 'pi') return 'Pali';
  return lang;
}

async function applySuttaMetadataFromChapter(chapter: Chapter): Promise<void> {
  const blurb = chapter.blurb?.trim();
  if (!blurb) return;

  const defaultDescription = 'Please provide a description for this novel.';

  try {
    const existing = await SettingsOps.getKey<StoredNovelMetadata>('novelMetadata');
    const existingDesc = existing?.description?.trim() ?? '';
    const hasRealDescription = existingDesc.length > 0 && existingDesc !== defaultDescription;
    if (hasRealDescription) return;

    const today = new Date().toISOString().split('T')[0];
    const sourceLanguage = existing?.originalLanguage ?? chapter.sourceLanguage ?? 'Pali';
    const targetLanguage =
      existing?.targetLanguage ??
      normalizeLanguageLabel(chapter.targetLanguage) ??
      'English';

    const merged: StoredNovelMetadata = {
      ...(existing || {}),
      title: existing?.title ?? chapter.title ?? 'Untitled Novel',
      description: blurb,
      originalLanguage: sourceLanguage,
      targetLanguage,
      chapterCount: existing?.chapterCount ?? 1,
      genres: Array.isArray(existing?.genres) ? existing.genres : [],
      lastUpdated: existing?.lastUpdated ?? today,
    };

    await SettingsOps.set('novelMetadata', merged);
    if (typeof window !== 'undefined') {
      window.localStorage?.setItem('novelMetadata', JSON.stringify(merged));
    }
    debugLog('navigation', 'summary', '[Navigation] Stored SuttaCentral blurb in novel metadata', {
      title: merged.title,
      blurbLength: blurb.length,
    });
  } catch (error) {
    console.error('[Navigation] Failed to persist SuttaCentral metadata', error);
  }
}

export async function handleFetch(
  url: string,
  scope: LibraryFetchScope = {}
): Promise<FetchResult> {
  const telemetryStart = typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
  const telemetryMeta: Record<string, any> = { url };
  const cachedResult = await tryServeChapterFromCache(url, telemetryMeta, scope);
  if (cachedResult) {
    return cachedResult;
  }
  try {
    if (inflightFetches.has(url)) {
      await inflightFetches.get(url);
      telemetryMeta.outcome = 'cache_inflight';
      return {};
    }

    if (!isUrlSupported(url)) {
      telemetryMeta.outcome = 'unsupported_url';
      throw new Error(`Unsupported source: ${url}`);
    }

    const fetchPromise = (async (): Promise<FetchResult> => {
      try {
        slog(`[Fetch] Fetching and parsing URL: ${url}`);
        const chapterData = await fetchAndParseUrl(url, {}, () => {});
        await applySuttaMetadataFromChapter(chapterData);
        slog(`[Fetch] Raw chapter data:`, {
          title: chapterData.title,
          hasContent: !!chapterData.content,
          contentLength: chapterData.content?.length || 0,
          url: chapterData.originalUrl,
          chapterNumber: chapterData.chapterNumber,
          nextUrl: chapterData.nextUrl,
          prevUrl: chapterData.prevUrl
        });

        slog(`[Fetch] Transforming to stable format...`);
        const dataForTransformation: ImportedChapter = {
          sourceUrl: chapterData.originalUrl,
          title: chapterData.title,
          originalContent: chapterData.content,
          nextUrl: chapterData.nextUrl || null,
          prevUrl: chapterData.prevUrl || null,
          translationResult: null,
          feedback: [],
          chapterNumber: chapterData.chapterNumber,
          fanTranslation: chapterData.fanTranslation ?? null,
          suttaStudio: chapterData.suttaStudio ?? null
        };
        const stableData = transformImportedChapters([dataForTransformation], {
          registryNovelId: scope.novelId ?? null,
          libraryVersionId: scope.versionId ?? null,
        });
        slog(`[Fetch] Stable transformation result:`, {
          chaptersCount: stableData.chapters.size,
          currentChapterId: stableData.currentChapterId,
          urlIndexSize: stableData.urlIndex.size,
          rawUrlIndexSize: stableData.rawUrlIndex.size
        });

        if (stableData.currentChapterId) {
          const transformedChapter = stableData.chapters.get(stableData.currentChapterId);
          slog(`[Fetch] Transformed chapter content check:`, {
            chapterId: stableData.currentChapterId,
            title: transformedChapter?.title,
            hasContent: !!transformedChapter?.content,
            contentLength: transformedChapter?.content?.length || 0,
            canonicalUrl: transformedChapter?.canonicalUrl
          });
        }

        // Persist to IndexedDB
        try {
          await ImportOps.importStableSessionData({
            novels: stableData.novels,
            chapters: stableData.chapters,
            urlIndex: stableData.urlIndex,
            rawUrlIndex: stableData.rawUrlIndex,
            currentChapterId: stableData.currentChapterId,
            navigationHistory: [],
          });
        } catch (e) {
          console.warn('[DB] Failed to persist fetched chapter to IndexedDB', e);
        }

        telemetryMeta.outcome = 'success';
        telemetryMeta.chapterId = stableData.currentChapterId || null;
        telemetryMeta.chapterCount = stableData.chapters.size;
        telemetryMeta.contentLength = stableData.currentChapterId
          ? stableData.chapters.get(stableData.currentChapterId)?.content?.length || 0
          : 0;
        debugLog(
          'navigation',
          'summary',
          '[Navigation] handleFetch transformed chapter',
          {
            url,
            currentChapterId: stableData.currentChapterId ?? null,
            hasTranslation: stableData.currentChapterId
              ? Boolean(stableData.chapters.get(stableData.currentChapterId)?.translationResult)
              : null,
          }
        );
        return {
          chapters: stableData.chapters,
          urlIndex: stableData.urlIndex,
          rawUrlIndex: stableData.rawUrlIndex,
          novels: stableData.novels,
          currentChapterId: stableData.currentChapterId,
        };

      } catch (e: any) {
        console.error('[FETCH-ERROR]', e);
        telemetryMeta.outcome = 'error';
        telemetryMeta.error = e?.message ?? String(e);
        return {
          error: getUserMessage(
            e,
            'Could not load that chapter. Please try again later.'
          ),
        };
      }
    })();

    inflightFetches.set(url, fetchPromise.then(() => {}));
    const result = await fetchPromise;
    inflightFetches.delete(url);

    if (!telemetryMeta.outcome) {
      if (result.error) {
        telemetryMeta.outcome = 'error';
        telemetryMeta.error = result.error;
      } else {
        telemetryMeta.outcome = 'success';
        telemetryMeta.chapterId = result.currentChapterId ?? null;
        const chaptersMap = result.chapters ?? null;
        telemetryMeta.chapterCount = chaptersMap instanceof Map ? chaptersMap.size : 0;
        if (chaptersMap instanceof Map && result.currentChapterId) {
          const content = chaptersMap.get(result.currentChapterId)?.content || '';
          telemetryMeta.contentLength = content.length;
        }
      }
    }
    debugLog(
      'navigation',
      'summary',
      '[Navigation] handleFetch final result',
      {
        url,
        chapterId: result.currentChapterId ?? null,
        chapterCount: result.chapters instanceof Map ? result.chapters.size : 0,
        hasTranslation:
          result.currentChapterId && result.chapters instanceof Map
            ? Boolean(result.chapters.get(result.currentChapterId)?.translationResult)
            : null,
        hadError: Boolean(result.error),
      }
    );
    return result;
  } catch (error) {
    telemetryMeta.outcome = 'error';
    telemetryMeta.error = error instanceof Error ? error.message : String(error);
    telemetryMeta.stack = error instanceof Error ? error.stack : undefined;
    throw error;
  } finally {
    const telemetryEnd = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
    telemetryService.capturePerformance(
      'ux:navigation:handleFetch',
      telemetryEnd - telemetryStart,
      telemetryMeta
    );
  }
}
