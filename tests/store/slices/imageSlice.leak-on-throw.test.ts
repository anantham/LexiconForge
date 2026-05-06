/**
 * Regression tests for the image-leak audit (issue #19 Phase 2 / CORE-012).
 *
 * Pre-fix bug: handleRetryImage and handleGenerateImages set isLoading=true
 * before awaiting ImageGenerationService.{retryImage,generateImages}. If the
 * service throws, the post-await state-set never runs and isLoading stays
 * true forever. hasImagesInProgress() then returns true forever, causing the
 * beforeunload "changes will be lost" warning to fire on every page refresh.
 *
 * Post-fix: try/catch around each await clears isLoading on throw and
 * captures the error message for UI surfacing.
 *
 * See: store/slices/imageSlice.ts handleRetryImage / handleGenerateImages
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '../../../types';
import { createImageSlice, type ImageSlice } from '../../../store/slices/imageSlice';

const { retryImageMock, generateImagesMock } = vi.hoisted(() => ({
  retryImageMock: vi.fn(),
  generateImagesMock: vi.fn(),
}));

vi.mock('../../../services/imageGenerationService', () => ({
  ImageGenerationService: {
    retryImage: retryImageMock,
    generateImages: generateImagesMock,
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
  chapters: Map<string, any>;
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
      suggestedIllustrations: [
        { placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'Hero on ridge' },
        { placementMarker: '[ILLUSTRATION-2]', imagePrompt: 'Distant lightning' },
      ],
    },
  };

  Object.assign(state, {
    chapters: new Map([[chapter.id, chapter]]),
    settings: mockSettings,
    activePromptTemplate: null,
    showNotification: vi.fn(),
  });

  const set = (
    partial: Partial<TestState> | ((prev: TestState) => Partial<TestState> | void)
  ) => {
    const next = typeof partial === 'function' ? partial(state as TestState) : partial;
    if (!next) return;
    Object.assign(state, next);
  };
  const get = () => state as TestState;
  const api = {
    setState: set,
    getState: get,
    subscribe: () => () => {},
    destroy: () => {},
  } as any;

  Object.assign(state, createImageSlice(set as any, get as any, api));
  return state as TestState;
};

describe('imageSlice — handleRetryImage cleans up isLoading on service throw', () => {
  beforeEach(() => {
    retryImageMock.mockReset();
  });

  it('clears isLoading and captures error when ImageGenerationService.retryImage throws', async () => {
    const slice = createSlice();
    retryImageMock.mockRejectedValueOnce(new Error('Provider 500'));

    await slice.handleRetryImage('chapter-1', '[ILLUSTRATION-1]');

    const key = 'chapter-1:[ILLUSTRATION-1]';
    const state = slice.generatedImages[key];
    expect(state).toBeDefined();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe('Provider 500');
    // hasImagesInProgress() must report false post-throw
    expect(slice.hasImagesInProgress()).toBe(false);
  });
});

describe('imageSlice — handleGenerateImages cleans up isLoading on service throw', () => {
  beforeEach(() => {
    generateImagesMock.mockReset();
  });

  it('clears progress and any in-flight per-image flags when service throws', async () => {
    const slice = createSlice();

    // Simulate the progress-callback firing for one image before the throw
    generateImagesMock.mockImplementationOnce(async (chapterId, ctx, cb) => {
      cb(
        {
          [`${chapterId}:[ILLUSTRATION-1]`]: { isLoading: true, data: null, error: null },
        },
        null
      );
      throw new Error('Network down');
    });

    await slice.handleGenerateImages('chapter-1');

    const k1 = 'chapter-1:[ILLUSTRATION-1]';
    const k2 = 'chapter-1:[ILLUSTRATION-2]';

    // The illustration that was marked loading must be cleared
    expect(slice.generatedImages[k1]?.isLoading).toBe(false);
    expect(slice.generatedImages[k1]?.error).toBe('Network down');
    // The illustration never marked loading should remain absent or unaffected
    expect(slice.generatedImages[k2]?.isLoading ?? false).toBe(false);
    // Chapter progress must be cleared
    expect(slice.imageGenerationProgress['chapter-1']).toBeUndefined();
    // Aggregate selector must report no work in progress
    expect(slice.hasImagesInProgress()).toBe(false);
  });
});
