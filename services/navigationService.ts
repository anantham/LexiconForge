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
import { TranslationRecord, indexedDBService } from './indexeddb';
import { getRepoForService } from './db/index';
import { 
  EnhancedChapter, 
  normalizeUrlAggressively, 
  transformImportedChapters 
} from './stableIdService';
import { memorySummary, memoryDetail, memoryTimestamp, memoryTiming } from '../utils/memoryDiagnostics';
import { telemetryService } from './telemetryService';

// Logging utilities matching the store pattern
const storeDebugEnabled = () => {
  return typeof window !== 'undefined' && window.localStorage?.getItem('store-debug') === 'true';
};
const slog = (...args: any[]) => { if (storeDebugEnabled()) console.log(...args); };
const swarn = (...args: any[]) => { if (storeDebugEnabled()) console.warn(...args); }; 

const adaptTranslationRecordToResult = (chapterId: string, record: TranslationRecord | null | undefined): any => {
  if (!record) return null;

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
  };
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
        indexedDBService.setSetting('navigation-history', { stableIds: newHistory }).catch(() => {}); 
      } catch {}
      try { 
        indexedDBService.setSetting('lastActiveChapter', { 
          id: chapterId, 
          url: chapters.get(chapterId)?.canonicalUrl || url 
        }).catch(() => {}); 
      } catch {}

      slog(`[Navigate] Found existing chapter ${chapterId} for URL ${url}.`);
      
      const chapter = chapters.get(chapterId);
      
      // Hydrate translation result if missing
      if (chapter && !chapter.translationResult) {
        console.log(`🔧 [Navigation] Chapter ${chapterId} in memory but missing translationResult, attempting hydration @${Date.now()}`);
        try {
          const active = await indexedDBService.getActiveTranslationByStableId(chapterId);
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
      telemetryMeta.outcome = 'fetch_required';
      return { error: null }; // Signal that caller should handle fetch
    } else {
      // Try direct IndexedDB lookup as last resort
      try {
        const repo = getRepoForService('navigationService');
        const found = await repo.findChapterByUrl(url);
        if (found?.stableId) {
          const chapterIdFound = found.stableId;
          const c = found.data?.chapter || {};
          const canonicalUrl = found.canonicalUrl || c.originalUrl || url;
          
          const enhanced: EnhancedChapter = {
            id: chapterIdFound,
            title: c.title || 'Untitled Chapter',
            content: c.content || '',
            originalUrl: canonicalUrl,
            canonicalUrl,
            nextUrl: c.nextUrl,
            prevUrl: c.prevUrl,
            chapterNumber: c.chapterNumber || 0,
            sourceUrls: [c.originalUrl || canonicalUrl],
            importSource: { 
              originalUrl: c.originalUrl || canonicalUrl, 
              importDate: new Date(), 
              sourceFormat: 'json' 
            },
            translationResult: found.data?.translationResult || null,
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
        const dataForTransformation = {
          ...chapterData,
          url: chapterData.originalUrl // Ensure 'url' property is present
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
          await indexedDBService.importStableSessionData({
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
      history.pushState(
        { chapterId }, 
        '', 
        `?chapter=${encodeURIComponent(chapter.canonicalUrl)}`
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
      const rec = await indexedDBService.getChapterByStableId(chapterId);
      slog(`[IDB] Retrieved record:`, {
        exists: !!rec,
        title: rec?.title,
        hasContent: !!rec?.content,
        contentLength: rec?.content?.length || 0,
        hasFanTranslation: !!rec?.fanTranslation,
        fanTranslationLength: rec?.fanTranslation?.length || 0,
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
          importDate: new Date(rec.createdAt || Date.now()),
          sourceFormat: 'json'
        },
        fanTranslation: rec.fanTranslation || null, // Include fan translation from IndexedDB
        translationResult: null, // Will be loaded below
      };

      memoryDetail('Chapter hydration record stats', {
        chapterId,
        contentLength: enhanced.content.length,
        hasTranslation: Boolean(enhanced.translationResult),
        hasFanTranslation: Boolean(enhanced.fanTranslation),
        chapterNumber: enhanced.chapterNumber,
      });

      // Load active translation if available
      try {
        const activeTranslation = await indexedDBService.getActiveTranslationByStableId(chapterId);
        if (activeTranslation) {
          // console.log(`[IDB] ✅ Active translation found for chapter ${chapterId}: ${activeTranslation.translation?.length || 0} characters`);
          
          enhanced.translationResult = adaptTranslationRecordToResult(chapterId, activeTranslation);
        } else {
          // console.log(`[IDB] ❌ No active translation found for chapter ${chapterId}`);
        }
      } catch (error) {
        console.warn(`[IDB] Failed to load active translation for ${chapterId}:`, error);
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
}
