import { ChapterOps, TranslationOps, DiffOps } from '../db/operations';
import { getRepoForService } from '../db/index';
import { normalizeUrlAggressively } from '../stableIdService';
import type { EnhancedChapter } from '../stableIdService';
import type { TranslationSettingsSnapshot } from '../../types';
import { memoryDetail, memoryTimestamp, memoryTiming } from '../../utils/memoryDiagnostics';
import { telemetryService } from '../telemetryService';
import { debugLog } from '../../utils/debug';
import { computeDiffHash } from '../diff/hash';
import { DIFF_ALGO_VERSION } from '../diff/constants';
import { adaptTranslationRecordToResult } from './converters';
import { slog, swarn } from './logging';
import type { FetchResult } from './types';

export async function loadChapterFromIDB(
  chapterId: string,
  updateHydratingState: (chapterId: string, hydrating: boolean) => void
): Promise<EnhancedChapter | null> {
  const opStart = memoryTimestamp();
  memoryDetail('Chapter hydration requested', { chapterId });
  slog(`[IDB] Loading chapter from IndexedDB: ${chapterId}`);

  // Mark as hydrating
  updateHydratingState(chapterId, true);
  const complete = (outcome: string, extra: Record<string, unknown>, result: EnhancedChapter | null) => {
    const durationMs = memoryTiming('Chapter hydration', opStart, {
      chapterId,
      outcome,
      ...extra,
    });
    telemetryService.capturePerformance('ux:navigation:hydrateChapter', durationMs, {
      chapterId,
      outcome,
      ...extra,
    });
    return result;
  };

  try {
    const rec = await ChapterOps.getByStableId(chapterId);
    slog(`[IDB] Retrieved record:`, {
      exists: !!rec,
      title: rec?.title,
      hasContent: !!rec?.content,
      contentLength: rec?.content?.length || 0,
      hasFanTranslation: !!rec?.fanTranslation,
      fanTranslationLength: rec?.fanTranslation?.length || 0,
      hasSuttaStudio: !!rec?.suttaStudio,
      url: rec?.url,
      canonicalUrl: rec?.canonicalUrl,
      originalUrl: rec?.originalUrl,
      chapterNumber: rec?.chapterNumber,
      nextUrl: rec?.nextUrl,
      prevUrl: rec?.prevUrl
    });

    // Log fan translation status specifically
    if (rec.fanTranslation) {
      // console.log(`[IDB] ✅ Fan translation found in DB: ${rec.fanTranslation.length} characters`);
    } else {
      console.log(`[IDB] ❌ No fan translation in DB for chapter: ${rec.title}`);
    }

    if (!rec) {
      swarn(`[IDB] No record found for ${chapterId}`);
      memoryDetail('Chapter hydration missing record', { chapterId });
      return complete('missing_record', {}, null);
    }

    // Transform IndexedDB record to EnhancedChapter format
    const enhanced: EnhancedChapter = {
      id: chapterId,
      title: rec.title || 'Untitled Chapter',
      content: rec.content || '',
      originalUrl: rec.originalUrl || rec.url || '',
      canonicalUrl: rec.canonicalUrl || rec.url || '',
      nextUrl: rec.nextUrl,
      prevUrl: rec.prevUrl,
      chapterNumber: rec.chapterNumber || 0,
      sourceUrls: [rec.url || ''],
      importSource: {
        originalUrl: rec.originalUrl || rec.url || '',
        importDate: new Date(rec.dateAdded || Date.now()),
        sourceFormat: 'json'
      },
      fanTranslation: rec.fanTranslation || null,
      suttaStudio: rec.suttaStudio ?? null,
      translationResult: null,
    };

    memoryDetail('Chapter hydration record stats', {
      chapterId,
      contentLength: enhanced.content.length,
      hasTranslation: Boolean(enhanced.translationResult),
      hasFanTranslation: Boolean(enhanced.fanTranslation),
      chapterNumber: enhanced.chapterNumber,
    });

    // Load active translation if available (ensure fixes legacy data without isActive flag)
    try {
      console.log(`🔍 [TranslationLoad] Starting load for chapter: ${chapterId}`);
      console.log(`🔍 [TranslationLoad] Chapter URL: ${rec.url}, Canonical: ${rec.canonicalUrl}`);

      const activeTranslation = await TranslationOps.ensureActiveByStableId(chapterId);

      if (activeTranslation) {
        console.log(`✅ [TranslationLoad] Active translation found for ${chapterId}:`, {
          translationId: activeTranslation.id,
          version: activeTranslation.version,
          isActive: activeTranslation.isActive,
          translationLength: activeTranslation.translation?.length || 0,
          provider: activeTranslation.provider,
          model: activeTranslation.model,
          createdAt: activeTranslation.createdAt,
          chapterUrl: activeTranslation.chapterUrl,
          stableId: activeTranslation.stableId
        });

        enhanced.translationResult = adaptTranslationRecordToResult(chapterId, activeTranslation);
        enhanced.translationSettingsSnapshot = (activeTranslation.settingsSnapshot ??
          null) as TranslationSettingsSnapshot | null;
        console.log(`✅ [TranslationLoad] Translation adapted to result format`);
        debugLog(
          'navigation',
          'summary',
          '[Navigation] IDB hydration loaded active translation',
          {
            chapterId,
            provider: activeTranslation.provider,
            model: activeTranslation.model,
            version: activeTranslation.version,
          }
        );

        try {
          if (typeof window !== 'undefined' && enhanced.translationResult?.translation) {
            const aiTranslationId = (enhanced.translationResult as any)?.id || activeTranslation.id || null;
            const aiTranslation = enhanced.translationResult.translation || '';
            const rawText = enhanced.content || '';
            const fanText = enhanced.fanTranslation || null;

            const aiHash = computeDiffHash(aiTranslation);
            const rawHash = computeDiffHash(rawText);
            const fanHash = fanText ? computeDiffHash(fanText) : null;
            let cachedDiff = null;

            if (aiTranslationId) {
              cachedDiff = await DiffOps.get({
                chapterId,
                aiVersionId: aiTranslationId,
                fanVersionId: null,
                rawVersionId: rawHash,
                algoVersion: DIFF_ALGO_VERSION,
              });
            }

            if (!cachedDiff) {
              cachedDiff = await DiffOps.findByHashes(
                chapterId,
                aiHash,
                fanHash,
                rawHash,
                DIFF_ALGO_VERSION
              );
            }

            if (cachedDiff) {
              debugLog('diff', 'summary', '[DiffCache] Hydration cache hit', {
                chapterId,
                aiTranslationId,
                aiHash,
                algoVersion: DIFF_ALGO_VERSION,
              });
              window.dispatchEvent(new CustomEvent('diff:updated', {
                detail: { chapterId, cacheHit: true }
              }));
            }
          }
        } catch (diffError) {
          console.warn('[DiffCache] Failed to hydrate diff markers from cache:', diffError);
        }
      } else {
        console.warn(`❌ [TranslationLoad] No active translation found for ${chapterId}`);
        console.warn(`❌ [TranslationLoad] This chapter will appear untranslated and may trigger auto-translate`);
        debugLog(
          'navigation',
          'summary',
          '[Navigation] No active translation found during hydration',
          { chapterId }
        );
      }
    } catch (error) {
      console.error(`🚨 [TranslationLoad] FAILED to load active translation for ${chapterId}:`, error);
      console.error(`🚨 [TranslationLoad] Error details:`, {
        message: (error as Error)?.message || error,
        stack: (error as Error)?.stack
      });
      memoryDetail('Chapter hydration translation load failed', {
        chapterId,
        error: (error as Error)?.message || error,
      });
    }

    slog(`[IDB] Successfully loaded chapter ${chapterId} with translation: ${!!enhanced.translationResult}`);
    return complete('success', {
      contentLength: enhanced.content.length,
      hasTranslation: Boolean(enhanced.translationResult),
    }, enhanced);

  } catch (error) {
    console.error(`[IDB] Error loading chapter ${chapterId}:`, error);
    memoryDetail('Chapter hydration threw', {
      chapterId,
      error: (error as Error)?.message || error,
    });
    return complete('error', {
      error: error instanceof Error ? error.message : String(error),
    }, null);
  } finally {
    // Clear hydrating state
    updateHydratingState(chapterId, false);
  }
}

export async function tryServeChapterFromCache(
  url: string,
  telemetryMeta: Record<string, any>
): Promise<FetchResult | null> {
  try {
    const repo = getRepoForService('navigationService');
    const normalized = normalizeUrlAggressively(url);
    const mapping =
      (normalized ? await repo.getUrlMappingForUrl(normalized) : null) ||
      (await repo.getUrlMappingForUrl(url));

    if (!mapping?.stableId) {
      return null;
    }

    const noopHydration = (_chapterId: string, _hydrating: boolean) => {};
    const chapter = await loadChapterFromIDB(mapping.stableId, noopHydration);

    if (!chapter) {
      return null;
    }

    const chapters = new Map<string, EnhancedChapter>([
      [mapping.stableId, chapter],
    ]);
    const urlIndex = new Map<string, string>();
    if (normalized) {
      urlIndex.set(normalized, mapping.stableId);
    }
    const canonicalNormalized = chapter.canonicalUrl
      ? normalizeUrlAggressively(chapter.canonicalUrl)
      : null;
    if (canonicalNormalized) {
      urlIndex.set(canonicalNormalized, mapping.stableId);
    }
    const rawUrlIndex = new Map<string, string>([[url, mapping.stableId]]);

    telemetryMeta.outcome = 'cache_hit';
    telemetryMeta.chapterId = mapping.stableId;
    telemetryMeta.cacheSource = 'url_mapping';
    debugLog(
      'navigation',
      'summary',
      '[Navigation] handleFetch short-circuited via IndexedDB cache',
      { url, chapterId: mapping.stableId }
    );

    return {
      chapters,
      urlIndex,
      rawUrlIndex,
      currentChapterId: mapping.stableId,
    };
  } catch (error) {
    swarn('[Navigation] Cache short-circuit failed, falling back to fetch', error);
    return null;
  }
}
