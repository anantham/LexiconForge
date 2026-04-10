import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAppStore } from '../../store';
import { defaultSettings } from '../../services/sessionManagementService';
import { TranslationService } from '../../services/translationService';
import { TranslationOps } from '../../services/db/operations';
import type { EnhancedChapter } from '../../services/stableIdService';
import type { TranslationResult } from '../../types';

const { emitTelemetry } = vi.hoisted(() => ({
  emitTelemetry: vi.fn(),
}));

vi.mock('../../services/clientTelemetry', () => ({
  clientTelemetry: {
    emit: emitTelemetry,
  },
}));

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
  novelId: null,
  libraryVersionId: null,
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
  emitTelemetry.mockReset();
  resetStore();
  translationSpy = vi.spyOn(TranslationService, 'translateChapterSequential');
  versionsSpy = vi.spyOn(TranslationOps, 'getVersionsByStableId');
  storeTranslationSpy = vi.spyOn(TranslationOps, 'storeByStableId');
  activeIdsSpy = vi.spyOn(TranslationService, 'getActiveTranslationIds');
  activeIdsSpy.mockReturnValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

  it('stores translation results for the active chapter', async () => {
    const chapterId = 'stable-1';
    const url = 'https://example.com/chapter/1';
    useAppStore.setState({
      chapters: new Map([[chapterId, makeChapter(chapterId, url)]]),
      settings: { ...defaultSettings, provider: 'Gemini', model: 'gemini-2.5-flash', apiKeyGemini: 'key' },
    });

    versionsSpy.mockResolvedValue([]);
    // Fix: translateChapterSequential returns TranslateChapterResponse, not TranslationResult directly
    translationSpy.mockResolvedValue({ translationResult: mockResult() });
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
    useAppStore.setState({
      chapters: new Map([[chapterId, makeChapter(chapterId, url)]]),
      settings: { ...defaultSettings, provider: 'Gemini', model: 'gemini-2.5-flash', apiKeyGemini: 'key' },
    });

    versionsSpy.mockResolvedValue([
      {
        id: 'existing-version',
        version: 1,
        settingsSnapshot: {
          provider: 'Gemini',
          model: 'gemini-2.5-flash',
          systemPrompt: defaultSettings.systemPrompt,
          temperature: 0.3,
          enableAmendments: false,
          contextDepth: defaultSettings.contextDepth,
          includeFanTranslationInPrompt: defaultSettings.includeFanTranslationInPrompt,
          includeHistoricalFanTranslationsInContext: defaultSettings.includeHistoricalFanTranslationsInContext,
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
    useAppStore.setState({
      chapters: new Map([[chapterId, makeChapter(chapterId, url)]]),
      settings: { ...defaultSettings, provider: 'Gemini', model: 'gemini-2.5-flash', apiKeyGemini: 'key' },
      showNotification: vi.fn(),
    });

    versionsSpy.mockResolvedValue([]);
    translationSpy.mockResolvedValue({
      error: 'Provider unavailable',
      failureType: 'provider_malformed_response',
      expected: false,
    } as any);

    await useAppStore.getState().handleTranslate(chapterId);

    expect(useAppStore.getState().translationProgress[chapterId]?.status).toBe('failed');
    expect(useAppStore.getState().translationProgress[chapterId]?.error).toBe('Provider unavailable');
    expect(emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'translation_failed',
        failureType: 'provider_malformed_response',
        surface: 'manual_translate',
      })
    );
  });

  it('resets progress when translation is aborted', async () => {
    const chapterId = 'stable-4';
    const url = 'https://example.com/chapter/4';
    useAppStore.setState({
      chapters: new Map([[chapterId, makeChapter(chapterId, url)]]),
      settings: { ...defaultSettings, provider: 'Gemini', model: 'gemini-2.5-flash', apiKeyGemini: 'key' },
    });

    versionsSpy.mockResolvedValue([]);
    translationSpy.mockResolvedValue({ aborted: true } as any);

    await useAppStore.getState().handleTranslate(chapterId);

    expect(useAppStore.getState().translationProgress[chapterId]?.status).toBe('pending');
    expect(storeTranslationSpy).not.toHaveBeenCalled();
  });
});
