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

// ---------------------------------------------------------------------------
// Boot telemetry — captures wall-clock timing for every init step.
// Results are written to localStorage('boot-telemetry') as JSON so they
// survive page reloads and can be inspected offline.
// ---------------------------------------------------------------------------
interface BootMark {
  label: string;
  ts: number;        // absolute timestamp (ms)
  delta: number;     // ms since previous mark
  elapsed: number;   // ms since boot start
  payload?: any;
}

let bootMarks: BootMark[] = [];
let bootStart = 0;
let lastMark = 0;

/** Reset telemetry state at the start of each init run (INV: per-run state) */
const resetBootTelemetry = () => {
  bootMarks = [];
  bootStart = 0;
  lastMark = 0;
};

const bootstrapLog = (message: string, payload?: any) => {
  const now = performance.now();
  if (bootMarks.length === 0) {
    bootStart = now;
    lastMark = now;
  }
  const delta = Math.round(now - lastMark);
  const elapsed = Math.round(now - bootStart);
  lastMark = now;

  bootMarks.push({ label: message, ts: now, delta, elapsed, payload });

  const prefix = `[Store:init +${elapsed}ms Δ${delta}ms]`;
  if (typeof payload === 'undefined') {
    console.log(`${prefix} ${message}`);
  } else {
    console.log(`${prefix} ${message}`, payload);
  }
};

const flushBootTelemetry = () => {
  // Console table
  console.group('[Boot Telemetry] Initialization breakdown');
  console.table(
    bootMarks.map(m => ({
      step: m.label,
      'delta (ms)': m.delta,
      'elapsed (ms)': m.elapsed,
    }))
  );
  const total = bootMarks.length > 0 ? bootMarks[bootMarks.length - 1].elapsed : 0;
  console.log(`Total init time: ${total}ms`);
  console.groupEnd();

  // Persist to localStorage for offline analysis
  try {
    const history = JSON.parse(localStorage.getItem('boot-telemetry-history') || '[]');
    history.push({
      timestamp: new Date().toISOString(),
      totalMs: total,
      marks: bootMarks.map(m => ({
        step: m.label,
        deltaMs: m.delta,
        elapsedMs: m.elapsed,
        ...(m.payload ? { payload: m.payload } : {}),
      })),
    });
    // Keep last 10 boots
    if (history.length > 10) history.splice(0, history.length - 10);
    localStorage.setItem('boot-telemetry-history', JSON.stringify(history));
  } catch {
    // localStorage full or unavailable — ignore
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
  bootstrapLog('bootRepairs start');

  const repairs: Array<{ name: string; fn: () => Promise<void> }> = [
    { name: 'ensureModelFieldsRepaired', fn: () => ensureModelFieldsRepaired() },
    { name: 'urlMappingsBackfill', fn: () => MaintenanceOps.backfillUrlMappingsFromChapters() },
    { name: 'normalizeStableIds', fn: () => MaintenanceOps.normalizeStableIds() },
    { name: 'backfillActiveTranslations', fn: () => MaintenanceOps.backfillActiveTranslations() },
    { name: 'translationMetadataBackfill', fn: () => MaintenanceOps.backfillTranslationMetadata() },
    { name: 'novelIdBackfill', fn: () => MaintenanceOps.backfillNovelIds() },
  ];

  for (const { name, fn } of repairs) {
    try {
      bootstrapLog(`${name} start`);
      await fn();
      bootstrapLog(`${name} done`);
    } catch (e) {
      bootstrapLog(`${name} failed (non-fatal)`);
      console.warn(`[Store] ${name} failed:`, e);
    }
  }

  try {
    bootstrapLog('chapterNumbersBackfill check');
    const chapterNumbersBackfilled = await SettingsOps.getKey<boolean>('chapterNumbersBackfilled');
    if (!chapterNumbersBackfilled) {
      const { backfillChapterNumbers } = await import('../../scripts/backfillChapterNumbers');
      bootstrapLog('chapterNumbersBackfill start');
      await backfillChapterNumbers();
      await SettingsOps.set('chapterNumbersBackfilled', true);
      bootstrapLog('chapterNumbersBackfill done');
    } else {
      bootstrapLog('chapterNumbersBackfill skipped');
    }
  } catch (e) {
    bootstrapLog('chapterNumbersBackfill failed (non-fatal)');
    console.warn('[Store] Chapter numbers backfill failed:', e);
  }

  bootstrapLog('bootRepairs complete');
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
    // Idempotency guard — prevents StrictMode double-init in dev
    if (ctx.get().isInitialized) {
      bootstrapLog('initializeStore – skipped (already initialized)');
      return;
    }
    resetBootTelemetry();
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
      flushBootTelemetry();
    } catch (error) {
      console.error('[Store] Failed to initialize:', error);
      ctx.get().setError(`Failed to initialize store: ${error}`);
      flushBootTelemetry();
    }
  };
};
