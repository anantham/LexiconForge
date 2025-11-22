import { SessionManagementService } from '../../services/sessionManagementService';
import type { SessionActions, StoreState } from '../storeTypes';
import type { BootstrapContext } from './index';

const buildResetState = (state: StoreState): Partial<StoreState> => ({
  // UI slice
  viewMode: state.viewMode || ('english' as const),
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
  pendingTranslations: new Set<string>(),
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
  workers: {},

  // Session metadata
  sessionProvenance: null,
  sessionVersion: null,
});

export const createClearSession = (ctx: BootstrapContext): SessionActions['clearSession'] => {
  return async (options = {}) => {
    try {
      await SessionManagementService.clearSession(options);

      ctx.set(buildResetState(ctx.get()));

      if (!options.clearSettings) {
        await ctx.get().loadPromptTemplates();
      }

      if (typeof window !== 'undefined' && typeof window.history?.replaceState === 'function') {
        try {
          const url = new URL(window.location.href);
          if (url.searchParams.has('chapter')) {
            url.searchParams.delete('chapter');
            const search = url.searchParams.toString();
            const newHref = `${url.pathname}${search ? `?${search}` : ''}${url.hash}`;
            window.history.replaceState({}, '', newHref);
          }
        } catch (err) {
          console.warn('[Store] Failed to scrub chapter query param during clearSession:', err);
        }
      }
    } catch (error) {
      console.error('[Store] Failed to clear session:', error);
      ctx.set({ error: `Failed to clear session: ${error}` });
    }
  };
};
