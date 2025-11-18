import type { UiSlice } from './slices/uiSlice';
import type { SettingsSlice } from './slices/settingsSlice';
import type { ChaptersSlice } from './slices/chaptersSlice';
import type { TranslationsSlice } from './slices/translationsSlice';
import type { ImageSlice } from './slices/imageSlice';
import type { ExportSlice } from './slices/exportSlice';
import type { JobsSlice } from './slices/jobsSlice';
import type { AudioSlice } from './slices/audioSlice';
import type { SessionProvenance, SessionVersion } from '../types/session';

export type AppState = UiSlice &
  SettingsSlice &
  ChaptersSlice &
  TranslationsSlice &
  ImageSlice &
  ExportSlice &
  JobsSlice &
  AudioSlice;

export interface SessionActions {
  sessionProvenance: SessionProvenance | null;
  sessionVersion: SessionVersion | null;
  setSessionProvenance: (provenance: SessionProvenance | null) => void;
  setSessionVersion: (version: SessionVersion | null) => void;
  clearSession: (options?: {
    clearSettings?: boolean;
    clearPromptTemplates?: boolean;
    clearIndexedDB?: boolean;
    clearLocalStorage?: boolean;
  }) => Promise<void>;
  importSessionData: (
    payload: string | object,
    onProgress?: (
      stage: 'settings' | 'chapters' | 'translations' | 'complete',
      current: number,
      total: number,
      message: string
    ) => void
  ) => Promise<void>;
  initializeStore: () => Promise<void>;
}

export type StoreState = AppState & SessionActions;
