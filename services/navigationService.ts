/**
 * NavigationService - Handles all navigation, URL resolution, and chapter loading
 * 
 * Extracted from useAppStore to separate navigation concerns from state management.
 * This service manages:
 * - URL navigation and mapping 
 * - Chapter lazy loading from IndexedDB
 * - Browser history updates
 * - Chapter fetching for new URLs
 */

import { fetchAndParseUrl, isUrlSupported, getSupportedSiteInfo, SupportedSiteInfo } from './adapters';
import type { TranslationRecord } from './db/types';
import { getRepoForService } from './db/index';
import {
  EnhancedChapter,
  normalizeUrlAggressively,
  transformImportedChapters
} from './stableIdService';
import type { Chapter, ImportedChapter, TranslationResult, TranslationSettingsSnapshot } from '../types';
import type { NovelMetadata } from '../types/novel';
import { memorySummary, memoryDetail, memoryTimestamp, memoryTiming } from '../utils/memoryDiagnostics';
import { telemetryService } from './telemetryService';
import { debugLog } from '../utils/debug';
import { computeDiffHash } from './diff/hash';
import { DIFF_ALGO_VERSION } from './diff/constants';
import { ChapterOps, TranslationOps, SettingsOps, ImportOps, DiffOps } from './db/operations';
import { isSuttaFlowDebug, logSuttaFlow } from './suttaStudioDebug';

// Logging utilities matching the store pattern
const storeDebugEnabled = () => {
  return typeof window !== 'undefined' && window.localStorage?.getItem('store-debug') === 'true';
};
const slog = (...args: any[]) => { if (storeDebugEnabled()) console.log(...args); };
const swarn = (...args: any[]) => { if (storeDebugEnabled()) console.warn(...args); }; 

type StoredNovelMetadata = NovelMetadata & {
  title?: string;
  alternateTitles?: string[];
};

type HydratedTranslationResult = TranslationResult & {
  id: string;
  version?: number;
  customVersionLabel?: string;
  createdAt?: string;
  isActive?: boolean;
  stableId?: string;
  chapterUrl?: string;
};

const adaptTranslationRecordToResult = (
  chapterId: string,
  record: TranslationRecord | null | undefined
): HydratedTranslationResult | null => {
  if (!record) return null;

  // Trace missing metadata for diagnostics
  const hasValidProvider = record.provider && record.provider !== 'unknown';
  const hasValidModel = record.model && record.model !== 'unknown';

  if ((!hasValidProvider || !hasValidModel) && typeof window !== 'undefined') {
    console.warn('[Navigation] Translation has missing/unknown metadata:', {
      chapterId,
      translationId: record.id,
      version: record.version,
      provider: record.provider || '(missing)',
      model: record.model || '(missing)',
      hasSettingsSnapshot: !!record.settingsSnapshot,
      snapshotProvider: record.settingsSnapshot?.provider || '(missing)',
      snapshotModel: record.settingsSnapshot?.model || '(missing)',
      createdAt: record.createdAt,
      // Check if metrics might be in usageMetrics field (legacy format)
      legacyCheck: {
        totalTokens: record.totalTokens,
        requestTime: record.requestTime,
        estimatedCost: record.estimatedCost,
      },
    });
  }

  const usageMetrics = {
    totalTokens: record.totalTokens || 0,
    promptTokens: record.promptTokens || 0,
    completionTokens: record.completionTokens || 0,
    estimatedCost: record.estimatedCost || 0,
    requestTime: record.requestTime || 0,
    provider: record.provider || 'unknown',
    model: record.model || 'unknown',
  };

  const fallbackId =
    (record.version ? `${chapterId}-v${record.version}` : `${chapterId}-legacy-${record.createdAt || 'missing-id'}`) as string;
  const translationId = record.id || fallbackId;

  if (!record.id && typeof window !== 'undefined') {
    console.warn('[Navigation] Hydrated translation is missing a persistent id. Using fallback key.', {
      chapterId,
      fallbackId: translationId,
    });
  }

  return {
    translatedTitle: record.translatedTitle,
    translation: record.translation,
    proposal: record.proposal || null,
    footnotes: record.footnotes || [],
    suggestedIllustrations: record.suggestedIllustrations || [],
    usageMetrics,
    id: translationId,
    version: record.version,
    customVersionLabel: record.customVersionLabel,
    createdAt: record.createdAt,
    isActive: record.isActive,
    stableId: record.stableId,
    chapterUrl: record.chapterUrl,
  } as HydratedTranslationResult;
};

// In-flight fetch management
const inflightFetches = new Map<string, Promise<void>>();

// URL validation with helpful error messages
const validateNavigation = (url: string): { valid: true } | { error: string; supportedSites: SupportedSiteInfo[] } => {
  if (!isUrlSupported(url)) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const supportedSites = getSupportedSiteInfo();
      
      const errorMessage = `${domain} is not currently supported.

Currently supported sites:
${supportedSites.map(s => `• ${s.domain} (example: ${s.example})`).join('\n')}

Want this site added? Please file an issue with:
• The site URL you're trying to use  
• Example chapter links from the site
• Site name and description

This helps us prioritize which sites to support next.`;

      return { error: errorMessage, supportedSites };
    } catch {
      const supportedSites = getSupportedSiteInfo();
      return { 
        error: `Invalid URL format. Please provide a valid URL from one of these supported sites:\n${supportedSites.map(s => s.domain).join(', ')}`,
        supportedSites 
      };
    }
  }
  return { valid: true };
};

export interface NavigationContext {
  chapters: Map<string, EnhancedChapter>;
  urlIndex: Map<string, string>;
  rawUrlIndex: Map<string, string>;
  navigationHistory: string[];
  hydratingChapters: Record<string, boolean>;
}

export interface NavigationResult {
  chapterId?: string;
  chapter?: EnhancedChapter;
  error?: string;
  shouldUpdateBrowserHistory?: boolean;
  navigationHistory?: string[];
}

export interface FetchResult {
  chapters?: Map<string, EnhancedChapter>;
  urlIndex?: Map<string, string>;
  rawUrlIndex?: Map<string, string>;
  novels?: Map<string, any>;
  currentChapterId?: string;
  navigationHistory?: string[];
  error?: string;
}

export class NavigationService {
  
  /**
   * Main navigation handler - resolves URL to chapter and updates navigation state
   */
  static async handleNavigate(
    url: string,
    context: NavigationContext,
    loadChapterFromIDB: (chapterId: string) => Promise<EnhancedChapter | null>
  ): Promise<NavigationResult> {
    const telemetryStart = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
    const telemetryMeta: Record<string, any> = { url };
    try {
    // console.log(`[Nav] Navigating to: ${url} @${Date.now()}`);
    const { urlIndex, rawUrlIndex, chapters, navigationHistory } = context;
    const normalizedUrl = normalizeUrlAggressively(url);
    telemetryMeta.normalizedUrl = normalizedUrl || null;
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
    
    // console.log(`[Nav] URL normalization: ${url} -> ${normalizedUrl} @${Date.now()}`);
    // console.log(`[Nav] URL index size: ${urlIndex.size}, Raw URL index size: ${rawUrlIndex.size} @${Date.now()}`);

    let chapterId = urlIndex.get(normalizedUrl || '') || rawUrlIndex.get(url);
    // console.log(`[Nav] Resolved chapterId: ${chapterId} @${Date.now()}`);
    
    if (chapterId) {
      const hasChapter = chapters.has(chapterId);
      const chapter = chapters.get(chapterId);
      // Debug info about chapter status removed to reduce noise; enable via `store-debug` gate if needed
      if (storeDebugEnabled()) {
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
      // console.log(`[Nav] Chapter found in memory, updating navigation history @${Date.now()}`);
      const newHistory = [...new Set(navigationHistory.concat(chapterId))];
      if (storeDebugEnabled()) {
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
        {
          chapterId,
          hasTranslation: Boolean(chapter?.translationResult),
        }
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
      // console.log(`[Nav] Mapping found (${chapterId}) but not loaded. Hydrating from IndexedDB... @${Date.now()}`);
      
      try {
        const loaded = await loadChapterFromIDB(chapterId);
        if (storeDebugEnabled()) {
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
          if (storeDebugEnabled()) {
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
            {
              chapterId,
              hasTranslation: Boolean(loaded.translationResult),
            }
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
        const norm = normalizedUrl;
        const repo = getRepoForService('navigationService');
        const mapping = (norm ? await repo.getUrlMappingForUrl(norm) : null) ||
                        await repo.getUrlMappingForUrl(url);
        if (mapping?.stableId) {
          console.log('[Navigate] Found URL mapping in IndexedDB. Hydrating chapter instead of fetching.');
          const loaded = await loadChapterFromIDB(mapping.stableId);
          if (loaded) {
            const newHistory = [...new Set(navigationHistory.concat(mapping.stableId))];
            telemetryMeta.outcome = 'idb_hydrated_via_mapping';
            telemetryMeta.chapterId = mapping.stableId;
            telemetryMeta.hydratedTranslation = Boolean(loaded.translationResult);
            debugLog(
              'navigation',
              'summary',
              '[Navigation] Hydrated via mapping from IndexedDB',
              {
                chapterId: mapping.stableId,
                hasTranslation: Boolean(loaded.translationResult),
              }
            );
            return {
              chapterId: mapping.stableId,
              chapter: loaded,
              shouldUpdateBrowserHistory: true,
              navigationHistory: newHistory
            };
          }
        }
      } catch (e) {
        swarn('[Navigate] IDB mapping lookup failed, proceeding to fetch if supported', e);
      }

      // Try to fetch if supported URL
      if (this.isValidUrl(url)) {
        slog(`[Navigate] Hydration failed; attempting fetch for ${url}...`);
        debugLog(
          'navigation',
          'summary',
          '[Navigation] Hydration failed, requesting fetch',
          {
            url,
            normalizedUrl,
            chapterIdHint: chapterId ?? null,
          }
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
        // This shouldn't happen, but fallback just in case
        const errorMessage = `Navigation failed: The URL is not from a supported source and the chapter has not been imported.`;
        console.error(`[Navigate] ${errorMessage}`, { url });
        telemetryMeta.outcome = 'unsupported_url';
        telemetryMeta.reason = 'no_mapping';
        return { error: errorMessage };
      }
    }
    
    // No chapter mapping found
  if (this.isValidUrl(url)) {
      // Supported URL - signal caller to fetch
      slog(`[Navigate] No chapter found for ${url}. Attempting to fetch...`);
      debugLog(
        'navigation',
        'summary',
        '[Navigation] No chapter mapping found; requesting fetch',
        {
          url,
          normalizedUrl,
        }
      );
      telemetryMeta.outcome = 'fetch_required';
      return { error: null }; // Signal that caller should handle fetch
    } else {
      // Try direct IndexedDB lookup as last resort
      try {
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
            title: c?.title || 'Untitled Chapter',
            content: c?.content || '',
            originalUrl: canonicalUrl,
            canonicalUrl,
            nextUrl: c?.nextUrl,
            prevUrl: c?.prevUrl,
            chapterNumber: c?.chapterNumber || 0,
            sourceUrls: [c?.originalUrl || canonicalUrl].filter(
              (url): url is string => typeof url === 'string' && url.length > 0
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
      // This shouldn't happen, but fallback just in case
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

  /**
   * Fetch and parse a new chapter from URL
   */
  static async handleFetch(url: string): Promise<FetchResult> {
    const telemetryStart = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
    const telemetryMeta: Record<string, any> = { url };
    const cachedResult = await this.tryServeChapterFromCache(url, telemetryMeta);
    if (cachedResult) {
      return cachedResult;
    }
    try {
    if (inflightFetches.has(url)) {
      await inflightFetches.get(url);
      telemetryMeta.outcome = 'cache_inflight';
      return {}; // Return empty result since state was already updated
    }

    if (!this.isValidUrl(url)) {
      telemetryMeta.outcome = 'unsupported_url';
      throw new Error(`Unsupported source: ${url}`);
    }

    const fetchPromise = (async (): Promise<FetchResult> => {
      try {
        slog(`[Fetch] Fetching and parsing URL: ${url}`);
        const chapterData = await fetchAndParseUrl(url, {}, () => {});
        await this.applySuttaMetadataFromChapter(chapterData);
        slog(`[Fetch] Raw chapter data:`, {
          title: chapterData.title,
          hasContent: !!chapterData.content,
          contentLength: chapterData.content?.length || 0,
          url: chapterData.originalUrl,
          chapterNumber: chapterData.chapterNumber,
          nextUrl: chapterData.nextUrl,
          prevUrl: chapterData.prevUrl
        });
        
        // Transform to stable format
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
        const stableData = transformImportedChapters([dataForTransformation]);
        slog(`[Fetch] Stable transformation result:`, {
          chaptersCount: stableData.chapters.size,
          currentChapterId: stableData.currentChapterId,
          urlIndexSize: stableData.urlIndex.size,
          rawUrlIndexSize: stableData.rawUrlIndex.size
        });
        
        // Verify the transformed chapter has content
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
        return { error: String(e?.message ?? e ?? 'Fetch failed') };
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

  private static normalizeLanguageLabel(lang: string | null | undefined): string | undefined {
    if (!lang) return undefined;
    const normalized = lang.toLowerCase();
    if (normalized === 'en') return 'English';
    if (normalized === 'pli' || normalized === 'pi') return 'Pali';
    return lang;
  }

  private static async applySuttaMetadataFromChapter(chapter: Chapter): Promise<void> {
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
        NavigationService.normalizeLanguageLabel(chapter.targetLanguage) ??
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

  /**
   * Check if URL is from a supported source for fetching
   */
  static isValidUrl(url: string): boolean {
    return isUrlSupported(url);
  }

  /**
   * Update browser history with chapter information
   */
  static updateBrowserHistory(chapter: EnhancedChapter, chapterId: string): void {
    if (typeof history !== 'undefined' && history.pushState) {
      const currentUrl =
        typeof window !== 'undefined' ? new URL(window.location.href) : null;
      const flowDebug = isSuttaFlowDebug();
      const params = new URLSearchParams();
      const preserveKeys = ['lang', 'author', 'recompile'];

      if (currentUrl?.pathname.startsWith('/sutta')) {
        preserveKeys.forEach((key) => {
          const value = currentUrl.searchParams.get(key);
          if (value !== null && value !== '') {
            params.set(key, value);
          }
        });
      }

      params.set('chapter', chapter.canonicalUrl);
      const search = params.toString();
      const basePath = currentUrl?.pathname || '';
      const nextUrl = basePath ? `${basePath}?${search}` : `?${search}`;
      if (flowDebug && currentUrl?.pathname.startsWith('/sutta')) {
        logSuttaFlow('updateBrowserHistory', {
          chapterId,
          canonicalUrl: chapter.canonicalUrl,
          previousUrl: currentUrl.toString(),
          nextUrl,
          preservedParams: preserveKeys.filter((key) => currentUrl.searchParams.get(key)),
        });
      }
      history.pushState(
        { chapterId }, 
        '', 
        nextUrl
      );
    }
  }

  /**
   * Lazy load chapter from IndexedDB with hydration state management
   */
  static async loadChapterFromIDB(
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
        fanTranslation: rec.fanTranslation || null, // Include fan translation from IndexedDB
        suttaStudio: rec.suttaStudio ?? null,
        translationResult: null, // Will be loaded below
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
              const normalizedFanId = '';

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
            {
              chapterId,
            }
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

  private static async tryServeChapterFromCache(
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
      const chapter = await NavigationService.loadChapterFromIDB(
        mapping.stableId,
        noopHydration
      );

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
        {
          url,
          chapterId: mapping.stableId,
        }
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
}
