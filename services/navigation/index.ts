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
import { ChapterOps, TranslationOps, SettingsOps } from '../db/operations';
import { telemetryService } from '../telemetryService';
import { debugLog } from '../../utils/debug';
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

      let chapterId = urlIndex.get(normalizedUrl || '') || rawUrlIndex.get(url);

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
          console.log(`[Nav] Chapter ${chapterId} status @${Date.now()}:`, {
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
          console.log(`[Nav] Navigation history update @${Date.now()}:`, {
            before: navigationHistory,
            after: newHistory,
            currentChapter: chapterId
          });
        }

        // Persist navigation state
        try {
          SettingsOps.set('navigation-history', { stableIds: newHistory }).catch(() => {});
        } catch {}
        try {
          SettingsOps.set('lastActiveChapter', {
            id: chapterId,
            url: chapters.get(chapterId)?.canonicalUrl || url,
          }).catch(() => {});
        } catch {}

        slog(`[Navigate] Found existing chapter ${chapterId} for URL ${url}.`);

        const chapter = chapters.get(chapterId);

        // Hydrate translation result if missing
        if (chapter && !chapter.translationResult) {
          console.log(`🔧 [Navigation] Chapter ${chapterId} in memory but missing translationResult, attempting hydration @${Date.now()}`);
          try {
            const active = await TranslationOps.getActiveByStableId(chapterId);
            if (active) {
              console.log(`🔧 [Navigation] Found active translation in IDB, hydrating @${Date.now()}`, {
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
                  activeSnapshot ?? chapter.translationSettingsSnapshot ?? null;
                console.log(`✅ [Navigation] Hydration successful @${Date.now()}`);
              } else {
                console.warn(`⚠️ [Navigation] Hydration returned null @${Date.now()}`);
              }
            } else {
              console.log(`⚠️ [Navigation] No active translation found in IDB for ${chapterId} @${Date.now()}`);
            }
          } catch (err) {
            console.error(`❌ [Navigation] Hydration error @${Date.now()}:`, err);
          }
        } else if (chapter && chapter.translationResult) {
          console.log(`✅ [Navigation] Chapter ${chapterId} already has translationResult in memory @${Date.now()}`, {
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
            console.log(`[Nav] Lazy load result @${Date.now()}:`, {
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
              console.log(`[Nav] Post-lazy-load navigation history @${Date.now()}:`, {
                before: navigationHistory,
                after: newHistory,
                currentChapter: chapterId
              });
            }

            // Persist navigation state
            try {
              const repo = getRepoForService('navigationService');
              repo.setSetting('navigation-history', { stableIds: newHistory }).catch(() => {});
            } catch {}
            try {
              const repo = getRepoForService('navigationService');
              repo.setSetting('lastActiveChapter', { id: chapterId, url: loaded.canonicalUrl }).catch(() => {});
            } catch {}

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
            const repo = getRepoForService('navigationService');
            const mapping = (norm ? await repo.getUrlMappingForUrl(norm) : null) ||
                            await repo.getUrlMappingForUrl(url);
            if (mapping?.stableId) {
              console.log('[Navigate] Found URL mapping in IndexedDB. Hydrating chapter instead of fetching.');
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

          const repo = getRepoForService('navigationService');
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

            // Persist navigation state
            try {
              const repo2 = getRepoForService('navigationService');
              await repo2.setSetting('lastActiveChapter', { id: chapterIdFound, url: canonicalUrl });
              await repo2.setSetting('navigation-history', { stableIds: newHistory });
            } catch {}

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
