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

  // -------- CORE-012 lifecycle telemetry + failure routing (issue #19) --------

  it('emits translation_started with origin, queue_depth, is_background_at_start', async () => {
    const chapterId = 'lifecycle-start-1';
    const url = 'https://example.com/chapter/start1';
    useAppStore.setState({
      chapters: new Map([[chapterId, makeChapter(chapterId, url)]]),
      settings: { ...defaultSettings, provider: 'Gemini', model: 'gemini-2.5-flash', apiKeyGemini: 'key' },
      // User is reading a different chapter — this auto_visit is "background" from the start
      currentChapterId: 'some-other-chapter',
      viewMode: 'original', // prevent autoTranslateMediator from racing the test
    } as any);

    versionsSpy.mockResolvedValue([]);
    translationSpy.mockResolvedValue({ translationResult: mockResult() });
    storeTranslationSpy.mockResolvedValue({ id: 'v1' } as any);

    await useAppStore.getState().handleTranslate(chapterId, 'auto_visit');

    expect(emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'translation_started',
        surface: 'auto_visit',
        chapterId,
        extras: expect.objectContaining({
          queue_depth: 0,
          is_background_at_start: true,
        }),
      })
    );
  });

  it('emits translation_completed with duration_ms and is_background', async () => {
    const chapterId = 'lifecycle-complete-1';
    const url = 'https://example.com/chapter/complete1';
    useAppStore.setState({
      chapters: new Map([[chapterId, makeChapter(chapterId, url)]]),
      settings: { ...defaultSettings, provider: 'Gemini', model: 'gemini-2.5-flash', apiKeyGemini: 'key' },
      currentChapterId: chapterId, // user is currently viewing
      viewMode: 'original',
    } as any);

    versionsSpy.mockResolvedValue([]);
    translationSpy.mockResolvedValue({ translationResult: mockResult() });
    storeTranslationSpy.mockResolvedValue({ id: 'v2' } as any);

    await useAppStore.getState().handleTranslate(chapterId, 'manual_translate');

    const completedCall = emitTelemetry.mock.calls.find(
      ([arg]: any[]) => arg?.eventType === 'translation_completed'
    );
    expect(completedCall).toBeDefined();
    expect(completedCall![0]).toEqual(
      expect.objectContaining({
        eventType: 'translation_completed',
        surface: 'manual_translate',
        chapterId,
        extras: expect.objectContaining({
          is_background: false,
          duration_ms: expect.any(Number),
        }),
      })
    );
  });

  it('emits translation_aborted with explicit_user_cancel reason on aborted response', async () => {
    const chapterId = 'lifecycle-abort-1';
    const url = 'https://example.com/chapter/abort1';
    useAppStore.setState({
      chapters: new Map([[chapterId, makeChapter(chapterId, url)]]),
      settings: { ...defaultSettings, provider: 'Gemini', model: 'gemini-2.5-flash', apiKeyGemini: 'key' },
    });

    versionsSpy.mockResolvedValue([]);
    translationSpy.mockResolvedValue({ aborted: true } as any);

    await useAppStore.getState().handleTranslate(chapterId);

    expect(emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'translation_aborted',
        chapterId,
        extras: expect.objectContaining({
          cancel_reason: 'explicit_user_cancel',
        }),
      })
    );
  });

  it('routes systemic failure (missing_api_key) to global toast when chapter is background', async () => {
    const chapterId = 'fail-systemic-bg';
    const url = 'https://example.com/chapter/sysbg';
    const showNotification = vi.fn();
    const setError = vi.fn();
    useAppStore.setState({
      chapters: new Map([[chapterId, makeChapter(chapterId, url)]]),
      settings: { ...defaultSettings, provider: 'Gemini', model: 'gemini-2.5-flash', apiKeyGemini: 'key' },
      currentChapterId: 'reading-this-chapter',
      viewMode: 'original',
      showNotification,
      setError,
    } as any);

    versionsSpy.mockResolvedValue([]);
    translationSpy.mockResolvedValue({
      error: 'Missing API key',
      failureType: 'missing_api_key',
      expected: true,
    } as any);

    await useAppStore.getState().handleTranslate(chapterId, 'auto_preload');

    expect(showNotification).toHaveBeenCalledWith('Missing API key', 'error');
    // setError gets one call at the start with null (the initial clear). Assert
    // we never propagate the actual error to it for a background failure.
    expect(setError).not.toHaveBeenCalledWith('Missing API key', expect.anything());
    // Per-chapter error is still in translationProgress for on-return surfacing
    expect(useAppStore.getState().translationProgress[chapterId]?.error).toBe('Missing API key');
  });

  it('routes per-chapter failure (timeout) silently when chapter is background — no toast, no setError', async () => {
    const chapterId = 'fail-perchapter-bg';
    const url = 'https://example.com/chapter/percbg';
    const showNotification = vi.fn();
    const setError = vi.fn();
    useAppStore.setState({
      chapters: new Map([[chapterId, makeChapter(chapterId, url)]]),
      settings: { ...defaultSettings, provider: 'Gemini', model: 'gemini-2.5-flash', apiKeyGemini: 'key' },
      currentChapterId: 'reading-this-chapter',
      viewMode: 'original',
      showNotification,
      setError,
    } as any);

    versionsSpy.mockResolvedValue([]);
    translationSpy.mockResolvedValue({
      error: 'Translation timed out after 90s',
      failureType: 'timeout',
      expected: false,
    } as any);

    await useAppStore.getState().handleTranslate(chapterId, 'auto_preload');

    expect(showNotification).not.toHaveBeenCalled();
    // Same as above — initial null clear is allowed; assert the real error
    // never gets propagated to setError for a background per-chapter failure.
    expect(setError).not.toHaveBeenCalledWith('Translation timed out after 90s', expect.anything());
    // Error still captured per-chapter for on-return rendering
    expect(useAppStore.getState().translationProgress[chapterId]?.error).toBe(
      'Translation timed out after 90s'
    );
  });

  it('routes any failure to setError when chapter IS the current chapter (foreground)', async () => {
    const chapterId = 'fail-foreground';
    const url = 'https://example.com/chapter/fg';
    const showNotification = vi.fn();
    const setError = vi.fn();
    useAppStore.setState({
      chapters: new Map([[chapterId, makeChapter(chapterId, url)]]),
      settings: { ...defaultSettings, provider: 'Gemini', model: 'gemini-2.5-flash', apiKeyGemini: 'key' },
      currentChapterId: chapterId, // user is on this chapter
      viewMode: 'original',
      showNotification,
      setError,
    } as any);

    versionsSpy.mockResolvedValue([]);
    translationSpy.mockResolvedValue({
      error: 'Provider 500',
      failureType: 'provider_malformed_response',
      expected: false,
    } as any);

    await useAppStore.getState().handleTranslate(chapterId, 'manual_translate');

    expect(setError).toHaveBeenCalledWith('Provider 500', expect.any(Object));
    expect(showNotification).not.toHaveBeenCalled();
  });
});
