/**
 * UI Slice - Manages pure UI state and display modes
 * 
 * Handles:
 * - View modes (original/fan/english)
 * - Modal states (settings, export)
 * - Loading states (fetching, translating)
 * - Error display
 * - UI feedback and notifications
 */

import type { StateCreator } from 'zustand';
import { BookshelfStateService } from '../../services/bookshelfStateService';
import type { TelemetryErrorContext } from '../../types/telemetry';

export type AppScreen = 'library' | 'reader-loading' | 'reader';

export interface UiState {
  // App shell routing
  appScreen: AppScreen;
  activeNovelId: string | null;
  activeVersionId: string | null;

  // View modes
  viewMode: 'original' | 'fan' | 'english';
  
  // Modal states
  showSettingsModal: boolean;
  showExportModal: boolean;
  showDebugModal: boolean;
  
  // Loading states
  isLoading: {
    fetching: boolean;
    translating: boolean;
  };
  
  // Error and feedback
  error: string | null;
  errorTelemetry: TelemetryErrorContext | null;
  notification: {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    timestamp: number;
  } | null;
  
  // URL-specific loading states
  urlLoadingStates: Record<string, boolean>;
  
  // Chapter-specific hydration states
  hydratingChapters: Record<string, boolean>;
  
  // Store initialization status
  isInitialized: boolean;
}

export interface UiActions {
  // App shell routing actions
  openLibrary: () => void;
  setReaderLoading: (novelId?: string | null, versionId?: string | null) => void;
  openNovel: (novelId: string, versionId?: string | null) => void;
  setReaderReady: () => void;
  shelveActiveNovel: () => void;

  // View mode actions
  setViewMode: (mode: 'original' | 'fan' | 'english') => void;
  handleToggleLanguage: (mode: 'original' | 'fan' | 'english') => void;
  
  // Modal actions
  setShowSettingsModal: (isOpen: boolean) => void;
  setShowExportModal: (isOpen: boolean) => void;
  setShowDebugModal: (isOpen: boolean) => void;
  
  // Loading state actions
  setFetchingState: (url: string, loading: boolean) => void;
  setTranslatingState: (loading: boolean) => void;
  setHydratingState: (chapterId: string, hydrating: boolean) => void;
  
  // Error and notification actions
  setError: (error: string | null, telemetry?: TelemetryErrorContext | null) => void;
  showNotification: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  clearNotification: () => void;
  
  // Utility actions
  clearAllLoadingStates: () => void;
  isAnyLoading: () => boolean;
  setInitialized: (initialized: boolean) => void;
}

export type UiSlice = UiState & UiActions;

// Helper to load/save viewMode from localStorage
const loadViewMode = (): 'original' | 'fan' | 'english' => {
  try {
    const saved = localStorage.getItem('LF_VIEW_MODE');
    if (saved && ['original', 'fan', 'english'].includes(saved)) {
      return saved as 'original' | 'fan' | 'english';
    }
  } catch (e) {
    console.warn('[UI] Failed to load viewMode from localStorage:', e);
  }
  // No explicit logging to avoid noisy console output during development
  return 'english'; // Default fallback
};

const saveViewMode = (mode: 'original' | 'fan' | 'english') => {
  try {
    localStorage.setItem('LF_VIEW_MODE', mode);
  } catch (e) {
    console.warn('[UI] Failed to save viewMode to localStorage:', e);
  }
};

export const createUiSlice: StateCreator<
  any,
  [],
  [],
  UiSlice
> = (set, get) => ({
  // Initial shell state
  appScreen: 'library',
  activeNovelId: null,
  activeVersionId: null,

  // Initial state - load from localStorage
  viewMode: loadViewMode(),
  showSettingsModal: false,
  showExportModal: false,
  showDebugModal: false,
  isLoading: { fetching: false, translating: false },
  error: null,
  errorTelemetry: null,
  notification: null,
  urlLoadingStates: {},
  hydratingChapters: {},
  isInitialized: false,

  // App shell routing actions
  openLibrary: () => set({
    appScreen: 'library',
    activeNovelId: null,
    activeVersionId: null,
  }),

  setReaderLoading: (novelId = null, versionId = null) => set({
    appScreen: 'reader-loading',
    activeNovelId: novelId,
    activeVersionId: versionId,
  }),

  openNovel: (novelId, versionId = null) => set({
    appScreen: 'reader-loading',
    activeNovelId: novelId,
    activeVersionId: versionId,
  }),

  setReaderReady: () => set({
    appScreen: 'reader',
  }),

  shelveActiveNovel: () => {
    const state = get() as any;
    const activeNovelId = state.activeNovelId as string | null;
    const activeVersionId = state.activeVersionId as string | null;
    const currentChapterId = state.currentChapterId as string | null;
    const chapter = currentChapterId ? state.chapters?.get?.(currentChapterId) : null;

    if (activeNovelId && currentChapterId && chapter) {
      void BookshelfStateService.upsertEntry({
        novelId: activeNovelId,
        ...(activeVersionId ? { versionId: activeVersionId } : {}),
        lastChapterId: currentChapterId,
        lastChapterNumber: chapter.chapterNumber ?? undefined,
        lastReadAtIso: new Date().toISOString(),
      }).catch((error) => {
        console.error('[UI] Failed to persist shelf bookmark while shelving active novel:', error);
      });
    }

    set({
      appScreen: 'library',
      activeNovelId: null,
      activeVersionId: null,
      currentChapterId: null,
      chapters: new Map(),
      urlIndex: new Map(),
      rawUrlIndex: new Map(),
      navigationHistory: [],
    });
  },
  
  // View mode actions
  setViewMode: (mode) => {
    saveViewMode(mode);
    set({ viewMode: mode });
  },

  handleToggleLanguage: (mode) => {
    saveViewMode(mode);
    set({ viewMode: mode });
  },
  
  // Modal actions
  setShowSettingsModal: (isOpen) => set({ showSettingsModal: isOpen }),
  
  setShowExportModal: (isOpen) => set({ showExportModal: isOpen }),
  
  setShowDebugModal: (isOpen) => set({ showDebugModal: isOpen }),
  
  // Loading state actions
  setFetchingState: (url, loading) => set(state => {
    const newUrlLoadingStates = { ...state.urlLoadingStates };
    
    if (loading) {
      newUrlLoadingStates[url] = true;
    } else {
      delete newUrlLoadingStates[url];
    }
    
    const isFetching = Object.values(newUrlLoadingStates).some(Boolean);
    
    return {
      urlLoadingStates: newUrlLoadingStates,
      isLoading: { ...state.isLoading, fetching: isFetching }
    };
  }),
  
  setTranslatingState: (loading) => set(state => ({
    isLoading: { ...state.isLoading, translating: loading }
  })),
  
  setHydratingState: (chapterId, hydrating) => set(state => {
    const newHydratingChapters = { ...state.hydratingChapters };
    
    if (hydrating) {
      newHydratingChapters[chapterId] = true;
    } else {
      delete newHydratingChapters[chapterId];
    }
    
    return { hydratingChapters: newHydratingChapters };
  }),
  
  // Error and notification actions
  setError: (error, telemetry = null) => {
    if (error) {
      console.error("An error was set in the store:", error);
      console.trace("setError stack trace");
    }
    set({
      error,
      errorTelemetry: error ? telemetry : null,
    });
  },
  
  showNotification: (message, type = 'info') => set({
    notification: {
      message,
      type,
      timestamp: Date.now()
    }
  }),
  
  clearNotification: () => set({ notification: null }),
  
  // Utility actions
  clearAllLoadingStates: () => set({
    urlLoadingStates: {},
    hydratingChapters: {},
    isLoading: { fetching: false, translating: false }
  }),
  
  setInitialized: (initialized) => set({ isInitialized: initialized }),
  
  isAnyLoading: () => {
    const state = get();
    return (
      state.isLoading.fetching ||
      state.isLoading.translating ||
      Object.values(state.urlLoadingStates).some(Boolean) ||
      Object.values(state.hydratingChapters).some(Boolean)
    );
  }
});
