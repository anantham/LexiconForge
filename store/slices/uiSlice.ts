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

export interface UiState {
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
  notification: {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    timestamp: number;
  } | null;
  
  // URL-specific loading states
  urlLoadingStates: Record<string, boolean>;
  
  // Chapter-specific hydration states
  hydratingChapters: Record<string, boolean>;
}

export interface UiActions {
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
  setError: (error: string | null) => void;
  showNotification: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  clearNotification: () => void;
  
  // Utility actions
  clearAllLoadingStates: () => void;
  isAnyLoading: () => boolean;
}

export type UiSlice = UiState & UiActions;

// Helper to load/save viewMode from localStorage
const loadViewMode = (): 'original' | 'fan' | 'english' => {
  try {
    const saved = localStorage.getItem('LF_VIEW_MODE');
    if (saved && ['original', 'fan', 'english'].includes(saved)) {
      console.log(`[UI] Loaded viewMode from localStorage: ${saved}`);
      return saved as 'original' | 'fan' | 'english';
    }
  } catch (e) {
    console.warn('[UI] Failed to load viewMode from localStorage:', e);
  }
  console.log('[UI] No saved viewMode, using default: english');
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
  // Initial state - load from localStorage
  viewMode: loadViewMode(),
  showSettingsModal: false,
  showExportModal: false,
  showDebugModal: false,
  isLoading: { fetching: false, translating: false },
  error: null,
  notification: null,
  urlLoadingStates: {},
  hydratingChapters: {},
  
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
  setError: (error) => set({ error }),
  
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