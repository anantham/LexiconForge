/**
 * Regression tests for P0.5 (TECH-DEBT-FIX-PRIORITY-2026-07-07).
 *
 * Pre-fix bug: handleRetryImage had no in-flight guard — the retry button is
 * only disabled on isSaving, which the common retry-without-editing path
 * never sets. A physical double-click (or a manual retry racing the
 * auto-trigger) launched TWO paid generations, both keyed to the same
 * version number (computed from the pre-await snapshot); the second
 * completion overwrote the first. One paid image silently lost.
 *
 * Post-fix: an isLoading early-return closes the race (everything before
 * the awaited service call is synchronous), and the version commit uses
 * max() so no completion can regress the counter.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '../../../types';
import { createImageSlice, type ImageSlice } from '../../../store/slices/imageSlice';

const { retryImageMock } = vi.hoisted(() => ({
  retryImageMock: vi.fn(),
}));

vi.mock('../../../services/imageGenerationService', () => ({
  ImageGenerationService: {
    retryImage: retryImageMock,
    generateImages: vi.fn(),
  },
}));

vi.mock('../../../utils/debug', () => ({
  debugLog: vi.fn(),
}));

const mockSettings: AppSettings = {
  contextDepth: 0,
  preloadCount: 0,
  fontSize: 16,
  fontStyle: 'sans',
  lineHeight: 1.4,
  systemPrompt: '',
  provider: 'OpenAI',
  model: 'gpt-4o-mini',
  imageModel: 'openrouter/google/gemini-2.5-flash-image',
  temperature: 0.7,
} as AppSettings;

type TestState = ImageSlice & {
  chapters: Map<string, unknown>;
  settings: AppSettings;
  activePromptTemplate: null;
  showNotification: ReturnType<typeof vi.fn>;
};

const createSlice = (): TestState => {
  const state: Partial<TestState> = {};
  const chapter = {
    id: 'chapter-1',
    translationResult: {
      translation: '<p>Storm clouds gathered over the ridge.</p>',
      suggestedIllustrations: [{ placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'Hero on ridge' }],
    },
  };

  Object.assign(state, {
    chapters: new Map([[chapter.id, chapter]]),
    settings: mockSettings,
    activePromptTemplate: null,
    showNotification: vi.fn(),
  });

  const set = (partial: Partial<TestState> | ((prev: TestState) => Partial<TestState> | void)) => {
    const next = typeof partial === 'function' ? partial(state as TestState) : partial;
    if (!next) return;
    Object.assign(state, next);
  };
  const get = () => state as TestState;
  const api = { setState: set, getState: get, subscribe: () => () => {}, destroy: () => {} } as never;

  Object.assign(state, createImageSlice(set as never, get as never, api));
  return state as TestState;
};

const KEY = 'chapter-1:[ILLUSTRATION-1]';

describe('imageSlice — handleRetryImage double-fire guard (P0.5)', () => {
  beforeEach(() => {
    retryImageMock.mockReset();
  });

  it('a double-click launches exactly ONE paid generation', async () => {
    const slice = createSlice();
    let resolveGeneration!: (v: unknown) => void;
    retryImageMock.mockImplementation(
      () => new Promise((resolve) => { resolveGeneration = resolve; })
    );

    // Physical double-click: second call fires before the first resolves.
    const first = slice.handleRetryImage('chapter-1', '[ILLUSTRATION-1]');
    const second = slice.handleRetryImage('chapter-1', '[ILLUSTRATION-1]');

    resolveGeneration({ imageState: { isLoading: false, data: 'img-v1', error: null } });
    await Promise.all([first, second]);

    expect(retryImageMock).toHaveBeenCalledTimes(1);
    expect(slice.imageVersions[KEY]).toBe(1);
    expect(slice.activeImageVersion[KEY]).toBe(1);
    expect(slice.generatedImages[KEY]?.data).toBe('img-v1');
  });

  it('a legitimate second retry AFTER completion still works and gets the next version', async () => {
    const slice = createSlice();
    retryImageMock.mockResolvedValueOnce({ imageState: { isLoading: false, data: 'img-v1', error: null } });
    await slice.handleRetryImage('chapter-1', '[ILLUSTRATION-1]');

    retryImageMock.mockResolvedValueOnce({ imageState: { isLoading: false, data: 'img-v2', error: null } });
    await slice.handleRetryImage('chapter-1', '[ILLUSTRATION-1]');

    expect(retryImageMock).toHaveBeenCalledTimes(2);
    expect(slice.imageVersions[KEY]).toBe(2);
    expect(slice.generatedImages[KEY]?.data).toBe('img-v2');
  });

  it('a retry is allowed again after a failed generation (guard must not wedge the slot)', async () => {
    const slice = createSlice();
    retryImageMock.mockRejectedValueOnce(new Error('Provider 500'));
    await slice.handleRetryImage('chapter-1', '[ILLUSTRATION-1]');
    expect(slice.generatedImages[KEY]?.isLoading).toBe(false);

    retryImageMock.mockResolvedValueOnce({ imageState: { isLoading: false, data: 'img-v1', error: null } });
    await slice.handleRetryImage('chapter-1', '[ILLUSTRATION-1]');

    expect(retryImageMock).toHaveBeenCalledTimes(2);
    expect(slice.generatedImages[KEY]?.data).toBe('img-v1');
  });
});
