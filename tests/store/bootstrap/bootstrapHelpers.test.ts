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
}));

const settingsOpsMock = vi.hoisted(() => ({
  getKey: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
}));

const mappingsOpsMock = vi.hoisted(() => ({
  getAllUrlMappings: vi.fn().mockResolvedValue([]),
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
    importOpsMock.importFullSessionData.mockReset();
    renderingOpsMock.getChaptersForReactRendering.mockReset();
    renderingOpsMock.getChaptersForReactRendering.mockResolvedValue([]);
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
      await expect(importSessionData(JSON.stringify({ metadata: { format: 'legacy' } }))).rejects.toThrow();
      expect(state.setError).toHaveBeenCalledWith(expect.stringContaining('Legacy'));
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

      expect(state.setInitialized).toHaveBeenCalledWith(true);
    });
  });
});
