/**
 * Composed Store - Combines all slices into a unified state management solution
 * 
 * This is the new modular store that replaces the monolithic useAppStore.ts.
 * It combines:
 * - UiSlice: UI state and display modes
 * - SettingsSlice: Settings and prompt template management
 * - ChaptersSlice: Chapter data and navigation
 * - TranslationsSlice: Translation operations and feedback
 * - ImageSlice: Image generation and advanced controls
 * - ExportSlice: Session and EPUB export functionality
 * - JobsSlice: Background job management
 */

import { create } from 'zustand';
import { createUiSlice, type UiSlice } from './slices/uiSlice';
import { createSettingsSlice, type SettingsSlice } from './slices/settingsSlice';
import { createChaptersSlice, type ChaptersSlice } from './slices/chaptersSlice';
import { createTranslationsSlice, type TranslationsSlice } from './slices/translationsSlice';
import { createImageSlice, type ImageSlice } from './slices/imageSlice';
import { createExportSlice, type ExportSlice } from './slices/exportSlice';
import { createJobsSlice, type JobsSlice } from './slices/jobsSlice';
import { createAudioSlice, type AudioSlice } from './slices/audioSlice';
import { SessionManagementService } from '../services/sessionManagementService';
import { indexedDBService } from '../services/indexeddb';
import { normalizeUrlAggressively } from '../services/stableIdService';
import { audioServiceWorker } from '../services/audio/storage/serviceWorker';
import { debugLog } from '../utils/debug';
import '../services/imageMigrationService'; // Import for window exposure

// Combined state type
export type AppState = UiSlice & SettingsSlice & ChaptersSlice & TranslationsSlice & ImageSlice & ExportSlice & JobsSlice & AudioSlice;

// Session management actions (not part of slices but needed for store initialization)
export interface SessionActions {
  // Session management
  clearSession: (options?: {
    clearSettings?: boolean;
    clearPromptTemplates?: boolean; 
    clearIndexedDB?: boolean;
    clearLocalStorage?: boolean;
  }) => Promise<void>;
  importSessionData: (payload: string | object) => Promise<void>;
  
  // Initialization
  initializeStore: () => Promise<void>;
}

// Combined store with session management
export const useAppStore = create<AppState & SessionActions>((set, get, store) => ({
  // Combine all slices
  ...createUiSlice(set, get, store),
  ...createSettingsSlice(set, get, store),
  ...createChaptersSlice(set, get, store),
  ...createTranslationsSlice(set, get, store),
  ...createImageSlice(set, get, store),
  ...createExportSlice(set, get, store),
  ...createJobsSlice(set, get, store),
  ...createAudioSlice(set, get, store),
  
  // Session management actions
  clearSession: async (options = {}) => {
    try {
      // Clear session data
      await SessionManagementService.clearSession(options);
      
      // Reset all slices to initial state
      const initialState = {
        // UI slice - keep current viewMode (don't reset on session clear)
        viewMode: get().viewMode || 'english' as const,
        showSettingsModal: false,
        showExportModal: false,
        showDebugModal: false,
        isLoading: { fetching: false, translating: false },
        error: null,
        notification: null,
        urlLoadingStates: {},
        hydratingChapters: {},
        
        // Settings slice
        settings: SessionManagementService.loadSettings(),
        promptTemplates: [],
        activePromptTemplate: null,
        settingsLoaded: false,
        settingsError: null,
        
        // Chapters slice
        chapters: new Map(),
        novels: new Map(),
        currentChapterId: null,
        navigationHistory: [],
        urlIndex: new Map(),
        rawUrlIndex: new Map(),
        
        // Translations slice
        activeTranslations: {},
        feedbackHistory: {},
        amendmentProposals: [],
        translationProgress: {},
        
        // Image slice
        generatedImages: {},
        steeringImages: {},
        negativePrompts: {},
        guidanceScales: {},
        loraModels: {},
        loraStrengths: {},
        imageGenerationMetrics: null,
        imageGenerationProgress: {},
        
        // Jobs slice
        jobs: {},
        workers: {}
      };
      
      set(initialState);
      
      // Reload session data if needed
      if (!options.clearSettings) {
        await get().loadPromptTemplates();
      }
      
    } catch (error) {
      console.error('[Store] Failed to clear session:', error);
      const uiActions = get();
      uiActions.setError(`Failed to clear session: ${error}`);
    }
  },

  importSessionData: async (payload) => {
    try {
      const obj = typeof payload === 'string' ? JSON.parse(payload) : payload as any;
      
      // Full session format branch
      if (obj?.metadata?.format === 'lexiconforge-full-1') {
        // console.log('[Import] Detected full session format. Importing into IndexedDB as ground truth.');
        await indexedDBService.importFullSessionData(obj);
        
        // Hydrate store from IDB for UI
        const rendering = await indexedDBService.getChaptersForReactRendering();
        const nav = await indexedDBService.getSetting<any>('navigation-history').catch(() => null);
        const lastActive = await indexedDBService.getSetting<any>('lastActiveChapter').catch(() => null);
        
        set(state => {
          const newChapters = new Map<string, any>();
          const newUrlIndex = new Map<string, string>();
          const newRawUrlIndex = new Map<string, string>();
          
          for (const ch of rendering) {
            newChapters.set(ch.stableId, {
              id: ch.stableId,
              title: ch.data.chapter.title,
              content: ch.data.chapter.content,
              originalUrl: ch.url,
              nextUrl: ch.data.chapter.nextUrl,
              prevUrl: ch.data.chapter.prevUrl,
              chapterNumber: ch.chapterNumber,
              canonicalUrl: ch.url,
              sourceUrls: [ch.url],
              fanTranslation: (ch.data.chapter as any).fanTranslation ?? null,
              translationResult: ch.data.translationResult || null,
              feedback: [],
            });
            
            const norm = normalizeUrlAggressively(ch.url);
            if (norm) newUrlIndex.set(norm, ch.stableId);
            newRawUrlIndex.set(ch.url, ch.stableId);
          }
          
          return {
            chapters: newChapters,
            urlIndex: newUrlIndex,
            rawUrlIndex: newRawUrlIndex,
            navigationHistory: Array.isArray(nav?.stableIds) ? nav.stableIds : state.navigationHistory,
            currentChapterId: (lastActive && lastActive.id) ? lastActive.id : state.currentChapterId,
            error: null,
          };
        });
        
        // console.log('[Import] Full session import completed successfully');
        return;
      }
      
      // console.log('[Import] Processing legacy import format');
      throw new Error('Legacy import format not implemented in new store structure');
      
    } catch (error) {
      console.error('[Store] Failed to import session data:', error);
      const uiActions = get();
      uiActions.setError(`Failed to import session: ${error}`);
      throw error;
    }
  },
  
  initializeStore: async () => {
    get().setInitialized(false);
    try {
      // Load settings
      get().loadSettings();

      // Load prompt templates; if missing, bootstrap a default via initializeSession()
      try {
        const { templates, activeTemplate } = await SessionManagementService.loadPromptTemplates();
        if (templates.length === 0 || !activeTemplate) {
          const init = await SessionManagementService.initializeSession();
          set({
            settings: init.settings,
            promptTemplates: init.promptTemplates,
            activePromptTemplate: init.activePromptTemplate,
          });
        } else {
          set({ promptTemplates: templates, activePromptTemplate: activeTemplate });
        }
      } catch (e) {
        console.warn('[Store] Failed to load/initialize prompt templates:', e);
      }

      // ===== HANDLE URL PARAMETERS FOR DEEP LINKING =====
      const urlParams = new URLSearchParams(window.location.search);

      // 1. Novel ID from registry (?novel=dungeon-defense)
      const novelId = urlParams.get('novel');
      if (novelId) {
        const { getNovelById } = await import('../config/novelCatalog');
        const novel = getNovelById(novelId);

        if (novel) {
          console.log(`[DeepLink] Loading novel: ${novel.title}`);

          get().setNotification({
            type: 'info',
            message: `Loading ${novel.title}... (${novel.metadata.chapterCount} chapters)`
          });

          try {
            const { ImportService } = await import('../services/importService');
            await ImportService.importFromUrl(novel.sessionJsonUrl);

            get().setNotification({
              type: 'success',
              message: `✅ Loaded ${novel.title} - ${novel.metadata.chapterCount} chapters ready!`
            });

            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
          } catch (error: any) {
            console.error('[DeepLink] Failed to load novel:', error);
            get().setNotification({
              type: 'error',
              message: `Failed to load ${novel.title}: ${error.message}`
            });
          }
        } else {
          console.warn(`[DeepLink] Unknown novel ID: ${novelId}`);
          get().setNotification({
            type: 'error',
            message: `Unknown novel: ${novelId}`
          });
        }
      }

      // 2. Direct import URL (?import=https://...)
      const importUrl = urlParams.get('import');
      if (importUrl && !novelId) {
        const decodedUrl = decodeURIComponent(importUrl);
        console.log(`[DeepLink] Importing from custom URL: ${decodedUrl}`);

        get().setNotification({
          type: 'info',
          message: 'Importing session from URL...'
        });

        try {
          const { ImportService } = await import('../services/importService');
          await ImportService.importFromUrl(decodedUrl);

          get().setNotification({
            type: 'success',
            message: '✅ Session imported successfully!'
          });

          window.history.replaceState({}, '', window.location.pathname);
        } catch (error: any) {
          console.error('[DeepLink] Failed to import from URL:', error);
          get().setNotification({
            type: 'error',
            message: `Import failed: ${error.message}`
          });
        }
      }
      // ===== END URL PARAMETER HANDLING =====
      
      // Backfill URL mappings if needed (one-time operation)
      try {
        const already = await indexedDBService.getSetting<boolean>('urlMappingsBackfilled');
        if (!already) {
          await indexedDBService.backfillUrlMappingsFromChapters();
        }
      } catch (e) {
        console.warn('[Store] Failed to backfill URL mappings:', e);
      }
      // Normalize stableId format and ensure mappings
      try {
        await indexedDBService.normalizeStableIds();
      } catch (e) {
        console.warn('[Store] StableId normalization failed:', e);
      }

      // Backfill isActive flag on legacy translations
      try {
        await indexedDBService.backfillActiveTranslations();
      } catch (e) {
        console.warn('[Store] Active translations backfill failed:', e);
      }

      // Load URL mappings from IndexedDB (only if not already populated)
      // This allows us to skip re-loading on subsequent initializations
      try {
        const currentState = get();
        if (currentState.urlIndex.size === 0 && currentState.rawUrlIndex.size === 0) {
          const mappings = await indexedDBService.getAllUrlMappings();
          if (mappings && mappings.length > 0) {
            set(state => {
              const urlIndex = new Map(state.urlIndex);
              const rawUrlIndex = new Map(state.rawUrlIndex);
              for (const m of mappings) {
                if (m.isCanonical) urlIndex.set(m.url, m.stableId);
                else rawUrlIndex.set(m.url, m.stableId);
              }
              return { urlIndex, rawUrlIndex };
            });
          }
        }
      } catch (e) {
        console.warn('[Store] Failed to load URL mappings:', e);
      }
      
      // Load navigation history from IndexedDB
      try {
        const historyData = await indexedDBService.getSetting('navigation-history');
        if (historyData?.stableIds && Array.isArray(historyData.stableIds)) {
          set({ navigationHistory: historyData.stableIds });
        }
      } catch (e) {
        console.warn('[Store] Failed to load navigation history:', e);
      }
      
      // Load last active chapter
      try {
        const lastChapterData = await indexedDBService.getSetting('lastActiveChapter');
        // console.log('[Store] Last active chapter data:', lastChapterData);
        
        if (lastChapterData?.id) {
          const currentState = get();
          // console.log(`[Store] Setting current chapter ID to: ${lastChapterData.id}`);
          // console.log(`[Store] Chapter already in memory: ${currentState.chapters.has(lastChapterData.id)}`);
          
          // Set as current chapter first
          set(state => ({ 
            currentChapterId: state.currentChapterId || lastChapterData.id 
          }));
          
          // Try to load chapter content if not already in memory
          if (!currentState.chapters.has(lastChapterData.id)) {
            // console.log(`[Store] Loading chapter ${lastChapterData.id} from IndexedDB...`);
            // Fire and forget - UI can render once loaded
            get().loadChapterFromIDB(lastChapterData.id).then(chapter => {
              // console.log(`[Store] Successfully loaded chapter from IDB:`, {
              //   chapterId: lastChapterData.id,
              //   title: chapter?.title,
              //   hasContent: !!chapter?.content,
              //   hasTranslation: !!chapter?.translationResult
              // });
            }).catch(e => {
              console.error(`[Store] Failed to load chapter ${lastChapterData.id} from IDB:`, e);
            });
          } else {
            // console.log(`[Store] Chapter ${lastChapterData.id} already in memory`);
          }
        } else {
          // console.log('[Store] No last active chapter found');
        }
      } catch (e) {
        console.warn('[Store] Failed to load last active chapter:', e);
      }
      // Initialize audio services
      try {
        const settings = get().settings;
        
        // Initialize audio service with current settings
        get().initializeAudioService(settings);
        
        // Register service worker for transparent audio caching
        await audioServiceWorker.register();
        
        debugLog('audio', 'summary', '[Store] Audio services initialized');
      } catch (e) {
        console.warn('[Store] Failed to initialize audio services:', e);
      }
      
      // console.log('[Store] Initialization complete');
      get().setInitialized(true);
      
    } catch (error) {
      console.error('[Store] Failed to initialize:', error);
      const uiActions = get();
      uiActions.setError(`Failed to initialize store: ${error}`);
    }
  }
}));

// Store is initialized by the App component

// Expose store to window for debugging
if (typeof window !== 'undefined') {
  (window as any).useAppStore = useAppStore;
  // Also expose for telemetry access
  (window as any).__APP_STORE__ = useAppStore;
}

// Export individual slice types for type checking
export type { UiSlice } from './slices/uiSlice';
export type { SettingsSlice } from './slices/settingsSlice';
export type { ChaptersSlice } from './slices/chaptersSlice';
export type { TranslationsSlice } from './slices/translationsSlice';
export type { ImageSlice } from './slices/imageSlice';
export type { ExportSlice } from './slices/exportSlice';
export type { JobsSlice } from './slices/jobsSlice';
