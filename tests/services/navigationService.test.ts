/**
 * NavigationService Tests
 *
 * Comprehensive tests for the navigation service before decomposition.
 * Covers: URL validation, navigation handling, IDB loading, browser history.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { NavigationService, type NavigationContext, type FetchResult } from '../../services/navigationService';
import type { EnhancedChapter } from '../../services/stableIdService';
import type { TranslationRecord } from '../../services/db/types';

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockEnhancedChapter = (overrides: Partial<EnhancedChapter> = {}): EnhancedChapter => ({
  id: 'ch-test-001',
  title: 'Test Chapter',
  content: 'This is test content for the chapter.',
  originalUrl: 'https://kakuyomu.jp/works/123/episodes/456',
  canonicalUrl: 'https://kakuyomu.jp/works/123/episodes/456',
  nextUrl: 'https://kakuyomu.jp/works/123/episodes/457',
  prevUrl: null,
  chapterNumber: 1,
  sourceUrls: ['https://kakuyomu.jp/works/123/episodes/456'],
  importSource: {
    originalUrl: 'https://kakuyomu.jp/works/123/episodes/456',
    importDate: new Date(),
    sourceFormat: 'json',
  },
  translationResult: null,
  feedback: [],
  ...overrides,
});

const createMockTranslationRecord = (overrides: Partial<TranslationRecord> = {}): TranslationRecord => ({
  id: 'trans-001',
  stableId: 'ch-test-001',
  chapterUrl: 'https://kakuyomu.jp/works/123/episodes/456',
  translatedTitle: 'Translated Title',
  translation: 'This is the translated content.',
  footnotes: [],
  suggestedIllustrations: [],
  totalTokens: 100,
  promptTokens: 60,
  completionTokens: 40,
  estimatedCost: 0.001,
  requestTime: 2000,
  provider: 'Gemini',
  model: 'gemini-2.5-flash',
  temperature: 0.7,
  systemPrompt: 'Test system prompt',
  version: 1,
  isActive: true,
  createdAt: new Date().toISOString(),
  ...overrides,
});

const createNavigationContext = (overrides: Partial<NavigationContext> = {}): NavigationContext => ({
  chapters: new Map(),
  urlIndex: new Map(),
  rawUrlIndex: new Map(),
  navigationHistory: [],
  hydratingChapters: {},
  ...overrides,
});

// ============================================================================
// Mocks
// ============================================================================

// Mock adapters
vi.mock('../../services/adapters', () => ({
  fetchAndParseUrl: vi.fn(),
  isUrlSupported: vi.fn((url: string) => {
    const supported = [
      'kakuyomu.jp',
      'syosetu.com',
      'ncode.syosetu.com',
      'suttacentral.net',
      'novelupdates.com',
    ];
    try {
      const hostname = new URL(url).hostname;
      return supported.some(domain => hostname.includes(domain));
    } catch {
      return false;
    }
  }),
  getSupportedSiteInfo: vi.fn(() => [
    { domain: 'kakuyomu.jp', example: 'https://kakuyomu.jp/works/123/episodes/456' },
    { domain: 'syosetu.com', example: 'https://ncode.syosetu.com/n1234ab/1/' },
    { domain: 'suttacentral.net', example: 'https://suttacentral.net/mn1/pli/ms' },
  ]),
}));

// Mock stableIdService
vi.mock('../../services/stableIdService', () => ({
  normalizeUrlAggressively: vi.fn((url: string) => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      return `${parsed.hostname}${parsed.pathname}`.toLowerCase();
    } catch {
      return null;
    }
  }),
  transformImportedChapters: vi.fn((chapters) => ({
    chapters: new Map([['ch-new-001', createMockEnhancedChapter({ id: 'ch-new-001' })]]),
    novels: new Map(),
    urlIndex: new Map([['kakuyomu.jp/works/123/episodes/456', 'ch-new-001']]),
    rawUrlIndex: new Map([['https://kakuyomu.jp/works/123/episodes/456', 'ch-new-001']]),
    currentChapterId: 'ch-new-001',
  })),
}));

// Mock DB operations
vi.mock('../../services/db/operations', () => ({
  ChapterOps: {
    getByStableId: vi.fn(),
  },
  TranslationOps: {
    getActiveByStableId: vi.fn(),
    ensureActiveByStableId: vi.fn(),
  },
  SettingsOps: {
    set: vi.fn().mockResolvedValue(undefined),
    getKey: vi.fn().mockResolvedValue(null),
  },
  ImportOps: {
    importStableSessionData: vi.fn().mockResolvedValue(undefined),
  },
  DiffOps: {
    get: vi.fn().mockResolvedValue(null),
    findByHashes: vi.fn().mockResolvedValue(null),
  },
}));

// Mock db/index
vi.mock('../../services/db/index', () => ({
  getRepoForService: vi.fn(() => ({
    setSetting: vi.fn().mockResolvedValue(undefined),
    getUrlMappingForUrl: vi.fn().mockResolvedValue(null),
    findChapterByUrl: vi.fn().mockResolvedValue(null),
  })),
}));

// Mock telemetry
vi.mock('../../services/telemetryService', () => ({
  telemetryService: {
    capturePerformance: vi.fn(),
  },
}));

// Mock debug utilities
vi.mock('../../utils/debug', () => ({
  debugLog: vi.fn(),
}));

vi.mock('../../utils/memoryDiagnostics', () => ({
  memorySummary: vi.fn(),
  memoryDetail: vi.fn(),
  memoryTimestamp: vi.fn(() => Date.now()),
  memoryTiming: vi.fn(() => 0),
}));

vi.mock('../../services/suttaStudioDebug', () => ({
  isSuttaFlowDebug: vi.fn(() => false),
  logSuttaFlow: vi.fn(),
}));

vi.mock('../../services/diff/hash', () => ({
  computeDiffHash: vi.fn(() => 'mock-hash'),
}));

vi.mock('../../services/diff/constants', () => ({
  DIFF_ALGO_VERSION: 1,
}));

// ============================================================================
// Tests
// ============================================================================

describe('NavigationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset localStorage mock
    if (typeof window !== 'undefined') {
      vi.spyOn(window.localStorage, 'getItem').mockReturnValue(null);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // isValidUrl
  // --------------------------------------------------------------------------
  describe('isValidUrl', () => {
    it('accepts supported novel platforms', () => {
      expect(NavigationService.isValidUrl('https://kakuyomu.jp/works/123/episodes/456')).toBe(true);
      expect(NavigationService.isValidUrl('https://ncode.syosetu.com/n1234ab/1/')).toBe(true);
      expect(NavigationService.isValidUrl('https://suttacentral.net/mn1/pli/ms')).toBe(true);
    });

    it('rejects unsupported domains', () => {
      expect(NavigationService.isValidUrl('https://example.com/chapter/1')).toBe(false);
      expect(NavigationService.isValidUrl('https://google.com')).toBe(false);
    });

    it('rejects malformed URLs', () => {
      expect(NavigationService.isValidUrl('not-a-url')).toBe(false);
      expect(NavigationService.isValidUrl('')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // handleNavigate - memory hit path
  // --------------------------------------------------------------------------
  describe('handleNavigate - memory hit', () => {
    it('returns chapter from memory when already loaded', async () => {
      const chapter = createMockEnhancedChapter();
      const url = chapter.canonicalUrl;
      const normalizedUrl = 'kakuyomu.jp/works/123/episodes/456';

      const context = createNavigationContext({
        chapters: new Map([[chapter.id, chapter]]),
        urlIndex: new Map([[normalizedUrl, chapter.id]]),
        rawUrlIndex: new Map([[url, chapter.id]]),
      });

      const loadFromIDB = vi.fn();

      const result = await NavigationService.handleNavigate(url, context, loadFromIDB);

      expect(result.chapterId).toBe(chapter.id);
      expect(result.chapter).toBe(chapter);
      expect(result.shouldUpdateBrowserHistory).toBe(true);
      expect(loadFromIDB).not.toHaveBeenCalled();
    });

    it('updates navigation history when navigating to cached chapter', async () => {
      const chapter = createMockEnhancedChapter();
      const url = chapter.canonicalUrl;
      const normalizedUrl = 'kakuyomu.jp/works/123/episodes/456';

      const context = createNavigationContext({
        chapters: new Map([[chapter.id, chapter]]),
        urlIndex: new Map([[normalizedUrl, chapter.id]]),
        navigationHistory: ['other-chapter-id'],
      });

      const result = await NavigationService.handleNavigate(url, context, vi.fn());

      expect(result.navigationHistory).toContain(chapter.id);
      expect(result.navigationHistory).toContain('other-chapter-id');
    });

    it('hydrates translation if chapter in memory but missing translationResult', async () => {
      const { TranslationOps } = await import('../../services/db/operations');
      const mockTranslation = createMockTranslationRecord();
      (TranslationOps.getActiveByStableId as Mock).mockResolvedValue(mockTranslation);

      const chapter = createMockEnhancedChapter({ translationResult: null });
      const url = chapter.canonicalUrl;
      const normalizedUrl = 'kakuyomu.jp/works/123/episodes/456';

      const context = createNavigationContext({
        chapters: new Map([[chapter.id, chapter]]),
        urlIndex: new Map([[normalizedUrl, chapter.id]]),
      });

      const result = await NavigationService.handleNavigate(url, context, vi.fn());

      expect(TranslationOps.getActiveByStableId).toHaveBeenCalledWith(chapter.id);
      expect(result.chapter?.translationResult).toBeTruthy();
      expect(result.chapter?.translationResult?.translation).toBe(mockTranslation.translation);
    });
  });

  // --------------------------------------------------------------------------
  // handleNavigate - IDB hydration path
  // --------------------------------------------------------------------------
  describe('handleNavigate - IDB hydration', () => {
    it('loads chapter from IDB when mapping exists but not in memory', async () => {
      const chapter = createMockEnhancedChapter();
      const url = chapter.canonicalUrl;
      const normalizedUrl = 'kakuyomu.jp/works/123/episodes/456';

      const context = createNavigationContext({
        chapters: new Map(), // Not in memory
        urlIndex: new Map([[normalizedUrl, chapter.id]]),
      });

      const loadFromIDB = vi.fn().mockResolvedValue(chapter);

      const result = await NavigationService.handleNavigate(url, context, loadFromIDB);

      expect(loadFromIDB).toHaveBeenCalledWith(chapter.id);
      expect(result.chapterId).toBe(chapter.id);
      expect(result.chapter).toBe(chapter);
      expect(result.shouldUpdateBrowserHistory).toBe(true);
    });

    it('returns error signal when IDB hydration fails and URL unsupported', async () => {
      const chapterId = 'ch-orphan-001';
      const url = 'https://example.com/orphan-chapter';
      const normalizedUrl = 'example.com/orphan-chapter';

      const context = createNavigationContext({
        chapters: new Map(),
        urlIndex: new Map([[normalizedUrl, chapterId]]),
      });

      const loadFromIDB = vi.fn().mockResolvedValue(null);

      const result = await NavigationService.handleNavigate(url, context, loadFromIDB);

      expect(result.error).toBeTruthy();
      expect(result.error).toContain('not currently supported');
    });

    it('signals fetch needed when IDB hydration fails but URL is supported', async () => {
      const chapterId = 'ch-missing-001';
      const url = 'https://kakuyomu.jp/works/999/episodes/888';
      const normalizedUrl = 'kakuyomu.jp/works/999/episodes/888';

      const context = createNavigationContext({
        chapters: new Map(),
        urlIndex: new Map([[normalizedUrl, chapterId]]),
      });

      const loadFromIDB = vi.fn().mockResolvedValue(null);

      const result = await NavigationService.handleNavigate(url, context, loadFromIDB);

      // When fetch is needed, error is null (not undefined)
      expect(result.error).toBeNull();
      expect(result.chapterId).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // handleNavigate - no mapping path
  // --------------------------------------------------------------------------
  describe('handleNavigate - no mapping', () => {
    it('signals fetch needed for supported URL with no mapping', async () => {
      const url = 'https://kakuyomu.jp/works/new/episodes/new';

      const context = createNavigationContext();

      const result = await NavigationService.handleNavigate(url, context, vi.fn());

      expect(result.error).toBeNull();
    });

    it('returns descriptive error for unsupported URL', async () => {
      const url = 'https://unsupported-site.com/chapter/1';

      const context = createNavigationContext();

      const result = await NavigationService.handleNavigate(url, context, vi.fn());

      expect(result.error).toBeTruthy();
      expect(result.error).toContain('not currently supported');
      expect(result.error).toContain('kakuyomu.jp');
    });

    it('returns error for malformed URL', async () => {
      const url = 'not-a-valid-url';

      const context = createNavigationContext();

      const result = await NavigationService.handleNavigate(url, context, vi.fn());

      expect(result.error).toBeTruthy();
      expect(result.error).toContain('Invalid URL format');
    });
  });

  // --------------------------------------------------------------------------
  // loadChapterFromIDB
  // --------------------------------------------------------------------------
  describe('loadChapterFromIDB', () => {
    it('returns null when chapter not found in IDB', async () => {
      const { ChapterOps } = await import('../../services/db/operations');
      (ChapterOps.getByStableId as Mock).mockResolvedValue(null);

      const updateHydrating = vi.fn();
      const result = await NavigationService.loadChapterFromIDB('non-existent', updateHydrating);

      expect(result).toBeNull();
      expect(updateHydrating).toHaveBeenCalledWith('non-existent', true);
      expect(updateHydrating).toHaveBeenCalledWith('non-existent', false);
    });

    it('transforms IDB record to EnhancedChapter format', async () => {
      const { ChapterOps, TranslationOps } = await import('../../services/db/operations');

      const mockRecord = {
        stableId: 'ch-idb-001',
        title: 'IDB Chapter',
        content: 'Content from IndexedDB',
        url: 'https://kakuyomu.jp/works/123/episodes/456',
        canonicalUrl: 'https://kakuyomu.jp/works/123/episodes/456',
        originalUrl: 'https://kakuyomu.jp/works/123/episodes/456',
        nextUrl: 'https://kakuyomu.jp/works/123/episodes/457',
        prevUrl: null,
        chapterNumber: 5,
        fanTranslation: 'Fan translation text',
        dateAdded: new Date().toISOString(),
      };

      (ChapterOps.getByStableId as Mock).mockResolvedValue(mockRecord);
      (TranslationOps.ensureActiveByStableId as Mock).mockResolvedValue(null);

      const updateHydrating = vi.fn();
      const result = await NavigationService.loadChapterFromIDB('ch-idb-001', updateHydrating);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('ch-idb-001');
      expect(result?.title).toBe('IDB Chapter');
      expect(result?.content).toBe('Content from IndexedDB');
      expect(result?.chapterNumber).toBe(5);
      expect(result?.fanTranslation).toBe('Fan translation text');
    });

    it('loads and attaches active translation', async () => {
      const { ChapterOps, TranslationOps } = await import('../../services/db/operations');

      const mockRecord = {
        stableId: 'ch-with-trans',
        title: 'Chapter with Translation',
        content: 'Original content',
        url: 'https://kakuyomu.jp/works/123/episodes/456',
        canonicalUrl: 'https://kakuyomu.jp/works/123/episodes/456',
      };

      const mockTranslation = createMockTranslationRecord({
        stableId: 'ch-with-trans',
      });

      (ChapterOps.getByStableId as Mock).mockResolvedValue(mockRecord);
      (TranslationOps.ensureActiveByStableId as Mock).mockResolvedValue(mockTranslation);

      const updateHydrating = vi.fn();
      const result = await NavigationService.loadChapterFromIDB('ch-with-trans', updateHydrating);

      expect(result?.translationResult).toBeTruthy();
      expect(result?.translationResult?.translation).toBe(mockTranslation.translation);
      expect(result?.translationResult?.usageMetrics?.provider).toBe('Gemini');
    });

    it('manages hydrating state correctly even on error', async () => {
      const { ChapterOps } = await import('../../services/db/operations');
      (ChapterOps.getByStableId as Mock).mockRejectedValue(new Error('IDB error'));

      const updateHydrating = vi.fn();
      const result = await NavigationService.loadChapterFromIDB('error-chapter', updateHydrating);

      expect(result).toBeNull();
      expect(updateHydrating).toHaveBeenCalledWith('error-chapter', true);
      expect(updateHydrating).toHaveBeenCalledWith('error-chapter', false);
    });
  });

  // --------------------------------------------------------------------------
  // handleFetch
  // --------------------------------------------------------------------------
  describe('handleFetch', () => {
    it('returns error for unsupported URL', async () => {
      await expect(
        NavigationService.handleFetch('https://unsupported.com/chapter')
      ).rejects.toThrow('Unsupported source');
    });

    it('fetches and transforms chapter for supported URL', async () => {
      const { fetchAndParseUrl } = await import('../../services/adapters');

      const mockChapterData = {
        title: 'Fetched Chapter',
        content: 'Fetched content',
        originalUrl: 'https://kakuyomu.jp/works/123/episodes/456',
        nextUrl: null,
        prevUrl: null,
        chapterNumber: 1,
      };

      (fetchAndParseUrl as Mock).mockResolvedValue(mockChapterData);

      const result = await NavigationService.handleFetch('https://kakuyomu.jp/works/123/episodes/456');

      expect(result.chapters).toBeDefined();
      expect(result.currentChapterId).toBe('ch-new-001');
      expect(result.error).toBeUndefined();
    });

    it('returns error result when fetch fails', async () => {
      const { fetchAndParseUrl } = await import('../../services/adapters');
      (fetchAndParseUrl as Mock).mockRejectedValue(new Error('Network error'));

      const result = await NavigationService.handleFetch('https://kakuyomu.jp/works/123/episodes/456');

      expect(result.error).toBe('Network error');
    });

    it('deduplicates concurrent fetches for same URL', async () => {
      const { fetchAndParseUrl } = await import('../../services/adapters');

      let resolveFirst: (value: any) => void;
      const firstFetchPromise = new Promise(resolve => {
        resolveFirst = resolve;
      });

      (fetchAndParseUrl as Mock).mockImplementation(() => firstFetchPromise);

      // Start two concurrent fetches
      const fetch1 = NavigationService.handleFetch('https://kakuyomu.jp/works/123/episodes/456');
      const fetch2 = NavigationService.handleFetch('https://kakuyomu.jp/works/123/episodes/456');

      // Resolve the underlying fetch
      resolveFirst!({
        title: 'Test',
        content: 'Content',
        originalUrl: 'https://kakuyomu.jp/works/123/episodes/456',
      });

      await Promise.all([fetch1, fetch2]);

      // fetchAndParseUrl should only be called once
      expect(fetchAndParseUrl).toHaveBeenCalledTimes(1);
    });

    it('uses cache when chapter already exists in IDB', async () => {
      const { getRepoForService } = await import('../../services/db/index');
      const { ChapterOps, TranslationOps } = await import('../../services/db/operations');

      const mockRepo = {
        setSetting: vi.fn().mockResolvedValue(undefined),
        getUrlMappingForUrl: vi.fn().mockResolvedValue({ stableId: 'cached-chapter' }),
        findChapterByUrl: vi.fn().mockResolvedValue(null),
      };
      (getRepoForService as Mock).mockReturnValue(mockRepo);

      const mockRecord = {
        stableId: 'cached-chapter',
        title: 'Cached Chapter',
        content: 'Cached content',
        url: 'https://kakuyomu.jp/works/123/episodes/456',
        canonicalUrl: 'https://kakuyomu.jp/works/123/episodes/456',
      };
      (ChapterOps.getByStableId as Mock).mockResolvedValue(mockRecord);
      (TranslationOps.ensureActiveByStableId as Mock).mockResolvedValue(null);

      const result = await NavigationService.handleFetch('https://kakuyomu.jp/works/123/episodes/456');

      expect(result.currentChapterId).toBe('cached-chapter');
      // fetchAndParseUrl should NOT be called when cache hit
      const { fetchAndParseUrl } = await import('../../services/adapters');
      expect(fetchAndParseUrl).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // updateBrowserHistory
  // --------------------------------------------------------------------------
  describe('updateBrowserHistory', () => {
    let originalHistory: typeof history;
    let originalWindow: typeof window;

    beforeEach(() => {
      originalHistory = global.history;
      originalWindow = global.window;

      // Mock history.pushState
      global.history = {
        pushState: vi.fn(),
      } as any;

      // Mock window.location
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            href: 'http://localhost:3000/reader?chapter=old',
            pathname: '/reader',
            searchParams: new URLSearchParams('chapter=old'),
          },
        },
        writable: true,
      });
    });

    afterEach(() => {
      global.history = originalHistory;
      global.window = originalWindow;
    });

    it('calls history.pushState with chapter URL', () => {
      const chapter = createMockEnhancedChapter();

      NavigationService.updateBrowserHistory(chapter, chapter.id);

      expect(history.pushState).toHaveBeenCalledWith(
        { chapterId: chapter.id },
        '',
        expect.stringContaining('chapter=')
      );
    });

    it('preserves chapter param in URL', () => {
      const chapter = createMockEnhancedChapter();

      NavigationService.updateBrowserHistory(chapter, chapter.id);

      const call = (history.pushState as Mock).mock.calls[0];
      const url = call[2];
      expect(url).toContain(`chapter=${encodeURIComponent(chapter.canonicalUrl)}`);
    });
  });
});

// ============================================================================
// adaptTranslationRecordToResult (internal function - tested via loadChapterFromIDB)
// ============================================================================
describe('Translation record adaptation', () => {
  it('correctly maps all translation fields', async () => {
    const { ChapterOps, TranslationOps } = await import('../../services/db/operations');

    const mockRecord = {
      stableId: 'ch-adapt-test',
      title: 'Adapt Test',
      content: 'Content',
      url: 'https://kakuyomu.jp/works/123/episodes/456',
    };

    const mockTranslation: TranslationRecord = {
      id: 'trans-adapt-001',
      stableId: 'ch-adapt-test',
      chapterUrl: 'https://kakuyomu.jp/works/123/episodes/456',
      translatedTitle: 'Adapted Title',
      translation: 'Adapted translation content',
      proposal: {
        observation: 'Some observation',
        currentRule: 'Current rule',
        proposedChange: 'Proposed change',
        reasoning: 'Some reasoning',
      },
      footnotes: [{ marker: '1', text: 'Footnote 1' }],
      suggestedIllustrations: [{ placementMarker: 'scene-1', imagePrompt: 'Scene 1 description' }],
      totalTokens: 500,
      promptTokens: 300,
      completionTokens: 200,
      estimatedCost: 0.005,
      requestTime: 3000,
      provider: 'OpenAI',
      model: 'gpt-4o',
      temperature: 0.7,
      systemPrompt: 'Test system prompt',
      version: 2,
      customVersionLabel: 'v2-custom',
      isActive: true,
      createdAt: '2024-01-15T10:00:00Z',
      settingsSnapshot: {
        provider: 'OpenAI',
        model: 'gpt-4o',
        temperature: 0.7,
        systemPrompt: 'Test system prompt',
      },
    };

    (ChapterOps.getByStableId as Mock).mockResolvedValue(mockRecord);
    (TranslationOps.ensureActiveByStableId as Mock).mockResolvedValue(mockTranslation);

    const result = await NavigationService.loadChapterFromIDB('ch-adapt-test', vi.fn());

    expect(result?.translationResult).toMatchObject({
      translatedTitle: 'Adapted Title',
      translation: 'Adapted translation content',
      proposal: {
        observation: 'Some observation',
        currentRule: 'Current rule',
        proposedChange: 'Proposed change',
        reasoning: 'Some reasoning',
      },
      id: 'trans-adapt-001',
      version: 2,
      customVersionLabel: 'v2-custom',
      isActive: true,
      createdAt: '2024-01-15T10:00:00Z',
    });

    expect(result?.translationResult?.usageMetrics).toMatchObject({
      totalTokens: 500,
      promptTokens: 300,
      completionTokens: 200,
      estimatedCost: 0.005,
      requestTime: 3000,
      provider: 'OpenAI',
      model: 'gpt-4o',
    });

    expect(result?.translationSettingsSnapshot).toMatchObject({
      provider: 'OpenAI',
      model: 'gpt-4o',
      temperature: 0.7,
    });
  });

  it('handles missing translation fields gracefully', async () => {
    const { ChapterOps, TranslationOps } = await import('../../services/db/operations');

    const mockRecord = {
      stableId: 'ch-sparse',
      title: 'Sparse',
      content: 'Content',
      url: 'https://kakuyomu.jp/works/123/episodes/456',
    };

    // Minimal translation record (missing optional fields)
    const sparseTranslation: Partial<TranslationRecord> = {
      stableId: 'ch-sparse',
      translatedTitle: 'Sparse Title',
      translation: 'Sparse content',
      // No id, no version, no metrics
    };

    (ChapterOps.getByStableId as Mock).mockResolvedValue(mockRecord);
    (TranslationOps.ensureActiveByStableId as Mock).mockResolvedValue(sparseTranslation);

    const result = await NavigationService.loadChapterFromIDB('ch-sparse', vi.fn());

    expect(result?.translationResult).toBeTruthy();
    expect(result?.translationResult?.translation).toBe('Sparse content');
    // Should have fallback values
    expect(result?.translationResult?.usageMetrics?.totalTokens).toBe(0);
    expect(result?.translationResult?.usageMetrics?.provider).toBe('unknown');
  });
});
