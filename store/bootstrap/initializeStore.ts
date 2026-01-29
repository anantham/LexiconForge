import { SessionManagementService } from '../../services/sessionManagementService';
import { audioServiceWorker } from '../../services/audio/storage/serviceWorker';
import { debugLog } from '../../utils/debug';
import type { SessionActions } from '../storeTypes';
import type { BootstrapContext } from './index';
import {
  MaintenanceOps,
  SettingsOps,
  MappingsOps,
  NavigationOps,
} from '../../services/db/operations';
import { ensureModelFieldsRepaired } from '../../services/db/migrationService';

const bootstrapLog = (message: string, payload?: any) => {
  if (typeof payload === 'undefined') {
    console.log(`[Store:init] ${message}`);
  } else {
    console.log(`[Store:init] ${message}`, payload);
  }
};

export const createInitializeStore = (ctx: BootstrapContext): SessionActions['initializeStore'] => {
  return async () => {
    bootstrapLog('initializeStore – begin');
    ctx.get().setInitialized(false);
    try {
      ctx.get().loadSettings();
      bootstrapLog('loadSettings invoked');

      // Repair legacy translations missing model/provider fields
      try {
        bootstrapLog('ensureModelFieldsRepaired start');
        await ensureModelFieldsRepaired();
        bootstrapLog('ensureModelFieldsRepaired complete');
      } catch (e) {
        console.warn('[Store] Model field repair failed (non-fatal):', e);
      }

      try {
        bootstrapLog('loadPromptTemplates start');
        const { templates, activeTemplate } = await SessionManagementService.loadPromptTemplates();
        bootstrapLog('loadPromptTemplates resolved', { count: templates.length, hasActive: Boolean(activeTemplate) });
        if (templates.length === 0 || !activeTemplate) {
          bootstrapLog('initializeSession start (no active template)');
          const init = await SessionManagementService.initializeSession();
          bootstrapLog('initializeSession provided defaults');
          console.log('⚠️ [Bootstrap] Setting settings from initializeSession:', {
            provider: init.settings.provider,
            model: init.settings.model,
            reason: 'no active template found'
          });
          ctx.set({
            settings: init.settings,
            promptTemplates: init.promptTemplates,
            activePromptTemplate: init.activePromptTemplate,
          });
        } else {
          bootstrapLog('Using existing prompt templates', { count: templates.length });
          ctx.set({ promptTemplates: templates, activePromptTemplate: activeTemplate });
        }
      } catch (e) {
        console.warn('[Store] Failed to load/initialize prompt templates:', e);
      }

      const urlParams = new URLSearchParams(window.location.search);

      const novelId = urlParams.get('novel');
      if (novelId) {
        const { getNovelById } = await import('../../config/novelCatalog');
        const novel = getNovelById(novelId);

        if (novel) {
          console.log(`[DeepLink] Loading novel: ${novel.title}`);

          ctx.get().showNotification(`Loading ${novel.title}... (${novel.metadata.chapterCount} chapters)`, 'info');

          try {
            const { ImportService } = await import('../../services/importService');
            await ImportService.importFromUrl(novel.sessionJsonUrl);

            ctx.get().showNotification(`✅ Loaded ${novel.title} - ${novel.metadata.chapterCount} chapters ready!`, 'success');

            window.history.replaceState({}, '', window.location.pathname);
          } catch (error: any) {
            console.error('[DeepLink] Failed to load novel:', error);
            ctx.get().showNotification(`Failed to load ${novel.title}: ${error.message}`, 'error');
          }
        } else {
          console.warn(`[DeepLink] Unknown novel ID: ${novelId}`);
          ctx.get().showNotification(`Unknown novel: ${novelId}`, 'error');
        }
      }

      const importUrl = urlParams.get('import');
      if (importUrl && !novelId) {
        const decodedUrl = decodeURIComponent(importUrl);
        console.log(`[DeepLink] Importing from custom URL: ${decodedUrl}`);

        ctx.get().showNotification('Importing session from URL...', 'info');

        try {
          const { ImportService } = await import('../../services/importService');
          await ImportService.importFromUrl(decodedUrl);

          ctx.get().showNotification('✅ Session imported successfully!', 'success');

          window.history.replaceState({}, '', window.location.pathname);
        } catch (error: any) {
          console.error('[DeepLink] Failed to import from URL:', error);
          ctx.get().showNotification(`Import failed: ${error.message}`, 'error');
        }
      }

      try {
        bootstrapLog('urlMappingsBackfill start');
        await MaintenanceOps.backfillUrlMappingsFromChapters();
        bootstrapLog('urlMappingsBackfill complete');
      } catch (e) {
        console.warn('[Store] Failed to backfill URL mappings:', e);
      }

      try {
        bootstrapLog('normalizeStableIds start');
        await MaintenanceOps.normalizeStableIds();
        bootstrapLog('normalizeStableIds complete');
      } catch (e) {
        console.warn('[Store] StableId normalization failed:', e);
      }

      try {
        bootstrapLog('backfillActiveTranslations start');
        await MaintenanceOps.backfillActiveTranslations();
        bootstrapLog('backfillActiveTranslations complete');
      } catch (e) {
        console.warn('[Store] Active translations backfill failed:', e);
      }

      try {
        bootstrapLog('translationMetadataBackfill start');
        await MaintenanceOps.backfillTranslationMetadata();
        bootstrapLog('translationMetadataBackfill complete');
      } catch (e) {
        console.warn('[Store] Translation metadata backfill failed:', e);
      }

      try {
        bootstrapLog('chapterNumbersBackfill check');
        const chapterNumbersBackfilled = await SettingsOps.getKey<boolean>('chapterNumbersBackfilled');
        if (!chapterNumbersBackfilled) {
          const { backfillChapterNumbers } = await import('../../scripts/backfillChapterNumbers');
          bootstrapLog('chapterNumbersBackfill start');
          await backfillChapterNumbers();
          await SettingsOps.set('chapterNumbersBackfilled', true);
          bootstrapLog('chapterNumbersBackfill complete');
        } else {
          bootstrapLog('chapterNumbersBackfill skipped (already complete)');
        }
      } catch (e) {
        console.warn('[Store] Chapter numbers backfill failed:', e);
      }

      try {
        bootstrapLog('loadUrlMappings start');
        const currentState = ctx.get();
        if (currentState.urlIndex.size === 0 && currentState.rawUrlIndex.size === 0) {
          const mappings = await MappingsOps.getAllUrlMappings();
          if (mappings && mappings.length > 0) {
            ctx.set((state) => {
              const urlIndex = new Map(state.urlIndex);
              const rawUrlIndex = new Map(state.rawUrlIndex);
              for (const m of mappings) {
                if (m.isCanonical) urlIndex.set(m.url, m.stableId);
                else rawUrlIndex.set(m.url, m.stableId);
              }
              return { urlIndex, rawUrlIndex };
            });
            bootstrapLog('loadUrlMappings hydrated', { count: mappings.length });
          } else {
            bootstrapLog('loadUrlMappings skipped (none found)');
          }
        } else {
          bootstrapLog('loadUrlMappings skipped (indexes already populated)', {
            urlIndexSize: currentState.urlIndex.size,
            rawUrlIndexSize: currentState.rawUrlIndex.size,
          });
        }
      } catch (e) {
        console.warn('[Store] Failed to load URL mappings:', e);
      }

      try {
        bootstrapLog('loadNavigationHistory start');
        const historyData = await NavigationOps.getHistory();
        if (historyData?.stableIds && Array.isArray(historyData.stableIds)) {
          ctx.set({ navigationHistory: historyData.stableIds });
          bootstrapLog('loadNavigationHistory complete', { count: historyData.stableIds.length });
        } else {
          bootstrapLog('loadNavigationHistory skipped (none stored)');
        }
      } catch (e) {
        console.warn('[Store] Failed to load navigation history:', e);
      }

      try {
        bootstrapLog('loadLastActiveChapter start');
        const lastChapterData = await NavigationOps.getLastActiveChapter();

        if (lastChapterData?.id) {
          const currentState = ctx.get();

          ctx.set((state) => ({
            currentChapterId: state.currentChapterId || lastChapterData.id,
          }));

          if (!currentState.chapters.has(lastChapterData.id)) {
            ctx
              .get()
              .loadChapterFromIDB(lastChapterData.id)
              .then(() => {
                // no-op, logging handled elsewhere
              })
              .catch((e) => {
                console.error(`[Store] Failed to load chapter ${lastChapterData.id} from IDB:`, e);
              });
          }
          bootstrapLog('loadLastActiveChapter complete', { chapterId: lastChapterData.id });
        } else {
          bootstrapLog('loadLastActiveChapter skipped (none stored)');
        }
      } catch (e) {
        console.warn('[Store] Failed to load last active chapter:', e);
      }

      try {
        bootstrapLog('audio initialization start');
        const settings = ctx.get().settings;
        ctx.get().initializeAudioService(settings);
        await audioServiceWorker.register();
        debugLog('audio', 'summary', '[Store] Audio services initialized');
        bootstrapLog('audio initialization complete');
      } catch (e) {
        console.warn('[Store] Failed to initialize audio services:', e);
      }

      ctx.get().setInitialized(true);
      bootstrapLog('initializeStore complete – isInitialized true');
    } catch (error) {
      console.error('[Store] Failed to initialize:', error);
      ctx.get().setError(`Failed to initialize store: ${error}`);
    }
  };
};
