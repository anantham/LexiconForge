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
import { NavigationService, type NavigationContext } from '../../services/navigationService';
import { indexedDBService } from '../../services/indexeddb';
import { validateApiKey } from '../../services/aiService';

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

  // Preloading
  preloadNextChapters: () => void;
}

export type ChaptersSlice = ChaptersState & ChaptersActions;

export const createChaptersSlice: StateCreator<
  any,
  [],
  [],
  ChaptersSlice
> = (set, get) => ({
  // Initial state
  chapters: new Map(),
  novels: new Map(),
  currentChapterId: null,
  navigationHistory: [],
  urlIndex: new Map(),
  rawUrlIndex: new Map(),
  
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
    console.log(`[Chapters] setCurrentChapter -> ${chapterId} @${Date.now()}`);
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
      set(state => ({
        chapters: new Map(state.chapters).set(chapterId, chapter)
      }));
    }
    
    return chapter;
  },
  
  importChapter: (chapter) => {
    set(state => {
      const newChapters = new Map(state.chapters);
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
    
    const result = await NavigationService.handleNavigate(url, context, get().loadChapterFromIDB);
    
    if (result.error !== undefined) {
      // Set error in UI
      const uiActions = get() as any;
      if (uiActions.setError) {
        uiActions.setError(result.error);
      }
      
      // Handle fetch if needed
      if (result.error === null && NavigationService.isValidUrl(url)) {
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
    }
  },
  
  handleFetch: async (url) => {
    // Set loading state
    const uiActions = get() as any;
    if (uiActions.setFetchingState) {
      uiActions.setFetchingState(url, true);
    }
    
    try {
      const result = await NavigationService.handleFetch(url);
      
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
  
  navigateToChapter: (chapterId) => {
    const chapter = get().chapters.get(chapterId);
    if (chapter) {
      set({ currentChapterId: chapterId });
      get().addToHistory(chapterId);
      NavigationService.updateBrowserHistory(chapter, chapterId);
    }
  },
  
  // Navigation history
  addToHistory: (chapterId) => {
    set(state => {
      const newHistory = [...new Set(state.navigationHistory.concat(chapterId))];
      
      // Persist to IndexedDB (fire-and-forget without await)
      try {
        Promise.resolve()
          .then(() => import('../../services/db/index'))
          .then(({ getRepoForService }) => {
            const repo = getRepoForService('chaptersSlice');
            return repo.setSetting('navigation-history', { stableIds: newHistory }).catch(() => {});
          })
          .catch(() => {});
      } catch {}
      
      return { navigationHistory: newHistory };
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
    set({
      chapters: new Map(),
      novels: new Map(),
      currentChapterId: null,
      navigationHistory: [],
      urlIndex: new Map(),
      rawUrlIndex: new Map()
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
    const chapters = Array.from(get().chapters.values());
    
    return {
      total: chapters.length,
      withTranslations: chapters.filter(c => !!c.translationResult).length,
      withImages: chapters.filter(c => 
        c.translationResult?.suggestedIllustrations?.some((ill: any) => ill.generatedImage)
      ).length
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
          const chapterRecord = await indexedDBService.findChapterByNumber(targetNumber);
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
          console.log(`[Worker] Chapter #${targetNumber} not found locally, attempting web fetch from: ${currentChapter.nextUrl}`);
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
                
                console.log(`[Worker] Successfully fetched chapter #${fetchedChapter.chapterNumber || 'unknown'} for preloading`);
              }
            }
          } catch (error: any) {
            console.warn(`[Worker] Failed to fetch next chapter from ${currentChapter.nextUrl}: ${error.message}`);
            // Continue with the break below to stop preloading on fetch failure
          }
        }

        if (!nextChapterInfo) {
          console.log(`[Worker] Stopping preload at chapter #${targetNumber} - chapter not found locally or via web fetch`);
          break;
        }

        const { id: nextChapterId } = nextChapterInfo;

        const existingVersions = await fetchTranslationVersions(nextChapterId);
        if (existingVersions.length > 0) {
          console.log(`[Worker] Skipping chapter #${targetNumber} - ${existingVersions.length} version(s) already exist.`);
          continue;
        }

        if (get().pendingTranslations?.has(nextChapterId)) {
          console.log(`[Worker] Skipping chapter #${targetNumber} - translation already pending.`);
          continue;
        }

        if (isTranslationActive(nextChapterId)) {
          console.log(`[Worker] Skipping chapter #${targetNumber} - translation already in progress.`);
          continue;
        }

        const apiValidation = validateApiKey(get().settings);
        if (!apiValidation.isValid) {
          console.warn(`[Worker] Stopping preload - API key missing: ${apiValidation.errorMessage}`);
          break;
        }

        console.log(`[Worker] Pre-translating chapter #${targetNumber} (ID: ${nextChapterId})`);
        await handleTranslate(nextChapterId);
      }
    };

    setTimeout(worker, 1500);
  },
});
