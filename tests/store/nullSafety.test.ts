import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAppStore } from '../../store';
import { NavigationService } from '../../services/navigationService';
import { defaultSettings } from '../../services/sessionManagementService';
import type { EnhancedChapter } from '../../services/stableIdService';
import type { TranslationResult } from '../../types';

const makeTranslationResult = (overrides: Partial<TranslationResult> = {}): TranslationResult => ({
  translatedTitle: 'Translated Title',
  translation: 'Translated content',
  proposal: null,
  footnotes: [],
  suggestedIllustrations: [],
  usageMetrics: {
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    estimatedCost: 0,
    requestTime: 0,
    provider: 'Gemini',
    model: 'gemini-2.5-flash',
  },
  ...overrides,
});

const makeChapter = (id: string, overrides: Partial<EnhancedChapter> = {}): EnhancedChapter => ({
  id,
  title: `Chapter ${id}`,
  content: `Content for ${id}`,
  originalUrl: `https://example.com/${id}`,
  canonicalUrl: `https://example.com/${id}`,
  nextUrl: null,
  prevUrl: null,
  sourceUrls: [`https://example.com/${id}`],
  translationResult: makeTranslationResult(),
  feedback: [],
  ...overrides,
});

describe('Null safety regressions in modern slices', () => {
  const handleFetchSpy = vi.spyOn(NavigationService, 'handleFetch');
  vi.spyOn(NavigationService, 'updateBrowserHistory').mockImplementation(() => {});

  const resetStoreState = () => {
    useAppStore.setState({
      chapters: new Map(),
      novels: new Map(),
      currentChapterId: null,
      navigationHistory: [],
      urlIndex: new Map(),
      rawUrlIndex: new Map(),
      activeTranslations: {},
      pendingTranslations: new Set(),
      feedbackHistory: {},
      translationProgress: {},
      error: null,
      isLoading: { fetching: false, translating: false },
      urlLoadingStates: {},
      hydratingChapters: {},
      settings: { ...defaultSettings },
    });
  };

  beforeEach(() => {
    resetStoreState();
    vi.clearAllMocks();
  });

  afterEach(() => {
    handleFetchSpy.mockReset();
  });

  describe('chaptersSlice.handleFetch()', () => {
    it('records NavigationService errors and clears loading state', async () => {
      handleFetchSpy.mockResolvedValue({ error: 'Network failure' });

      const result = await useAppStore.getState().handleFetch('https://example.com/failure');
      expect(result).toBeUndefined();
      expect(useAppStore.getState().error).toBe('Network failure');
      expect(useAppStore.getState().isLoading.fetching).toBe(false);
    });

    it('merges transformed chapter maps without throwing', async () => {
      const chapter = makeChapter('ch-001');
      const chapters = new Map<string, EnhancedChapter>([['ch-001', chapter]]);
      handleFetchSpy.mockResolvedValue({
        chapters,
        currentChapterId: 'ch-001',
        urlIndex: new Map(),
        rawUrlIndex: new Map(),
        novels: new Map(),
      });

      const result = await useAppStore.getState().handleFetch('https://example.com/ch-001');
      expect(result).toBe('ch-001');
      expect(useAppStore.getState().chapters.get('ch-001')).toBeDefined();
      expect(useAppStore.getState().error).toBeNull();
    });
  });

  describe('translationsSlice.buildTranslationHistory()', () => {
    it('skips navigation entries lacking loaded chapters', () => {
      const previous = makeChapter('chapter-9', { chapterNumber: 9 });
      const current = makeChapter('chapter-10', { chapterNumber: 10 });
      useAppStore.setState(state => ({
        chapters: new Map([
          [previous.id, previous],
          [current.id, current],
        ]),
        navigationHistory: [previous.id, 'missing-2', current.id],
        currentChapterId: current.id,
        settings: { ...state.settings, contextDepth: 5 },
      }));

      const history = useAppStore.getState().buildTranslationHistory(current.id);
      expect(history).toHaveLength(1);
      expect(history[0].translatedTitle).toBe(previous.translationResult?.translatedTitle);
      expect(history.find(entry => entry.originalTitle.includes('missing-2'))).toBeUndefined();
    });
  });

  describe('exportSlice.exportSessionData()', () => {
    it('serialises chapters even when translation data is incomplete', () => {
      const complete = makeChapter('complete');
      const incomplete = makeChapter('incomplete', { translationResult: null });

      useAppStore.setState({
        chapters: new Map([
          [complete.id, complete],
          [incomplete.id, incomplete],
        ]),
      });

      const json = useAppStore.getState().exportSessionData();
      const payload = JSON.parse(json);

      expect(payload.chapters).toHaveLength(2);
      const incompleteSnapshot = payload.chapters.find((entry: any) => entry.title === incomplete.title);
      expect(incompleteSnapshot.translationResult).toBeNull();
    });

    it('returns an empty snapshot when no chapters exist', () => {
      const json = useAppStore.getState().exportSessionData();
      const payload = JSON.parse(json);
      expect(payload.chapters).toHaveLength(0);
    });
  });
});
