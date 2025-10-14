import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAppStore } from '../../store';
import { defaultSettings } from '../../services/sessionManagementService';
import { indexedDBService } from '../../services/indexeddb';
import { TranslationService } from '../../services/translationService';
import type { EnhancedChapter } from '../../services/stableIdService';
import type { TranslationResult } from '../../types';

const resetStore = () => {
  useAppStore.setState({
    chapters: new Map(),
    novels: new Map(),
    currentChapterId: null,
    navigationHistory: [],
    urlIndex: new Map(),
    rawUrlIndex: new Map(),
    settings: { ...defaultSettings },
    translationProgress: {},
    pendingTranslations: new Set(),
  });
};

const makeChapter = (id: string, url: string): EnhancedChapter => ({
  id,
  title: `Chapter ${id}`,
  content: 'Original content awaiting translation.',
  originalUrl: url,
  canonicalUrl: url,
  nextUrl: null,
  prevUrl: null,
  sourceUrls: [url],
  translationResult: null,
  feedback: [],
});

const mockResult = (overrides: Partial<TranslationResult> = {}): TranslationResult => ({
  translatedTitle: 'Translated Title',
  translation: 'Translated body text.',
  proposal: null,
  footnotes: [],
  suggestedIllustrations: [],
  usageMetrics: {
    totalTokens: 1000,
    promptTokens: 600,
    completionTokens: 400,
    estimatedCost: 0.0012,
    requestTime: 2,
    provider: 'Gemini',
    model: 'gemini-2.5-flash',
  },
  customVersionLabel: undefined,
  ...overrides,
});

describe('Translation slice handleTranslate()', () => {
let translationSpy: ReturnType<typeof vi.spyOn>;
let versionsSpy: ReturnType<typeof vi.spyOn>;
let storeTranslationSpy: ReturnType<typeof vi.spyOn>;
let activeIdsSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.restoreAllMocks();
  resetStore();
  translationSpy = vi.spyOn(TranslationService, 'translateChapterSequential');
  versionsSpy = vi.spyOn(indexedDBService, 'getTranslationVersionsByStableId');
  storeTranslationSpy = vi.spyOn(indexedDBService, 'storeTranslationByStableId');
  activeIdsSpy = vi.spyOn(TranslationService, 'getActiveTranslationIds');
  activeIdsSpy.mockReturnValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

  it('stores translation results for the active chapter', async () => {
    const chapterId = 'stable-1';
    const url = 'https://example.com/chapter/1';
    useAppStore.setState(state => ({
      chapters: new Map([[chapterId, makeChapter(chapterId, url)]]),
      settings: { ...state.settings, provider: 'Gemini', model: 'gemini-2.5-flash', apiKeyGemini: 'key' },
    }));

    versionsSpy.mockResolvedValue([]);
    translationSpy.mockResolvedValue(mockResult());
    storeTranslationSpy.mockResolvedValue({ id: 'stored-version-id' } as any);

    await useAppStore.getState().handleTranslate(chapterId);

    expect(versionsSpy).toHaveBeenCalledWith(chapterId);
    expect(translationSpy).toHaveBeenCalled();
    const updatedChapter = useAppStore.getState().chapters.get(chapterId);
    expect(updatedChapter?.translationResult?.translation).toBe('Translated body text.');
    expect(useAppStore.getState().translationProgress[chapterId]).toEqual({ status: 'completed', progress: 100 });
  });

  it('skips translation when a stored version already exists', async () => {
    const chapterId = 'stable-2';
    const url = 'https://example.com/chapter/2';
    useAppStore.setState(state => ({
      chapters: new Map([[chapterId, makeChapter(chapterId, url)]]),
      settings: { ...state.settings, provider: 'Gemini', model: 'gemini-2.5-flash', apiKeyGemini: 'key' },
    }));

    versionsSpy.mockResolvedValue([
      {
        id: 'existing-version',
        version: 1,
        settingsSnapshot: {
          provider: 'Gemini',
          model: 'gemini-2.5-flash',
          systemPrompt: defaultSettings.systemPrompt,
          temperature: defaultSettings.temperature,
        },
      } as any,
    ]);

    await useAppStore.getState().handleTranslate(chapterId);

    expect(translationSpy).not.toHaveBeenCalled();
    expect(storeTranslationSpy).not.toHaveBeenCalled();
  });

  it('records failures when translation returns an error payload', async () => {
    const chapterId = 'stable-3';
    const url = 'https://example.com/chapter/3';
    useAppStore.setState(state => ({
      chapters: new Map([[chapterId, makeChapter(chapterId, url)]]),
      settings: { ...state.settings, provider: 'Gemini', model: 'gemini-2.5-flash', apiKeyGemini: 'key' },
      showNotification: vi.fn(),
    }));

    versionsSpy.mockResolvedValue([]);
    translationSpy.mockResolvedValue({ error: 'Provider unavailable' } as any);

    await useAppStore.getState().handleTranslate(chapterId);

    expect(useAppStore.getState().translationProgress[chapterId]?.status).toBe('failed');
    expect(useAppStore.getState().translationProgress[chapterId]?.error).toBe('Provider unavailable');
  });

  it('resets progress when translation is aborted', async () => {
    const chapterId = 'stable-4';
    const url = 'https://example.com/chapter/4';
    useAppStore.setState(state => ({
      chapters: new Map([[chapterId, makeChapter(chapterId, url)]]),
      settings: { ...state.settings, provider: 'Gemini', model: 'gemini-2.5-flash', apiKeyGemini: 'key' },
    }));

    versionsSpy.mockResolvedValue([]);
    translationSpy.mockResolvedValue({ aborted: true } as any);

    await useAppStore.getState().handleTranslate(chapterId);

    expect(useAppStore.getState().translationProgress[chapterId]?.status).toBe('pending');
    expect(storeTranslationSpy).not.toHaveBeenCalled();
  });
});
