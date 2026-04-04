import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createClearSession } from '../../../store/bootstrap/clearSession';
import { createImportSessionData } from '../../../store/bootstrap/importSessionData';
import { createInitializeStore } from '../../../store/bootstrap/initializeStore';
import type { BootstrapContext } from '../../../store/bootstrap';
import type { StoreState } from '../../../store/storeTypes';
import type { AppSettings } from '../../../types';

const maintenanceOpsMock = vi.hoisted(() => ({
  backfillUrlMappingsFromChapters: vi.fn().mockResolvedValue(undefined),
  normalizeStableIds: vi.fn().mockResolvedValue(undefined),
  backfillActiveTranslations: vi.fn().mockResolvedValue(undefined),
  backfillTranslationMetadata: vi.fn().mockResolvedValue(undefined),
  backfillNovelIds: vi.fn().mockResolvedValue(undefined),
}));

const settingsOpsMock = vi.hoisted(() => ({
  getKey: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
}));

const mappingsOpsMock = vi.hoisted(() => ({
  getAllUrlMappings: vi.fn().mockResolvedValue([]),
}));

const navigationOpsMock = vi.hoisted(() => ({
  getHistory: vi.fn().mockResolvedValue(null),
  getLastActiveChapter: vi.fn().mockResolvedValue(null),
}));

const importOpsMock = vi.hoisted(() => ({
  importFullSessionData: vi.fn().mockResolvedValue(undefined),
}));

const renderingOpsMock = vi.hoisted(() => ({
  getChaptersForReactRendering: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../services/db/operations', async () => {
  const actual = await vi.importActual<typeof import('../../../services/db/operations')>(
    '../../../services/db/operations'
  );
  return {
    ...actual,
    MaintenanceOps: maintenanceOpsMock,
    SettingsOps: settingsOpsMock,
    MappingsOps: mappingsOpsMock,
    NavigationOps: navigationOpsMock,
    ImportOps: importOpsMock,
  };
});

vi.mock('../../../services/db/operations/rendering', async () => {
  const actual = await vi.importActual<typeof import('../../../services/db/operations/rendering')>(
    '../../../services/db/operations/rendering'
  );
  return {
    ...actual,
    fetchChaptersForReactRendering: renderingOpsMock.getChaptersForReactRendering,
  };
});

const sessionServiceMock = vi.hoisted(() => ({
  clearSession: vi.fn().mockResolvedValue(undefined),
  loadSettings: vi.fn(() => ({
    provider: 'Gemini',
    model: 'gemini-pro',
  })),
  loadPromptTemplates: vi.fn().mockResolvedValue({
    templates: [],
    activeTemplate: null,
  }),
  initializeSession: vi.fn().mockResolvedValue({
    settings: { provider: 'Gemini', model: 'gemini-2.0' },
    promptTemplates: [
      { id: 'default', name: 'Default', systemPrompt: 'You are helpful', createdAt: '2024-01-01T00:00:00Z' },
    ],
    activePromptTemplate: { id: 'default', name: 'Default', systemPrompt: 'You are helpful', createdAt: '2024-01-01T00:00:00Z' },
  }),
}));

vi.mock('../../../services/sessionManagementService', () => ({
  SessionManagementService: sessionServiceMock,
}));

const audioWorkerMock = vi.hoisted(() => ({
  register: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/audio/storage/serviceWorker', () => ({
  audioServiceWorker: audioWorkerMock,
}));

vi.mock('../../../utils/debug', () => ({
  debugLog: vi.fn(),
  debugPipelineEnabled: vi.fn(() => false),
  debugWarn: vi.fn(),
}));

vi.mock('../../../scripts/backfillChapterNumbers', () => ({
  backfillChapterNumbers: vi.fn().mockResolvedValue(undefined),
}));

const registryServiceMock = vi.hoisted(() => ({
  fetchNovelById: vi.fn(),
}));

vi.mock('../../../services/registryService', () => ({
  RegistryService: registryServiceMock,
}));

const importServiceMock = vi.hoisted(() => ({
  importFromUrl: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/importService', () => ({
  ImportService: importServiceMock,
}));

const baseSettings: AppSettings = {
  contextDepth: 2,
  preloadCount: 0,
  fontSize: 16,
  fontStyle: 'serif',
  lineHeight: 1.6,
  systemPrompt: 'system',
  provider: 'Gemini',
  model: 'gemini-pro',
  imageModel: 'imagen-3.0',
  temperature: 0.6,
};

const createState = (overrides: Partial<StoreState> = {}): StoreState => {
  const state: Partial<StoreState> = {
    appScreen: 'library',
    activeNovelId: null,
    activeVersionId: null,
    viewMode: 'fan',
    loadPromptTemplates: vi.fn().mockResolvedValue(undefined),
    setError: vi.fn(),
    showNotification: vi.fn(),
    loadSettings: vi.fn(),
    setInitialized: vi.fn(),
    initializeAudioService: vi.fn(),
    loadChapterFromIDB: vi.fn().mockResolvedValue(undefined),
    settings: baseSettings,
    promptTemplates: [],
    activePromptTemplate: null,
    settingsLoaded: false,
    settingsError: null,
    chapters: new Map(),
    urlIndex: new Map(),
    rawUrlIndex: new Map(),
    navigationHistory: [],
    currentChapterId: null,
    handleNavigate: vi.fn().mockResolvedValue(undefined),
    pendingTranslations: new Set<string>(),
    sessionProvenance: null,
    sessionVersion: null,
    ...overrides,
  };
  return state as StoreState;
};

const createCtx = (state: StoreState): { state: StoreState; ctx: BootstrapContext } => {
  const set = (update: any) => {
    const next = typeof update === 'function' ? update(state) : update;
    if (next && typeof next === 'object') {
      Object.assign(state, next);
    }
  };
  const get = () => state;
  state.openLibrary = vi.fn(() => {
    state.appScreen = 'library';
    state.activeNovelId = null;
    state.activeVersionId = null;
  });
  state.setReaderLoading = vi.fn((novelId?: string | null, versionId?: string | null) => {
    state.appScreen = 'reader-loading';
    state.activeNovelId = novelId ?? null;
    state.activeVersionId = versionId ?? null;
  });
  state.openNovel = vi.fn((novelId: string, versionId?: string | null) => {
    state.appScreen = 'reader-loading';
    state.activeNovelId = novelId;
    state.activeVersionId = versionId ?? null;
  });
  state.setReaderReady = vi.fn(() => {
    state.appScreen = 'reader';
  });
  state.shelveActiveNovel = vi.fn(() => {
    state.appScreen = 'library';
    state.activeNovelId = null;
    state.activeVersionId = null;
  });
  return {
    state,
    ctx: {
      set,
      get,
      store: {
        setState: set,
        getState: get,
        subscribe: () => () => {},
        destroy: () => {},
      } as any,
    },
  };
};

const setWindowLocation = (search = '') => {
  const history = { replaceState: vi.fn() };
  (globalThis as any).window = {
    location: {
      href: `https://lexiconforge.test/app${search}`,
      search,
      pathname: '/app',
      hash: '',
    },
    history,
  };
  return history;
};

describe('bootstrap helpers', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.clearAllMocks();
    setWindowLocation('');
    settingsOpsMock.getKey.mockReset();
    settingsOpsMock.getKey.mockResolvedValue(null);
    settingsOpsMock.set.mockReset();
    mappingsOpsMock.getAllUrlMappings.mockReset();
    mappingsOpsMock.getAllUrlMappings.mockResolvedValue([]);
    maintenanceOpsMock.backfillUrlMappingsFromChapters.mockReset();
    maintenanceOpsMock.normalizeStableIds.mockReset();
    maintenanceOpsMock.backfillActiveTranslations.mockReset();
    maintenanceOpsMock.backfillTranslationMetadata.mockReset();
    maintenanceOpsMock.backfillNovelIds.mockReset();
    importOpsMock.importFullSessionData.mockReset();
    renderingOpsMock.getChaptersForReactRendering.mockReset();
    renderingOpsMock.getChaptersForReactRendering.mockResolvedValue([]);
    navigationOpsMock.getHistory.mockReset();
    navigationOpsMock.getHistory.mockResolvedValue(null);
    navigationOpsMock.getLastActiveChapter.mockReset();
    navigationOpsMock.getLastActiveChapter.mockResolvedValue(null);
    registryServiceMock.fetchNovelById.mockReset();
    importServiceMock.importFromUrl.mockReset();
    importServiceMock.importFromUrl.mockResolvedValue(undefined);
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
  });

  describe('createClearSession', () => {
    it('resets store slices and reloads prompt templates', async () => {
      const history = setWindowLocation('?chapter=foo');
      const { ctx, state } = createCtx(
        createState({
          viewMode: 'fan',
          showSettingsModal: true,
          sessionProvenance: { originalCreator: { name: 'Alice', versionId: 'v1', createdAt: '2024-01-01' }, contributors: [] },
          sessionVersion: { versionId: 'v1', displayName: 'v1', style: 'faithful', features: [] },
        })
      );

      const clearSession = createClearSession(ctx);
      await clearSession();

      expect(sessionServiceMock.clearSession).toHaveBeenCalled();
      expect(state.showSettingsModal).toBe(false);
      expect(state.sessionProvenance).toBeNull();
      expect(state.sessionVersion).toBeNull();
      expect(state.appScreen).toBe('library');
      expect(state.activeNovelId).toBeNull();
      expect(state.viewMode).toBe('fan');
      expect(state.chapters instanceof Map).toBe(true);
      expect(state.loadPromptTemplates).toHaveBeenCalledTimes(1);
      expect(history.replaceState).toHaveBeenCalledWith({}, '', '/app');
    });

    it('skips prompt template reload when settings cleared', async () => {
      const { ctx, state } = createCtx(createState());
      const clearSession = createClearSession(ctx);
      await clearSession({ clearSettings: true });
      expect(state.loadPromptTemplates).not.toHaveBeenCalled();
    });

    it('captures errors and sets error message', async () => {
      sessionServiceMock.clearSession.mockRejectedValueOnce(new Error('boom'));
      const { ctx, state } = createCtx(createState());
      const clearSession = createClearSession(ctx);
      await clearSession();
      expect(state.error).toContain('boom');
    });
  });

  describe('createImportSessionData', () => {
    it('hydrates chapters from full session payload', async () => {
      renderingOpsMock.getChaptersForReactRendering.mockResolvedValueOnce([
        {
          stableId: 'ch-1',
          title: 'Title',
          content: '<p>Text</p>',
          originalUrl: 'https://example.com/1',
          url: 'https://example.com/1',
          sourceUrls: ['https://example.com/1'],
          chapterNumber: 1,
        },
      ]);
      settingsOpsMock.getKey.mockImplementation(async (key: string) => {
        if (key === 'navigation-history') return { stableIds: ['ch-1'] };
        if (key === 'lastActiveChapter') return { id: 'ch-1' };
        return null;
      });

      const { ctx, state } = createCtx(createState());
      const importSessionData = createImportSessionData(ctx);
      await importSessionData(
        JSON.stringify({
          metadata: { format: 'lexiconforge-full-1' },
        })
      );

      expect(importOpsMock.importFullSessionData).toHaveBeenCalled();
      expect(state.chapters.size).toBe(1);
      expect(state.currentChapterId).toBe('ch-1');
      expect(state.navigationHistory).toEqual(['ch-1']);
      expect(state.setError).not.toHaveBeenCalled();
    });

    it('throws and sets error for unsupported formats', async () => {
      const { ctx, state } = createCtx(createState());
      const importSessionData = createImportSessionData(ctx);
      await expect(importSessionData(JSON.stringify({ metadata: { format: 'something-else' } }))).rejects.toThrow('Unsupported import format');
      expect(state.setError).toHaveBeenCalledWith(expect.stringContaining('Unsupported import format'));
    });

    it('converts lexiconforge-session format and imports successfully', async () => {
      renderingOpsMock.getChaptersForReactRendering.mockResolvedValueOnce([
        {
          stableId: 'ch-1',
          title: 'Chapter 1',
          content: '<p>Content</p>',
          originalUrl: 'https://example.com/ch1',
          url: 'https://example.com/ch1',
          sourceUrls: ['https://example.com/ch1'],
          chapterNumber: 1,
        },
      ]);
      settingsOpsMock.getKey.mockResolvedValue(null);

      const { ctx } = createCtx(createState());
      const importSessionData = createImportSessionData(ctx);
      await importSessionData(JSON.stringify({
        metadata: { format: 'lexiconforge-session', version: '2.0', exportedAt: '2026-04-01T00:00:00Z' },
        novel: { id: 'test-novel', title: 'Test Novel' },
        version: { versionId: 'v1', displayName: 'V1' },
        chapters: [
          {
            stableId: 'ch-1',
            canonicalUrl: 'https://example.com/ch1',
            title: 'Chapter 1',
            content: '<p>Content</p>',
            chapterNumber: 1,
            translations: [{ id: 't-1', translatedTitle: 'Ch 1', translation: '<p>Translated</p>', version: 1, isActive: true }],
          },
        ],
        settings: {},
      }));

      // Should have converted format and called importFullSessionData
      expect(importOpsMock.importFullSessionData).toHaveBeenCalled();
      const importedPayload = importOpsMock.importFullSessionData.mock.calls[0][0];
      expect(importedPayload.metadata.format).toBe('lexiconforge-full-1');
      expect(importedPayload.novels).toHaveLength(1);
      expect(importedPayload.novels[0].id).toBe('test-novel');
      expect(importedPayload.urlMappings).toHaveLength(1);
      expect(importedPayload.urlMappings[0].url).toBe('https://example.com/ch1');
    });
  });

  describe('createInitializeStore', () => {
    it('loads settings, bootstraps templates, and marks store initialized', async () => {
      const { ctx, state } = createCtx(
        createState({
          urlIndex: new Map(),
          rawUrlIndex: new Map(),
          navigationHistory: [],
          chapters: new Map(),
        })
      );
      const initializeStore = createInitializeStore(ctx);
      settingsOpsMock.getKey.mockResolvedValue(null);
      await initializeStore();

      expect(state.loadSettings).toHaveBeenCalled();
      expect(sessionServiceMock.loadPromptTemplates).toHaveBeenCalled();
      expect(sessionServiceMock.initializeSession).toHaveBeenCalled();
      expect(Array.isArray(state.promptTemplates)).toBe(true);
      expect(state.activePromptTemplate?.id).toBe('default');
      expect(state.settings?.model).toBe('gemini-2.0');
      expect(state.appScreen).toBe('library');
      expect(state.setInitialized).toHaveBeenCalledWith(true);
      expect(audioWorkerMock.register).toHaveBeenCalled();
    });

    it('reuses existing prompt templates without reinitializing session', async () => {
      sessionServiceMock.loadPromptTemplates.mockResolvedValueOnce({
        templates: [
          { id: 'existing', name: 'Existing', systemPrompt: 'Prompt', createdAt: '2024-01-01T00:00:00Z' },
        ],
        activeTemplate: { id: 'existing', name: 'Existing', systemPrompt: 'Prompt', createdAt: '2024-01-01T00:00:00Z' },
      });
      const { ctx, state } = createCtx(createState());
      const initializeStore = createInitializeStore(ctx);
      settingsOpsMock.getKey.mockResolvedValue(null);

      await initializeStore();

      expect(sessionServiceMock.initializeSession).not.toHaveBeenCalled();
      expect(state.promptTemplates).toHaveLength(1);
      expect(state.activePromptTemplate?.id).toBe('existing');
      expect(state.appScreen).toBe('library');
      expect(state.setInitialized).toHaveBeenCalledWith(true);
    });

    it('still marks store initialized when optional backfills fail', async () => {
      settingsOpsMock.getKey.mockImplementation(async (key: string) => {
        if (key === 'urlMappingsBackfilled') return false;
        if (key === 'stableIdNormalized') return false;
        if (key === 'activeTranslationsBackfilledV2') return false;
        if (key === 'chapterNumbersBackfilled') return false;
        return null;
      });
      maintenanceOpsMock.backfillUrlMappingsFromChapters.mockRejectedValueOnce(new Error('url-fail'));
      maintenanceOpsMock.normalizeStableIds.mockRejectedValueOnce(new Error('stable-fail'));
      maintenanceOpsMock.backfillActiveTranslations.mockRejectedValueOnce(new Error('active-fail'));

      const { ctx, state } = createCtx(createState());
      const initializeStore = createInitializeStore(ctx);

      await initializeStore();

      expect(state.appScreen).toBe('library');
      expect(state.setInitialized).toHaveBeenCalledWith(true);
    });

    it('does not restore passive last-active state when a deep-link novel intent is present', async () => {
      setWindowLocation('?novel=orv');
      registryServiceMock.fetchNovelById.mockResolvedValue({
        id: 'orv',
        title: 'Omniscient Reader',
        sessionJsonUrl: 'https://example.com/orv/session.json',
        metadata: { chapterCount: 551 },
      });
      navigationOpsMock.getLastActiveChapter.mockResolvedValue({ id: 'old-bookmark' });

      const { ctx, state } = createCtx(createState());
      const initializeStore = createInitializeStore(ctx);

      await initializeStore();

      expect(importServiceMock.importFromUrl).toHaveBeenCalledWith(
        'https://example.com/orv/session.json',
        undefined,
        { registryNovelId: 'orv', registryVersionId: null }
      );
      expect(state.openNovel).toHaveBeenCalledWith('orv', null);
      expect(state.setReaderReady).toHaveBeenCalled();
      expect(state.currentChapterId).toBeNull();
      expect(state.loadChapterFromIDB).not.toHaveBeenCalled();
    });

    it('treats chapter-only deep links as explicit reader intent and does not restore passive bookmarks', async () => {
      setWindowLocation('?chapter=' + encodeURIComponent('https://booktoki468.com/novel/3912084'));
      navigationOpsMock.getLastActiveChapter.mockResolvedValue({ id: 'old-bookmark' });

      const { ctx, state } = createCtx(createState());
      const initializeStore = createInitializeStore(ctx);

      await initializeStore();

      expect(state.handleNavigate).toHaveBeenCalledWith('https://booktoki468.com/novel/3912084');
      expect(state.setReaderLoading).toHaveBeenCalledWith(null, null);
      expect(state.loadChapterFromIDB).not.toHaveBeenCalled();
    });

    it('loads the requested novel version before navigating to the deep-linked chapter', async () => {
      setWindowLocation(
        '?novel=orv&version=v2&chapter=' +
          encodeURIComponent('https://booktoki468.com/novel/3912084')
      );
      registryServiceMock.fetchNovelById.mockResolvedValue({
        id: 'orv',
        title: 'Omniscient Reader',
        metadata: { chapterCount: 551 },
        versions: [
          {
            versionId: 'v1',
            displayName: 'V1',
            translator: { name: 'A' },
            sessionJsonUrl: 'https://example.com/orv-v1/session.json',
            targetLanguage: 'English',
            style: 'faithful',
            features: [],
            chapterRange: { from: 1, to: 551 },
            completionStatus: 'Complete',
            lastUpdated: '2026-03-29',
            stats: {
              downloads: 1,
              fileSize: '1 MB',
              content: {
                totalImages: 0,
                totalFootnotes: 0,
                totalRawChapters: 551,
                totalTranslatedChapters: 551,
                avgImagesPerChapter: 0,
                avgFootnotesPerChapter: 0,
              },
              translation: {
                translationType: 'human',
                feedbackCount: 0,
              },
            },
          },
          {
            versionId: 'v2',
            displayName: 'V2',
            translator: { name: 'B' },
            sessionJsonUrl: 'https://example.com/orv-v2/session.json',
            targetLanguage: 'English',
            style: 'faithful',
            features: [],
            chapterRange: { from: 1, to: 551 },
            completionStatus: 'Complete',
            lastUpdated: '2026-03-29',
            stats: {
              downloads: 1,
              fileSize: '1 MB',
              content: {
                totalImages: 0,
                totalFootnotes: 0,
                totalRawChapters: 551,
                totalTranslatedChapters: 551,
                avgImagesPerChapter: 0,
                avgFootnotesPerChapter: 0,
              },
              translation: {
                translationType: 'human',
                feedbackCount: 0,
              },
            },
          },
        ],
      });
      const { ctx, state } = createCtx(createState());
      state.handleNavigate = vi.fn().mockImplementation(async () => {
        state.appScreen = 'reader';
        state.currentChapterId = 'ch-target';
      });

      const initializeStore = createInitializeStore(ctx);
      await initializeStore();

      expect(importServiceMock.importFromUrl).toHaveBeenCalledWith(
        'https://example.com/orv-v2/session.json',
        undefined,
        { registryNovelId: 'orv', registryVersionId: 'v2' }
      );
      expect(state.openNovel).toHaveBeenCalledWith('orv', 'v2');
      expect(state.handleNavigate).toHaveBeenCalledWith('https://booktoki468.com/novel/3912084');
      expect(state.setReaderReady).not.toHaveBeenCalled();
    });
  });
});
