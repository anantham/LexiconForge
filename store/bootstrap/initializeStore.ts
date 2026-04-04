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
import type { NovelEntry, NovelVersion } from '../../types/novel';

const bootstrapLog = (message: string, payload?: any) => {
  if (typeof payload === 'undefined') {
    console.log(`[Store:init] ${message}`);
  } else {
    console.log(`[Store:init] ${message}`, payload);
  }
};

interface BootstrapIntentResult {
  hasExplicitReaderIntent: boolean;
}

const resolveRequestedVersion = (
  novel: NovelEntry,
  versionId: string | null
): NovelVersion | null => {
  if (!versionId) {
    return null;
  }

  return novel.versions?.find((candidate) => candidate.versionId === versionId) ?? null;
};

const loadPromptTemplateState = async (ctx: BootstrapContext): Promise<void> => {
  try {
    bootstrapLog('loadPromptTemplates start');
    const { templates, activeTemplate } = await SessionManagementService.loadPromptTemplates();
    bootstrapLog('loadPromptTemplates resolved', {
      count: templates.length,
      hasActive: Boolean(activeTemplate),
    });

    if (templates.length === 0 || !activeTemplate) {
      bootstrapLog('initializeSession start (no active template)');
      const init = await SessionManagementService.initializeSession();
      bootstrapLog('initializeSession provided defaults');
      console.log('⚠️ [Bootstrap] Setting settings from initializeSession:', {
        provider: init.settings.provider,
        model: init.settings.model,
        reason: 'no active template found',
      });
      ctx.set({
        settings: init.settings,
        promptTemplates: init.promptTemplates,
        activePromptTemplate: init.activePromptTemplate,
      });
      return;
    }

    bootstrapLog('Using existing prompt templates', { count: templates.length });
    ctx.set({ promptTemplates: templates, activePromptTemplate: activeTemplate });
  } catch (e) {
    console.warn('[Store] Failed to load/initialize prompt templates:', e);
  }
};

const runBootRepairs = async (): Promise<void> => {
  try {
    bootstrapLog('ensureModelFieldsRepaired start');
    await ensureModelFieldsRepaired();
    bootstrapLog('ensureModelFieldsRepaired complete');
  } catch (e) {
    console.warn('[Store] Model field repair failed (non-fatal):', e);
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
    bootstrapLog('novelIdBackfill start');
    await MaintenanceOps.backfillNovelIds();
    bootstrapLog('novelIdBackfill complete');
  } catch (e) {
    console.warn('[Store] Novel ID backfill failed:', e);
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
};

const handleNovelIntent = async (
  ctx: BootstrapContext,
  novelId: string,
  versionId: string | null,
  options: { keepReaderLoading?: boolean } = {}
): Promise<NovelEntry | null> => {
  const { RegistryService } = await import('../../services/registryService');
  let novel: NovelEntry | null = null;

  try {
    novel = await RegistryService.fetchNovelById(novelId);
  } catch (error: any) {
    console.error('[DeepLink] Failed to resolve novel metadata:', error);
    ctx.get().openLibrary();
    ctx
      .get()
      .showNotification(`Failed to load novel metadata: ${error.message}`, 'error');
    return null;
  }

  if (!novel) {
    console.warn(`[DeepLink] Unknown novel ID: ${novelId}`);
    ctx.get().showNotification(`Unknown novel: ${novelId}`, 'error');
    return null;
  }

  const version = resolveRequestedVersion(novel, versionId);
  if (versionId && !version) {
    console.warn(`[DeepLink] Unknown version ${versionId} for novel ${novelId}`);
    ctx
      .get()
      .showNotification(`Unknown version "${versionId}" for ${novel.title}.`, 'error');
    return null;
  }

  const sessionJsonUrl = version?.sessionJsonUrl || novel.sessionJsonUrl;
  if (!sessionJsonUrl) {
    ctx
      .get()
      .showNotification(`${novel.title} is not yet available to read.`, 'error');
    return null;
  }

  console.log(`[DeepLink] Loading novel: ${novel.title}`);
  ctx.get().openNovel(novel.id, version?.versionId ?? null);
  ctx.get().showNotification(
    `Loading ${novel.title}${version ? ` (${version.displayName})` : ''}... (${novel.metadata.chapterCount} chapters)`,
    'info'
  );

  try {
    const { ImportService } = await import('../../services/importService');
    await ImportService.importFromUrl(sessionJsonUrl, undefined, {
      registryNovelId: novel.id,
      registryVersionId: version?.versionId ?? null,
    });

    if (!options.keepReaderLoading) {
      ctx.get().setReaderReady();
      ctx.get().showNotification(
        `✅ Loaded ${novel.title}${version ? ` (${version.displayName})` : ''} - ${novel.metadata.chapterCount} chapters ready!`,
        'success'
      );
    }

    return novel;
  } catch (error: any) {
    console.error('[DeepLink] Failed to load novel:', error);
    ctx.get().openLibrary();
    ctx
      .get()
      .showNotification(`Failed to load ${novel.title}: ${error.message}`, 'error');
    return null;
  }
};

const handleChapterIntent = async (
  ctx: BootstrapContext,
  chapterUrl: string,
  options: { novelId?: string | null; versionId?: string | null } = {}
): Promise<void> => {
  const decodedChapterUrl = decodeURIComponent(chapterUrl);
  ctx.get().setReaderLoading(options.novelId ?? null, options.versionId ?? null);
  await ctx.get().handleNavigate(decodedChapterUrl);

  if (ctx.get().appScreen !== 'reader') {
    ctx.get().openLibrary();
  }
};

const handleImportIntent = async (ctx: BootstrapContext, importUrl: string): Promise<void> => {
  const decodedUrl = decodeURIComponent(importUrl);
  console.log(`[DeepLink] Importing from custom URL: ${decodedUrl}`);
  ctx.get().setReaderLoading(null);
  ctx.get().showNotification('Importing session from URL...', 'info');

  try {
    const { ImportService } = await import('../../services/importService');
    await ImportService.importFromUrl(decodedUrl);
    ctx.get().setReaderReady();
    ctx.get().showNotification('✅ Session imported successfully!', 'success');
    window.history.replaceState({}, '', window.location.pathname);
  } catch (error: any) {
    console.error('[DeepLink] Failed to import from URL:', error);
    ctx.get().openLibrary();
    ctx.get().showNotification(`Import failed: ${error.message}`, 'error');
  }
};

const handleBootstrapIntents = async (
  ctx: BootstrapContext,
  urlParams: URLSearchParams
): Promise<BootstrapIntentResult> => {
  const novelId = urlParams.get('novel');
  const versionId = urlParams.get('version');
  const chapterUrl = urlParams.get('chapter');

  if (novelId) {
    const loadedNovel = await handleNovelIntent(ctx, novelId, versionId, {
      keepReaderLoading: Boolean(chapterUrl),
    });
    if (chapterUrl && loadedNovel) {
      await handleChapterIntent(ctx, chapterUrl, {
        novelId,
        versionId,
      });
    }
    return { hasExplicitReaderIntent: true };
  }

  const importUrl = urlParams.get('import');
  if (importUrl) {
    await handleImportIntent(ctx, importUrl);
    return { hasExplicitReaderIntent: true };
  }

  if (chapterUrl) {
    await handleChapterIntent(ctx, chapterUrl);
    return { hasExplicitReaderIntent: true };
  }

  return { hasExplicitReaderIntent: false };
};

const hydratePersistedState = async (
  ctx: BootstrapContext,
  options: { restoreReaderState: boolean }
): Promise<void> => {
  try {
    bootstrapLog('loadUrlMappings start');
    const currentState = ctx.get();
    if (currentState.urlIndex.size === 0 && currentState.rawUrlIndex.size === 0) {
      const mappings = await MappingsOps.getAllUrlMappings();
      if (mappings && mappings.length > 0) {
        ctx.set((state) => {
          const urlIndex = new Map(state.urlIndex);
          const rawUrlIndex = new Map(state.rawUrlIndex);
          for (const mapping of mappings) {
            if (mapping.isCanonical) {
              urlIndex.set(mapping.url, mapping.stableId);
            } else {
              rawUrlIndex.set(mapping.url, mapping.stableId);
            }
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

  if (!options.restoreReaderState) {
    bootstrapLog('persisted reader state hydration skipped (explicit startup intent)');
    return;
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
};

const initializeAudioServices = async (ctx: BootstrapContext): Promise<void> => {
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
};

export const createInitializeStore = (ctx: BootstrapContext): SessionActions['initializeStore'] => {
  return async () => {
    bootstrapLog('initializeStore – begin');
    ctx.get().setInitialized(false);
    ctx.get().openLibrary();

    try {
      // Phase 0: settings and prompt-template configuration
      ctx.get().loadSettings();
      bootstrapLog('loadSettings invoked');
      await loadPromptTemplateState(ctx);

      // Phase 1: boot repairs and compatibility backfills
      await runBootRepairs();

      // Phase 2: explicit startup intent (?novel, ?import)
      const startupIntent = await handleBootstrapIntents(
        ctx,
        new URLSearchParams(window.location.search)
      );

      // Phase 3: persisted state hydration (indexes/history/bookmark)
      await hydratePersistedState(ctx, {
        restoreReaderState: !startupIntent.hasExplicitReaderIntent,
      });

      // Phase 4: service initialization
      await initializeAudioServices(ctx);

      ctx.get().setInitialized(true);
      bootstrapLog('initializeStore complete – isInitialized true');
    } catch (error) {
      console.error('[Store] Failed to initialize:', error);
      ctx.get().setError(`Failed to initialize store: ${error}`);
    }
  };
};
