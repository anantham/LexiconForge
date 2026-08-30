/**
 * NavigationService - Facade orchestrating all navigation concerns.
 *
 * Extracted concerns live in:
 *   types.ts       — shared interfaces
 *   converters.ts  — DB record → runtime DTO mapping
 *   validation.ts  — URL validation & error messages
 *   hydration.ts   — IndexedDB loading (loadChapterFromIDB, tryServeChapterFromCache)
 *   fetcher.ts     — Network fetch + IDB persistence (handleFetch)
 *   history.ts     — Browser history management
 */

import { isUrlSupported } from '../scraping/urlUtils';
import { getRepoForService } from '../db/index';
import { normalizeUrlAggressively } from '../stableIdService';
import type { EnhancedChapter } from '../stableIdService';
import type { TranslationSettingsSnapshot } from '../../types';
import { ChapterOps, TranslationOps, SettingsOps, NavigationOps } from '../db/operations';
import { telemetryService } from '../telemetryService';
import { parseInternalChapterUrl } from '../chapterCatalog';
import { debugLog, debugWarn } from '../../utils/debug';
import { adaptTranslationRecordToResult } from './converters';
import { validateNavigation } from './validation';
import { loadChapterFromIDB, tryServeChapterFromCache } from './hydration';
import { handleFetch } from './fetcher';
import { updateBrowserHistory, type ReaderHistoryOptions } from './history';
import { slog, swarn } from './logging';
import type { NavigationContext, NavigationResult, FetchResult, LibraryFetchScope } from './types';

export type { NavigationContext, NavigationResult, FetchResult };

export class NavigationService {

  /**
   * Main navigation handler - resolves URL to chapter and updates navigation state
   */
  static async handleNavigate(
    url: string,
    context: NavigationContext,
    loadChapterFromIDBCallback: (chapterId: string) => Promise<EnhancedChapter | null>
  ): Promise<NavigationResult> {
    const telemetryStart = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
    const telemetryMeta: Record<string, any> = { url };
    try {
      const { urlIndex, rawUrlIndex, chapters, navigationHistory, scope } = context;
      const normalizedUrl = normalizeUrlAggressively(url);
      telemetryMeta.normalizedUrl = normalizedUrl || null;
      telemetryMeta.novelId = scope?.novelId ?? null;
      telemetryMeta.versionId = scope?.versionId ?? null;
      debugLog(
        'navigation',
        'summary',
        '[Navigation] handleNavigate entry',
        {
          url,
          normalizedUrl,
          urlIndexHas: normalizedUrl ? urlIndex.has(normalizedUrl) : false,
          rawUrlIndexHas: rawUrlIndex.has(url),
          chaptersInMemory: chapters.size,
          navigationHistoryLength: navigationHistory.length,
        }
      );

      const internalTarget = parseInternalChapterUrl(url);
      const usesInternalScheme = /^lexiconforge:/i.test(url);

      if (usesInternalScheme && !internalTarget) {
        const errorMessage =
          'Malformed internal chapter URL. Expected ' +
          'lexiconforge://<novel-id>/chapter/<positive-number> without query parameters or fragments.';
        console.error(`[Navigate] ${errorMessage}`, { url });
        telemetryMeta.outcome = 'invalid_internal_url';
        telemetryMeta.reason = 'strict_internal_parser_rejected';
        return { error: errorMessage, errorCode: 'invalid_internal_url' };
      }

      let chapterId = urlIndex.get(normalizedUrl || '') || rawUrlIndex.get(url);

      // A manually imported session has no registry scope: its rows keep
      // novelId=null even when the session's exact URL uses our internal
      // scheme. In that mode the URL indexes are the authoritative identity.
      // Scoped library sessions still resolve by novel/version/number so an
      // index entry can never cross the active library boundary.
      if (internalTarget && (scope?.novelId || !chapterId)) {
        const activeNovelId = scope?.novelId ?? null;
        if (activeNovelId && activeNovelId !== internalTarget.novelId) {
          const errorMessage =
            `Navigation blocked: chapter link belongs to "${internalTarget.novelId}", ` +
            `but the active novel is "${activeNovelId}".`;
          console.error(`[Navigate] ${errorMessage}`, {
            url,
            activeNovelId,
            targetNovelId: internalTarget.novelId,
          });
          telemetryMeta.outcome = 'scope_mismatch';
          telemetryMeta.reason = 'internal_novel_mismatch';
          return { error: errorMessage, errorCode: 'scope_mismatch' };
        }

        const lookupNovelId = activeNovelId ?? internalTarget.novelId;
        const lookupVersionId = activeNovelId ? scope?.versionId ?? null : null;
        const inMemoryMatch = Array.from(chapters.entries()).find(([, chapter]) => {
          return (
            chapter.chapterNumber === internalTarget.chapterNumber &&
            (chapter.novelId ?? null) === lookupNovelId &&
            (chapter.libraryVersionId ?? null) === lookupVersionId
          );
        });

        if (inMemoryMatch) {
          chapterId = inMemoryMatch[0];
        } else {
          const found = await ChapterOps.findByNumber(
            internalTarget.chapterNumber,
            lookupNovelId,
            lookupVersionId
          );
          if (found?.stableId) {
            const loaded = await loadChapterFromIDBCallback(found.stableId);
            if (loaded) {
              const newHistory = [...new Set(navigationHistory.concat(found.stableId))];
              NavigationOps.persistHistory({ stableIds: newHistory });
              NavigationOps.persistLastActiveChapter({
                id: found.stableId,
                url: loaded.canonicalUrl,
              });
              telemetryMeta.outcome = 'idb_hydrated_via_chapter_number';
              telemetryMeta.chapterId = found.stableId;
              telemetryMeta.hydratedTranslation = Boolean(loaded.translationResult);
              return {
                chapterId: found.stableId,
                chapter: loaded,
                shouldUpdateBrowserHistory: true,
                navigationHistory: newHistory,
              };
            }
          }

          const versionLabel = lookupVersionId ? ` version "${lookupVersionId}"` : ' this version';
          const errorMessage =
            `Chapter ${internalTarget.chapterNumber} is listed for ${lookupNovelId}, but it is not cached yet for${versionLabel}. ` +
            'Return to the Library and reopen this version to resume importing its chapters.';
          console.warn(`[Navigate] ${errorMessage}`, {
            url,
            novelId: lookupNovelId,
            versionId: lookupVersionId,
            chapterNumber: internalTarget.chapterNumber,
          });
          telemetryMeta.outcome = 'chapter_not_cached';
          telemetryMeta.reason = 'internal_chapter_number_miss';
          return { error: errorMessage, errorCode: 'chapter_not_cached' };
        }
      }

      const tryScopedLookup = async (): Promise<NavigationResult | null> => {
        if (!scope?.novelId) {
          return null;
        }

        const found = await ChapterOps.findBySourceUrl(url, scope.novelId, scope.versionId ?? null);
        if (!found?.stableId) {
          return null;
        }

        const loaded = await loadChapterFromIDBCallback(found.stableId);
        if (!loaded) {
          return null;
        }

        const newHistory = [...new Set(navigationHistory.concat(found.stableId))];
        return {
          chapterId: found.stableId,
          chapter: loaded,
          shouldUpdateBrowserHistory: true,
          navigationHistory: newHistory,
        };
      };

      if (chapterId) {
        const hasChapter = chapters.has(chapterId);
        const chapter = chapters.get(chapterId);
        if (NavigationService._storeDebugEnabled()) {
          debugLog('navigation', 'full', `[Nav] Chapter ${chapterId} status`, {
            inMemory: hasChapter,
            hasContent: !!chapter?.content,
            contentLength: chapter?.content?.length || 0,
            hasTranslation: !!chapter?.translationResult,
            title: chapter?.title
          });
        }
      }

      // Chapter is already loaded in memory
      if (chapterId && chapters.has(chapterId)) {
        const newHistory = [...new Set(navigationHistory.concat(chapterId))];
        if (NavigationService._storeDebugEnabled()) {
          debugLog('navigation', 'full', `[Nav] Navigation history update`, {
            before: navigationHistory,
            after: newHistory,
            currentChapter: chapterId
          });
        }

        // Persist navigation state (NavigationOps owns these keys and logs failures)
        NavigationOps.persistHistory({ stableIds: newHistory });
        NavigationOps.persistLastActiveChapter({
          id: chapterId,
          url: chapters.get(chapterId)?.canonicalUrl || url,
        });

        slog(`[Navigate] Found existing chapter ${chapterId} for URL ${url}.`);

        const chapter = chapters.get(chapterId);

        // Hydrate translation result if missing
        if (chapter && !chapter.translationResult) {
          debugLog('navigation', 'summary', `[Navigation] Chapter ${chapterId} in memory but missing translationResult, attempting hydration`);
          try {
            const active = await TranslationOps.getActiveByStableId(chapterId);
            if (active) {
              debugLog('navigation', 'full', `[Navigation] Found active translation in IDB, hydrating`, {
                provider: active.provider,
                model: active.model,
                cost: active.estimatedCost,
                hasId: !!active.id,
                version: active.version
              });
              const hydrated = adaptTranslationRecordToResult(chapterId, active);
              if (hydrated) {
                chapter.translationResult = hydrated as any;
                const activeSnapshot = (active.settingsSnapshot ??
                  null) as TranslationSettingsSnapshot | null;
                chapter.translationSettingsSnapshot =
                  activeSnapshot ?? chapter.translationSettingsSnapshot ?? undefined;
                debugLog('navigation', 'summary', `[Navigation] Hydration successful`);
              } else {
                debugWarn('navigation', 'summary', `[Navigation] Hydration returned null`);
              }
            } else {
              debugLog('navigation', 'summary', `[Navigation] No active translation found in IDB for ${chapterId}`);
            }
          } catch (err) {
            console.error(`❌ [Navigation] Hydration error @${Date.now()}:`, err);
          }
        } else if (chapter && chapter.translationResult) {
          debugLog('navigation', 'full', `[Navigation] Chapter ${chapterId} already has translationResult in memory`, {
            provider: chapter.translationResult.usageMetrics?.provider,
            model: chapter.translationResult.usageMetrics?.model,
            cost: chapter.translationResult.usageMetrics?.estimatedCost
          });
        }

        telemetryMeta.outcome = 'memory_hit';
        telemetryMeta.chapterId = chapterId;
        telemetryMeta.hydratedTranslation = Boolean(chapter?.translationResult);
        debugLog(
          'navigation',
          'summary',
          '[Navigation] Returning chapter from memory',
          { chapterId, hasTranslation: Boolean(chapter?.translationResult) }
        );
        return {
          chapterId,
          chapter,
          shouldUpdateBrowserHistory: true,
          navigationHistory: newHistory
        };
      }

      // Chapter mapping exists but content not in memory - lazy load
      if (chapterId && !chapters.has(chapterId)) {
        try {
          const loaded = await loadChapterFromIDBCallback(chapterId);
          if (NavigationService._storeDebugEnabled()) {
            debugLog('navigation', 'full', `[Nav] Lazy load result`, {
              success: !!loaded,
              chapterId,
              title: loaded?.title,
              hasContent: !!loaded?.content,
              contentLength: loaded?.content?.length || 0
            });
          }

          if (loaded) {
            const newHistory = [...new Set(navigationHistory.concat(chapterId))];
            if (NavigationService._storeDebugEnabled()) {
              debugLog('navigation', 'full', `[Nav] Post-lazy-load navigation history`, {
                before: navigationHistory,
                after: newHistory,
                currentChapter: chapterId
              });
            }

            // Persist navigation state (NavigationOps owns these keys and logs failures)
            NavigationOps.persistHistory({ stableIds: newHistory });
            NavigationOps.persistLastActiveChapter({ id: chapterId, url: loaded.canonicalUrl });

            slog(`[Navigate] Hydrated chapter ${chapterId} from IndexedDB.`);
            telemetryMeta.outcome = 'idb_hydrated';
            telemetryMeta.chapterId = chapterId;
            telemetryMeta.hydratedTranslation = Boolean(loaded.translationResult);
            debugLog(
              'navigation',
              'summary',
              '[Navigation] Hydrated chapter from IndexedDB',
              { chapterId, hasTranslation: Boolean(loaded.translationResult) }
            );
            return {
              chapterId,
              chapter: loaded,
              shouldUpdateBrowserHistory: true,
              navigationHistory: newHistory
            };
          }
        } catch (e) {
          console.error('[Navigate] Failed to hydrate chapter from IndexedDB', e);
        }

        // Lazy load failed - try URL mapping in IndexedDB before fetching
        try {
          const scoped = await tryScopedLookup();
          if (scoped) {
            telemetryMeta.outcome = 'idb_hydrated_via_scope';
            telemetryMeta.chapterId = scoped.chapterId ?? null;
            telemetryMeta.hydratedTranslation = Boolean(scoped.chapter?.translationResult);
            return scoped;
          }

          if (!scope?.novelId) {
            const norm = normalizedUrl;
            const repo = getRepoForService();
            const mapping = (norm ? await repo.getUrlMappingForUrl(norm) : null) ||
                            await repo.getUrlMappingForUrl(url);
            if (mapping?.stableId) {
              debugLog('navigation', 'summary', '[Navigate] Found URL mapping in IndexedDB. Hydrating chapter instead of fetching.');
              const loaded = await loadChapterFromIDBCallback(mapping.stableId);
              if (loaded) {
                const newHistory = [...new Set(navigationHistory.concat(mapping.stableId))];
                telemetryMeta.outcome = 'idb_hydrated_via_mapping';
                telemetryMeta.chapterId = mapping.stableId;
                telemetryMeta.hydratedTranslation = Boolean(loaded.translationResult);
                debugLog(
                  'navigation',
                  'summary',
                  '[Navigation] Hydrated via mapping from IndexedDB',
                  { chapterId: mapping.stableId, hasTranslation: Boolean(loaded.translationResult) }
                );
                return {
                  chapterId: mapping.stableId,
                  chapter: loaded,
                  shouldUpdateBrowserHistory: true,
                  navigationHistory: newHistory
                };
              }
            }
          }
        } catch (e) {
          swarn('[Navigate] IDB mapping lookup failed, proceeding to fetch if supported', e);
        }

        // Try to fetch if supported URL
        if (isUrlSupported(url)) {
          slog(`[Navigate] Hydration failed; attempting fetch for ${url}...`);
          debugLog(
            'navigation',
            'summary',
            '[Navigation] Hydration failed, requesting fetch',
            { url, normalizedUrl, chapterIdHint: chapterId ?? null }
          );
          telemetryMeta.outcome = 'fetch_required_after_hydration';
          telemetryMeta.chapterId = chapterId;
          return { error: null }; // Signal that caller should handle fetch
        } else {
          const validation = validateNavigation(url);
          if ('error' in validation) {
            console.error(`[Navigate] ${validation.error}`, { url });
            telemetryMeta.outcome = 'unsupported_url';
            telemetryMeta.reason = validation.error;
            return { error: validation.error };
          }
          const errorMessage = `Navigation failed: The URL is not from a supported source and the chapter has not been imported.`;
          console.error(`[Navigate] ${errorMessage}`, { url });
          telemetryMeta.outcome = 'unsupported_url';
          telemetryMeta.reason = 'no_mapping';
          return { error: errorMessage };
        }
      }

      // No chapter mapping found
      const scoped = await tryScopedLookup();
      if (scoped) {
        telemetryMeta.outcome = 'idb_hydrated_via_scope';
        telemetryMeta.chapterId = scoped.chapterId ?? null;
        telemetryMeta.hydratedTranslation = Boolean(scoped.chapter?.translationResult);
        return scoped;
      }

      if (isUrlSupported(url)) {
        slog(`[Navigate] No chapter found for ${url}. Attempting to fetch...`);
        debugLog(
          'navigation',
          'summary',
          '[Navigation] No chapter mapping found; requesting fetch',
          { url, normalizedUrl }
        );
        telemetryMeta.outcome = 'fetch_required';
        return { error: null }; // Signal that caller should handle fetch
      } else {
        // Try direct IndexedDB lookup as last resort
        try {
          if (scope?.novelId) {
            const errorMessage = `Navigation failed: The URL is not from a supported source and the chapter has not been imported for this version.`;
            console.error(`[Navigate] ${errorMessage}`, {
              url,
              novelId: scope.novelId,
              versionId: scope.versionId ?? null,
            });
            telemetryMeta.outcome = 'unsupported_url';
            telemetryMeta.reason = 'no_scoped_match';
            return { error: errorMessage };
          }

          const repo = getRepoForService();
          const found = await repo.findChapterByUrl(url);
          if (found?.stableId) {
            const chapterIdFound = found.stableId;
            const c = found.data?.chapter;
            const canonicalUrl = found.canonicalUrl || c?.originalUrl || url;

            const adaptedTranslation = adaptTranslationRecordToResult(chapterIdFound, found.data?.translationResult);

            const snapshot = (
              (found.data?.translationResult as any)?.translationSettingsSnapshot ??
              (found.data?.translationResult as any)?.settingsSnapshot ??
              null
            ) as TranslationSettingsSnapshot | null;

            const enhanced: EnhancedChapter = {
              id: chapterIdFound,
              novelId: found.novelId ?? null,
              libraryVersionId: found.libraryVersionId ?? null,
              title: c?.title || 'Untitled Chapter',
              content: c?.content || '',
              originalUrl: canonicalUrl,
              canonicalUrl,
              nextUrl: c?.nextUrl,
              prevUrl: c?.prevUrl,
              chapterNumber: c?.chapterNumber || 0,
              sourceUrls: [c?.originalUrl || canonicalUrl].filter(
                (u): u is string => typeof u === 'string' && u.length > 0
              ),
              importSource: {
                originalUrl: c?.originalUrl || canonicalUrl,
                importDate: new Date(),
                sourceFormat: 'json'
              },
              translationResult: adaptedTranslation,
              translationSettingsSnapshot: snapshot,
            } as EnhancedChapter;

            const newHistory = [...new Set(navigationHistory.concat(chapterIdFound))];

            // Persist navigation state (NavigationOps owns these keys and logs failures)
            NavigationOps.persistLastActiveChapter({ id: chapterIdFound, url: canonicalUrl });
            NavigationOps.persistHistory({ stableIds: newHistory });

            slog(`[Navigate] Found chapter directly in IndexedDB for URL ${url}.`);
            telemetryMeta.outcome = 'idb_direct_lookup';
            telemetryMeta.chapterId = chapterIdFound;
            telemetryMeta.hydratedTranslation = Boolean(enhanced.translationResult);
            return {
              chapterId: chapterIdFound,
              chapter: enhanced,
              shouldUpdateBrowserHistory: true,
              navigationHistory: newHistory
            };
          }
        } catch (e) {
          swarn('[Navigate] IndexedDB direct lookup failed', e);
        }

        const validation = validateNavigation(url);
        if ('error' in validation) {
          console.error(`[Navigate] ${validation.error}`, { url });
          telemetryMeta.outcome = 'unsupported_url';
          telemetryMeta.reason = validation.error;
          return { error: validation.error };
        }
        const errorMessage = `Navigation failed: The URL is not from a supported source and the chapter has not been imported.`;
        console.error(`[Navigate] ${errorMessage}`, { url });
        telemetryMeta.outcome = 'unsupported_url';
        telemetryMeta.reason = 'no_mapping';
        return { error: errorMessage };
      }
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
        'ux:navigation:handleNavigate',
        telemetryEnd - telemetryStart,
        telemetryMeta
      );
    }
  }

  /** Fetch and parse a new chapter from URL */
  static async handleFetch(url: string, scope: LibraryFetchScope = {}): Promise<FetchResult> {
    return handleFetch(url, scope);
  }

  /** Lazy load chapter from IndexedDB with hydration state management */
  static async loadChapterFromIDB(
    chapterId: string,
    updateHydratingState: (chapterId: string, hydrating: boolean) => void
  ): Promise<EnhancedChapter | null> {
    return loadChapterFromIDB(chapterId, updateHydratingState);
  }

  /** Update browser history with chapter information */
  static updateBrowserHistory(
    chapter: EnhancedChapter,
    chapterId: string,
    options?: ReaderHistoryOptions
  ): void {
    updateBrowserHistory(chapter, chapterId, options);
  }

  /** Check if URL is from a supported source for fetching */
  static isValidUrl(url: string): boolean {
    return isUrlSupported(url);
  }

  private static _storeDebugEnabled(): boolean {
    return typeof window !== 'undefined' && window.localStorage?.getItem('store-debug') === 'true';
  }
}
