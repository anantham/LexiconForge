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
import { createBootstrapActions } from './bootstrap';
import type { AppState, SessionActions, StoreState } from './storeTypes';
import '../services/imageMigrationService'; // Import for window exposure

export type { AppState, SessionActions } from './storeTypes';

// Combined store with session management
export const useAppStore = create<StoreState>((set, get, store) => ({
  // Combine all slices
  ...createUiSlice(set, get, store),
  ...createSettingsSlice(set, get, store),
  ...createChaptersSlice(set, get, store),
  ...createTranslationsSlice(set, get, store),
  ...createImageSlice(set, get, store),
  ...createExportSlice(set, get, store),
  ...createJobsSlice(set, get, store),
  ...createAudioSlice(set, get, store),

  // Session provenance and version state
  sessionProvenance: null,
  sessionVersion: null,

  // Session provenance and version actions
  setSessionProvenance: (provenance) => set({ sessionProvenance: provenance }),
  setSessionVersion: (version) => set({ sessionVersion: version }),

  ...createBootstrapActions({ set, get, store }),
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
