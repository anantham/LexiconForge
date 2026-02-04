/**
 * Chapters Slice - Manages chapter data and navigation
 * 
 * Handles:
 * - Chapter storage and retrieval
 * - Navigation history
 * - Chapter importing and fetching
 * - URL mapping and indexing
 * - Novel metadata
 */

import type { StateCreator } from 'zustand';
import type { EnhancedChapter, NovelInfo } from '../../services/stableIdService';
import { normalizeUrlAggressively, transformImportedChapters } from '../../services/stableIdService';
import { NavigationService, type NavigationContext } from '../../services/navigationService';
import { ChapterOps, ImportOps } from '../../services/db/operations';
import type { ImportedChapter } from '../../types';
import { validateApiKey } from '../../services/aiService';
import { debugLog, debugWarn } from '../../utils/debug';
import { memoryCacheSnapshot } from '../../utils/memoryDiagnostics';

export interface ChaptersState {
  // Core data
  chapters: Map<string, EnhancedChapter>;
  novels: Map<string, NovelInfo>;
  
  // Navigation
  currentChapterId: string | null;
  navigationHistory: string[];
  
  // URL mapping for fast lookups
  urlIndex: Map<string, string>;        // normalized URL -> chapterId
  rawUrlIndex: Map<string, string>;     // raw URL -> chapterId
}

export interface ChaptersActions {
  // Chapter management
  getChapter: (chapterId: string) => EnhancedChapter | null;
  getCurrentChapter: () => EnhancedChapter | null;
  setCurrentChapter: (chapterId: string | null) => void;
  
  // Chapter loading and persistence
  loadChapterFromIDB: (chapterId: string) => Promise<EnhancedChapter | null>;
  importChapter: (chapter: EnhancedChapter) => void;
  updateChapter: (chapterId: string, updates: Partial<EnhancedChapter>) => void;
  removeChapter: (chapterId: string) => void;
  
  // Navigation
  handleNavigate: (url: string) => Promise<void>;
  handleFetch: (url: string) => Promise<string | undefined>;
  navigateToChapter: (chapterId: string) => void;
  lightenNonCurrentChapters: (currentChapterId: string) => void;

  // Navigation history
  addToHistory: (chapterId: string) => void;
  clearHistory: () => void;
  getRecentChapters: (limit?: number) => EnhancedChapter[];
  
  // URL validation and mapping
  isValidUrl: (url: string) => boolean;
  findChapterByUrl: (url: string) => string | null;
  addUrlMapping: (url: string, chapterId: string) => void;
  
  // Batch operations
  importChapters: (chapters: EnhancedChapter[]) => void;
  clearAllChapters: () => void;
  
  // Novel management
  getNovel: (novelId: string) => NovelInfo | null;
  updateNovel: (novelId: string, updates: Partial<NovelInfo>) => void;
  
  // Statistics
  getChapterCount: () => number;
  getNovelCount: () => number;
  getChapterStats: () => { total: number; withTranslations: number; withImages: number };
  getMemoryDiagnostics: () => MemoryDiagnostics;

  // Custom text import
  importCustomText: (title: string, content: string, sourceLanguage?: string) => Promise<string | undefined>;

  // Preloading
  preloadNextChapters: () => void;
}

export interface MemoryDiagnostics {
  totalChapters: number;
  chaptersWithTranslations: number;
  chaptersWithImages: number;
  imagesInRAM: number;
  imagesInCache: number;
  estimatedRAM: {
    totalBytes: number;
    chapterContentBytes: number;
    base64ImageBytes: number;
    totalMB: number;
  };
  warnings: string[];
}

export type ChaptersSlice = ChaptersState & ChaptersActions;

const recordChapterCache = (context: string, size: number, extra?: Record<string, unknown>) => {
  memoryCacheSnapshot(context, {
    size,
    ...(extra || {}),
  });
};

export const createChaptersSlice: StateCreator<
  any,
  [],
  [],
  ChaptersSlice
> = (set, get) => ({
  // Initial state
  chapters: new Map<string, EnhancedChapter>(),
  novels: new Map<string, NovelInfo>(),
  currentChapterId: null,
  navigationHistory: [],
  urlIndex: new Map<string, string>(),
  rawUrlIndex: new Map<string, string>(),
  
  // Chapter management
  getChapter: (chapterId) => {
    return get().chapters.get(chapterId) || null;
  },
  
  getCurrentChapter: () => {
    const { currentChapterId, chapters } = get();
    return currentChapterId ? chapters.get(currentChapterId) || null : null;
  },
  
  setCurrentChapter: (chapterId) => {
    // Diagnostic timestamped set for tracing navigation/hydration races
    debugLog('translation', 'summary', `[Chapters] setCurrentChapter -> ${chapterId} @${Date.now()}`);

    // Cancel any active translation from the previous chapter when navigating away
    const prevChapterId = get().currentChapterId;
    if (prevChapterId && prevChapterId !== chapterId) {
      debugLog('translation', 'summary', '🚫 [Chapters] Navigation detected, cancelling previous chapter translation:', prevChapterId);
      const translationsActions = get() as any;
      if (translationsActions.cancelTranslation) {
        translationsActions.cancelTranslation(prevChapterId);
        debugLog('translation', 'summary', '✅ [Chapters] Cancelled translation for:', prevChapterId);
      }
    }

    set({ currentChapterId: chapterId });

    // Add to history if it's a real chapter
    if (chapterId) {
      get().addToHistory(chapterId);
    }
  },
  
  // Chapter loading and persistence
  loadChapterFromIDB: async (chapterId) => {
    const updateHydratingState = (id: string, hydrating: boolean) => {
      // Delegate to UI slice for hydration state
      const uiActions = get() as any;
      if (uiActions.setHydratingState) {
        uiActions.setHydratingState(id, hydrating);
      }
    };
    
    const chapter = await NavigationService.loadChapterFromIDB(chapterId, updateHydratingState);
    
    if (chapter) {
      // Add to chapters map
      set(state => {
        const newChapters = new Map(state.chapters);
        const existed = newChapters.has(chapterId);
        newChapters.set(chapterId, chapter);
        recordChapterCache('chapters.loadFromIDB', newChapters.size, {
          chapterId,
          action: existed ? 'updated' : 'added',
        });
        return {
          chapters: newChapters,
        };
      });

      if (
        chapter.translationResult?.suggestedIllustrations &&
        chapter.translationResult.suggestedIllustrations.length > 0
      ) {
        const imageActions = get() as any;
        if (typeof imageActions.loadExistingImages === 'function') {
          void imageActions
            .loadExistingImages(chapterId)
            .catch(error => console.warn('[ChaptersSlice] Failed to hydrate images from IDB:', error));
        }
      }
    }
    
    return chapter;
  },
  
  importChapter: (chapter) => {
    set(state => {
      const newChapters = new Map(state.chapters);
      const existed = newChapters.has(chapter.id);
      newChapters.set(chapter.id, chapter);
      
      // Update URL mappings
      const newUrlIndex = new Map(state.urlIndex);
      const newRawUrlIndex = new Map(state.rawUrlIndex);
      
      // Add canonical URL mapping
      if (chapter.canonicalUrl) {
        const normalized = chapter.canonicalUrl; // Assuming it's already normalized
        newUrlIndex.set(normalized, chapter.id);
        newRawUrlIndex.set(chapter.canonicalUrl, chapter.id);
      }
      
      // Add source URLs mappings
      chapter.sourceUrls?.forEach(url => {
        newRawUrlIndex.set(url, chapter.id);
      });
      
      recordChapterCache('chapters.import', newChapters.size, {
        chapterId: chapter.id,
        action: existed ? 'updated' : 'added',
        sourceCount: chapter.sourceUrls?.length || 0,
      });

      return {
        chapters: newChapters,
        urlIndex: newUrlIndex,
        rawUrlIndex: newRawUrlIndex
      };
    });
  },
  
  updateChapter: (chapterId, updates) => {
    set(state => {
      const chapter = state.chapters.get(chapterId);
      if (!chapter) return state;
      
      const newChapters = new Map(state.chapters);
      newChapters.set(chapterId, { ...chapter, ...updates });
      recordChapterCache('chapters.update', newChapters.size, {
        chapterId,
        fields: Object.keys(updates || {}),
      });
      
      return { chapters: newChapters };
    });
  },
  
  removeChapter: (chapterId) => {
    set(state => {
      const newChapters = new Map(state.chapters);
      const chapter = newChapters.get(chapterId);
      
      if (!chapter) return state;
      
      newChapters.delete(chapterId);
      
      // Remove from URL mappings
      const newUrlIndex = new Map(state.urlIndex);
      const newRawUrlIndex = new Map(state.rawUrlIndex);
      
      // Find and remove mappings
      for (const [url, id] of newUrlIndex) {
        if (id === chapterId) newUrlIndex.delete(url);
      }
      for (const [url, id] of newRawUrlIndex) {
        if (id === chapterId) newRawUrlIndex.delete(url);
      }
      
      // Remove from navigation history
      const newHistory = state.navigationHistory.filter(id => id !== chapterId);
      
      // Update current chapter if it was removed
      const newCurrentChapterId = state.currentChapterId === chapterId ? null : state.currentChapterId;
      recordChapterCache('chapters.remove', newChapters.size, { chapterId });
      
      return {
        chapters: newChapters,
        urlIndex: newUrlIndex,
        rawUrlIndex: newRawUrlIndex,
        navigationHistory: newHistory,
        currentChapterId: newCurrentChapterId
      };
    });
  },
  
  // Navigation
  handleNavigate: async (url) => {
    const state = get();
    const context: NavigationContext = {
      chapters: state.chapters,
      urlIndex: state.urlIndex,
      rawUrlIndex: state.rawUrlIndex,
      navigationHistory: state.navigationHistory,
      hydratingChapters: (state as any).hydratingChapters || {}
    };
    const normalized = normalizeUrlAggressively(url);
    debugLog(
      'navigation',
      'summary',
      '[ChaptersSlice] handleNavigate start',
      {
        url,
        normalized,
        chaptersInMemory: state.chapters.size,
        hasNormalizedMapping: normalized ? state.urlIndex.has(normalized) : false,
        hasRawMapping: state.rawUrlIndex.has(url),
        currentChapterId: state.currentChapterId,
      }
    );
    
    const result = await NavigationService.handleNavigate(url, context, get().loadChapterFromIDB);
    debugLog(
      'navigation',
      'summary',
      '[ChaptersSlice] handleNavigate result',
      {
        url,
        chapterId: result.chapterId ?? null,
        hadError: result.error !== undefined ? result.error : undefined,
        shouldUpdateBrowserHistory: result.shouldUpdateBrowserHistory ?? false,
        navigationHistoryLength: result.navigationHistory?.length ?? state.navigationHistory.length,
        chapterHasTranslation: result.chapter ? Boolean(result.chapter.translationResult) : null,
      }
    );
    
    if (result.error !== undefined) {
      // Set error in UI
      const uiActions = get() as any;
      if (uiActions.setError) {
        uiActions.setError(result.error);
      }
      
      // Handle fetch if needed
      if (result.error === null && NavigationService.isValidUrl(url)) {
        debugLog(
          'navigation',
          'summary',
          '[ChaptersSlice] Delegating to handleFetch after navigation error-null',
          { url }
        );
        await get().handleFetch(url);
      }
      return;
    }
    
    if (result.chapterId && result.chapter) {
      set(state => {
        const updates: any = {
          currentChapterId: result.chapterId
        };

        // Update chapter if provided
        if (result.chapter) {
          const newChapters = new Map(state.chapters);
          newChapters.set(result.chapterId!, result.chapter);
          updates.chapters = newChapters;
        }

        // Update navigation history if provided
        if (result.navigationHistory) {
          updates.navigationHistory = result.navigationHistory;
        }

        return updates;
      });

      // Update browser history if needed
      if (result.shouldUpdateBrowserHistory && result.chapter) {
        NavigationService.updateBrowserHistory(result.chapter, result.chapterId);
      }

      // Clear any error
      const uiActions = get() as any;
      if (uiActions.setError) {
        uiActions.setError(null);
      }

      // Memory optimization: lighten previous chapters
      get().lightenNonCurrentChapters(result.chapterId);
    }
  },
  
  handleFetch: async (url) => {
    // Set loading state
    const uiActions = get() as any;
    if (uiActions.setFetchingState) {
      uiActions.setFetchingState(url, true);
    }
    debugLog(
      'navigation',
      'summary',
      '[ChaptersSlice] handleFetch start',
      {
        url,
        chaptersInMemory: get().chapters.size,
      }
    );
    
    try {
      const result = await NavigationService.handleFetch(url);
      debugLog(
        'navigation',
        'summary',
        '[ChaptersSlice] handleFetch result',
        {
          url,
          hadError: !!result.error,
          returnedChapterId: result.currentChapterId ?? null,
          returnedChapterCount: result.chapters instanceof Map ? result.chapters.size : 0,
        }
      );
      
      if (result.error) {
        if (uiActions.setError) {
          uiActions.setError(result.error);
        }
        return;
      }
      
      if (result.chapters && result.currentChapterId) {
        set(state => {
          const newChapters = new Map([...state.chapters, ...result.chapters!]);
          const newUrlIndex = new Map([...state.urlIndex, ...(result.urlIndex || new Map())]);
          const newRawUrlIndex = new Map([...state.rawUrlIndex, ...(result.rawUrlIndex || new Map())]);
          const newNovels = new Map([...state.novels, ...(result.novels || new Map())]);
          
          const newHistory = [...new Set(state.navigationHistory.concat(result.currentChapterId!))];
          
          return {
            chapters: newChapters,
            urlIndex: newUrlIndex,
            rawUrlIndex: newRawUrlIndex,
            novels: newNovels,
            currentChapterId: result.currentChapterId,
            navigationHistory: newHistory
          };
        });
        debugLog(
          'navigation',
          'summary',
          '[ChaptersSlice] handleFetch merged chapters into store',
          {
            url,
            newChapterId: result.currentChapterId,
            mergedChapterCount: get().chapters.size,
          }
        );
        
        // Update browser history
        const chapter = result.chapters!.get(result.currentChapterId!);
        if (chapter) {
          NavigationService.updateBrowserHistory(chapter, result.currentChapterId!);
        }
        return result.currentChapterId;
      }
      
    } finally {
      // Clear loading state
      if (uiActions.setFetchingState) {
        uiActions.setFetchingState(url, false);
      }
    }
  },
  
  importCustomText: async (title, content, sourceLanguage) => {
    const uiActions = get() as any;
    const syntheticUrl = `https://custom.lexiconforge.local/text/${Date.now()}`;

    if (uiActions.setFetchingState) {
      uiActions.setFetchingState(syntheticUrl, true);
    }

    try {
      const dataForTransformation: ImportedChapter = {
        sourceUrl: syntheticUrl,
        title: title.trim() || 'Custom Text',
        originalContent: content,
        nextUrl: null,
        prevUrl: null,
        translationResult: null,
        feedback: [],
      };

      const stableData = transformImportedChapters([dataForTransformation]);

      if (stableData.currentChapterId) {
        const ch = stableData.chapters.get(stableData.currentChapterId);
        if (ch) {
          ch.importSource = { ...ch.importSource!, sourceFormat: 'manual' };
          if (sourceLanguage?.trim()) {
            ch.sourceLanguage = sourceLanguage.trim();
          }
        }
      }

      await ImportOps.importStableSessionData({
        novels: stableData.novels,
        chapters: stableData.chapters,
        urlIndex: stableData.urlIndex,
        rawUrlIndex: stableData.rawUrlIndex,
        currentChapterId: stableData.currentChapterId,
        navigationHistory: [],
      });

      set(state => {
        const newChapters = new Map([...state.chapters, ...stableData.chapters]);
        const newUrlIndex = new Map([...state.urlIndex, ...stableData.urlIndex]);
        const newRawUrlIndex = new Map([...state.rawUrlIndex, ...stableData.rawUrlIndex]);
        const newNovels = new Map([...state.novels, ...stableData.novels]);
        const newHistory = [...new Set(state.navigationHistory.concat(stableData.currentChapterId!))];
        return {
          chapters: newChapters,
          urlIndex: newUrlIndex,
          rawUrlIndex: newRawUrlIndex,
          novels: newNovels,
          currentChapterId: stableData.currentChapterId,
          navigationHistory: newHistory,
        };
      });

      const chapter = stableData.chapters.get(stableData.currentChapterId!);
      if (chapter) {
        NavigationService.updateBrowserHistory(chapter, stableData.currentChapterId!);
      }

      // Switch to "Original" view so the user sees their pasted text
      // (default viewMode is 'english' which would show empty since there's no translation yet)
      if (uiActions.setViewMode) {
        uiActions.setViewMode('original');
      }

      return stableData.currentChapterId ?? undefined;
    } catch (e: any) {
      if (uiActions.setError) {
        uiActions.setError(`Failed to import custom text: ${e.message}`);
      }
    } finally {
      if (uiActions.setFetchingState) {
        uiActions.setFetchingState(syntheticUrl, false);
      }
    }
  },

  navigateToChapter: (chapterId) => {
    const chapter = get().chapters.get(chapterId);
    if (chapter) {
      set({ currentChapterId: chapterId });
      get().addToHistory(chapterId);
      NavigationService.updateBrowserHistory(chapter, chapterId);

      // Memory optimization: lighten previous chapters
      get().lightenNonCurrentChapters(chapterId);
    }
  },

  // Memory optimization: Drop translationResult from non-current chapters
  lightenNonCurrentChapters: (_currentChapterId) => {
    // Temporarily disabled: keeping translationResult in memory avoids unnecessary rehydration/inflight retranslations.
  },

  // Navigation history
  addToHistory: (chapterId) => {
    set(state => {
      const newHistory = [...new Set(state.navigationHistory.concat(chapterId))];

      // Cap at 500 entries, keeping most recent
      const cappedHistory = newHistory.length > 500 ? newHistory.slice(-500) : newHistory;

      // Persist to IndexedDB (fire-and-forget without await)
      try {
        Promise.resolve()
          .then(() => import('../../services/db/index'))
          .then(({ getRepoForService }) => {
            const repo = getRepoForService('chaptersSlice');
            return repo.setSetting('navigation-history', { stableIds: cappedHistory }).catch(() => {});
          })
          .catch(() => {});
      } catch {}

      return { navigationHistory: cappedHistory };
    });
  },
  
  clearHistory: () => {
    set({ navigationHistory: [] });
    
    // Persist to IndexedDB (fire-and-forget without await)
    try {
      Promise.resolve()
        .then(() => import('../../services/db/index'))
        .then(({ getRepoForService }) => {
          const repo = getRepoForService('chaptersSlice');
          return repo.setSetting('navigation-history', { stableIds: [] }).catch(() => {});
        })
        .catch(() => {});
    } catch {}
  },
  
  getRecentChapters: (limit = 10) => {
    const { navigationHistory, chapters } = get();
    return navigationHistory
      .slice(-limit)
      .reverse()
      .map(id => chapters.get(id))
      .filter((chapter): chapter is EnhancedChapter => !!chapter);
  },
  
  // URL validation and mapping
  isValidUrl: (url) => {
    return NavigationService.isValidUrl(url);
  },
  
  findChapterByUrl: (url) => {
    const { urlIndex, rawUrlIndex } = get();
    return urlIndex.get(url) || rawUrlIndex.get(url) || null;
  },
  
  addUrlMapping: (url, chapterId) => {
    set(state => {
      const newRawUrlIndex = new Map(state.rawUrlIndex);
      newRawUrlIndex.set(url, chapterId);
      return { rawUrlIndex: newRawUrlIndex };
    });
  },
  
  // Batch operations
  importChapters: (chapters) => {
    chapters.forEach(chapter => {
      get().importChapter(chapter);
    });
  },
  
  clearAllChapters: () => {
    set(state => {
      recordChapterCache('chapters.clearAll', 0, { previousSize: state.chapters.size });
      return {
        chapters: new Map<string, EnhancedChapter>(),
        novels: new Map<string, NovelInfo>(),
        currentChapterId: null,
        navigationHistory: [],
        urlIndex: new Map<string, string>(),
        rawUrlIndex: new Map<string, string>()
      };
    });
  },
  
  // Novel management
  getNovel: (novelId) => {
    return get().novels.get(novelId) || null;
  },
  
  updateNovel: (novelId, updates) => {
    set(state => {
      const novel = state.novels.get(novelId);
      if (!novel) return state;
      
      const newNovels = new Map(state.novels);
      newNovels.set(novelId, { ...novel, ...updates });
      
      return { novels: newNovels };
    });
  },
  
  // Statistics
  getChapterCount: () => {
    return get().chapters.size;
  },
  
  getNovelCount: () => {
    return get().novels.size;
  },
  
  getChapterStats: () => {
    const chapters = Array.from(get().chapters.values()) as EnhancedChapter[];

    return {
      total: chapters.length,
      withTranslations: chapters.filter(c => !!c.translationResult).length,
      withImages: chapters.filter(c =>
        c.translationResult?.suggestedIllustrations?.some((ill: any) => ill.generatedImage)
      ).length
    };
  },

  getMemoryDiagnostics: (): MemoryDiagnostics => {
    const chapters = Array.from(get().chapters.values()) as EnhancedChapter[];
    const warnings: string[] = [];

    // Count chapters with translations and images
    const withTranslations = chapters.filter(c => !!c.translationResult).length;
    const withImages = chapters.filter(c =>
      c.translationResult?.suggestedIllustrations?.some((ill: any) => ill.generatedImage)
    ).length;

    // Analyze image storage patterns
    let imagesInRAM = 0;
    let imagesInCache = 0;
    let base64ImageBytes = 0;
    let chapterContentBytes = 0;

    for (const chapter of chapters) {
      // Calculate chapter content size (rough estimate)
      if (chapter.content) {
        chapterContentBytes += chapter.content.length * 2; // UTF-16 = 2 bytes per char
      }
      if (chapter.translationResult?.translatedContent) {
        chapterContentBytes += chapter.translationResult.translatedContent.length * 2;
      }

      // Analyze image storage
      const illustrations = chapter.translationResult?.suggestedIllustrations || [];
      for (const illust of illustrations) {
        if (illust.generatedImage) {
          // Check if using legacy base64 storage (in RAM)
          if (illust.generatedImage.imageData && illust.generatedImage.imageData.length > 0) {
            imagesInRAM++;
            // Base64 is ~4/3 the size of original binary + overhead
            base64ImageBytes += illust.generatedImage.imageData.length;
          }
          // Check if using modern cache key storage
          else if (illust.generatedImage.imageCacheKey) {
            imagesInCache++;
          }
        }
      }
    }

    // Calculate total RAM estimate
    const totalBytes = chapterContentBytes + base64ImageBytes;
    const totalMB = totalBytes / (1024 * 1024);

    // Generate warnings
    if (chapters.length > 50) {
      warnings.push(`⚠️ ${chapters.length} chapters loaded (recommended max: 50 chapters for optimal performance)`);
    }

    if (imagesInRAM > 0) {
      warnings.push(`⚠️ ${imagesInRAM} image(s) using legacy base64 storage in RAM (${(base64ImageBytes / 1024 / 1024).toFixed(2)} MB). Consider running migration script.`);
    }

    return {
      totalChapters: chapters.length,
      chaptersWithTranslations: withTranslations,
      chaptersWithImages: withImages,
      imagesInRAM,
      imagesInCache,
      estimatedRAM: {
        totalBytes,
        chapterContentBytes,
        base64ImageBytes,
        totalMB: Number(totalMB.toFixed(2))
      },
      warnings
    };
  },

  // Preloading
  preloadNextChapters: () => {
    // This function just kicks off the worker.
    // The worker itself should get the latest state.
    const worker = async () => {
      const {
        currentChapterId,
        chapters,
        settings,
        loadChapterFromIDB,
        fetchTranslationVersions,
        isTranslationActive,
        handleTranslate,
      } = get();

      if (!currentChapterId || settings.preloadCount === 0) {
        return;
      }

      const currentChapter = chapters.get(currentChapterId);

      if (!currentChapter || typeof currentChapter.chapterNumber !== 'number') {
        console.warn('[Worker] Cannot start preload: current chapter or its number is missing.');
        return;
      }

      const numberToChapterMap = new Map<number, {id: string, chapter: any}>();
      // Use the chapters map we just fetched with get()
      for (const [id, chapter] of chapters.entries()) {
        if (typeof chapter.chapterNumber === 'number') {
          numberToChapterMap.set(chapter.chapterNumber, { id, chapter });
        }
      }

      for (let i = 1; i <= settings.preloadCount; i++) {
        const targetNumber = currentChapter.chapterNumber + i;
        let nextChapterInfo = numberToChapterMap.get(targetNumber);

        if (!nextChapterInfo) {
          const chapterRecord = await ChapterOps.findByNumber(targetNumber);
          if (chapterRecord && chapterRecord.stableId) {
            await loadChapterFromIDB(chapterRecord.stableId);
            const loadedChapter = get().chapters.get(chapterRecord.stableId);
            if (loadedChapter) {
              nextChapterInfo = {
                id: chapterRecord.stableId,
                chapter: loadedChapter,
              };
            }
          }
        }

        // If still not found, try to fetch from web using current chapter's nextUrl or navigation logic
        if (!nextChapterInfo && i === 1 && currentChapter.nextUrl) {
          if (!NavigationService.isValidUrl(currentChapter.nextUrl)) {
            debugLog('worker', 'summary', `[Worker] Skipping preload fetch for unsupported URL: ${currentChapter.nextUrl}`);
            break;
          }
          debugLog('worker', 'summary', `[Worker] Chapter #${targetNumber} not found locally, attempting web fetch from: ${currentChapter.nextUrl}`);
          try {
            const fetchResult = await NavigationService.handleFetch(currentChapter.nextUrl);
            if (fetchResult.chapters && fetchResult.currentChapterId) {
              // Merge fetched chapter into store
              const state = get();
              const newChapters = new Map(state.chapters);
              const newUrlIndex = new Map(state.urlIndex);
              const newRawUrlIndex = new Map(state.rawUrlIndex);
              
              // Add fetched chapters to state
              for (const [id, chapter] of fetchResult.chapters.entries()) {
                newChapters.set(id, chapter);
              }
              if (fetchResult.urlIndex) {
                for (const [url, id] of fetchResult.urlIndex.entries()) {
                  newUrlIndex.set(url, id);
                }
              }
              if (fetchResult.rawUrlIndex) {
                for (const [url, id] of fetchResult.rawUrlIndex.entries()) {
                  newRawUrlIndex.set(url, id);
                }
              }
              
              // Update store with fetched data
              set(state => ({
                chapters: newChapters,
                urlIndex: newUrlIndex,
                rawUrlIndex: newRawUrlIndex,
              }));
              
              // Update local variables for continued preloading
              const fetchedChapter = fetchResult.chapters.get(fetchResult.currentChapterId);
              if (fetchedChapter) {
                nextChapterInfo = {
                  id: fetchResult.currentChapterId,
                  chapter: fetchedChapter,
                };
                
                // Update numberToChapterMap for future iterations
                if (typeof fetchedChapter.chapterNumber === 'number') {
                  numberToChapterMap.set(fetchedChapter.chapterNumber, nextChapterInfo);
                }
                
                debugLog('worker', 'summary', `[Worker] Successfully fetched chapter #${fetchedChapter.chapterNumber || 'unknown'} for preloading`);
              }
            }
          } catch (error: any) {
            debugWarn('worker', 'summary', `[Worker] Failed to fetch next chapter from ${currentChapter.nextUrl}: ${error.message}`);
            // Continue with the break below to stop preloading on fetch failure
          }
        }

        if (!nextChapterInfo) {
          debugLog('worker', 'summary', `[Worker] Stopping preload at chapter #${targetNumber} - chapter not found locally or via web fetch`);
          break;
        }

        const { id: nextChapterId } = nextChapterInfo;

        const existingVersions = await fetchTranslationVersions(nextChapterId);
        if (existingVersions.length > 0) {
          debugLog('worker', 'full', `[Worker] Skipping chapter #${targetNumber} - ${existingVersions.length} version(s) already exist.`);
          continue;
        }

        if (get().pendingTranslations?.has(nextChapterId)) {
          debugLog('worker', 'full', `[Worker] Skipping chapter #${targetNumber} - translation already pending.`);
          continue;
        }

        if (isTranslationActive(nextChapterId)) {
          debugLog('worker', 'full', `[Worker] Skipping chapter #${targetNumber} - translation already in progress.`);
          continue;
        }

        const apiValidation = validateApiKey(get().settings);
        if (!apiValidation.isValid) {
          debugWarn('worker', 'summary', `[Worker] Stopping preload - API key missing: ${apiValidation.errorMessage}`);
          break;
        }

        debugLog('worker', 'summary', `[Worker] Pre-translating chapter #${targetNumber} (ID: ${nextChapterId})`);
        await handleTranslate(nextChapterId);
      }
    };

    setTimeout(worker, 1500);
  },
});
