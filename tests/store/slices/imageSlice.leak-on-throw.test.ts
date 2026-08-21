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
import { createImageJobsSlice, type ImageJobsSlice } from '../../../store/slices/imageJobsSlice';

const { retryImageMock, generateImagesMock, resumeImageJobMock } = vi.hoisted(() => ({
  retryImageMock: vi.fn(),
  generateImagesMock: vi.fn(),
  resumeImageJobMock: vi.fn(),
}));

vi.mock('../../../services/imageGenerationService', () => ({
  ImageGenerationService: {
    retryImage: retryImageMock,
    generateImages: generateImagesMock,
    resumeImageJob: resumeImageJobMock,
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

type TestState = ImageSlice & ImageJobsSlice & {
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

  Object.assign(state, createImageJobsSlice(set as any, get as any, api));
  Object.assign(state, createImageSlice(set as any, get as any, api));
  return state as TestState;
};

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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

  it('skips duplicate retry calls while the same image is already loading', async () => {
    const slice = createSlice();
    const key = 'chapter-1:[ILLUSTRATION-1]';
    const deferred = createDeferred<any>();
    retryImageMock.mockReturnValueOnce(deferred.promise);
    slice.imageVersions[key] = 1;
    slice.activeImageVersion[key] = 1;

    const firstRetry = slice.handleRetryImage('chapter-1', '[ILLUSTRATION-1]');
    expect(slice.generatedImages[key]?.isLoading).toBe(true);

    await slice.handleRetryImage('chapter-1', '[ILLUSTRATION-1]');
    expect(retryImageMock).toHaveBeenCalledTimes(1);

    deferred.resolve({
      imageState: { isLoading: false, data: 'image-v2', error: null },
      metrics: { count: 1, totalTime: 2, totalCost: 0.03, lastModel: mockSettings.imageModel },
    });
    await firstRetry;

    expect(slice.generatedImages[key]).toEqual({ isLoading: false, data: 'image-v2', error: null });
    expect(slice.imageVersions[key]).toBe(2);
    expect(slice.activeImageVersion[key]).toBe(2);
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

describe('imageSlice — durable task recovery', () => {
  beforeEach(() => {
    resumeImageJobMock.mockReset();
    retryImageMock.mockReset();
  });

  it('does not submit a paid retry while an interrupted durable task still owns the marker', async () => {
    const slice = createSlice();
    slice.imageJobs['saved-job'] = {
      id: 'saved-job',
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      requestedModel: 'indrasnet/gen_anime',
      requestedProvider: 'Asus / IndrasNet',
      status: 'interrupted',
      resumeKind: 'indrasnet',
      externalTaskId: 'broker-task-123',
      version: 2,
      startedAt: Date.now() - 5000,
      updatedAt: Date.now(),
      estimateSampleCount: 0,
    };

    await slice.handleRetryImage('chapter-1', '[ILLUSTRATION-1]');

    expect(retryImageMock).not.toHaveBeenCalled();
    expect(slice.imageJobs['saved-job']).toMatchObject({
      status: 'interrupted',
      externalTaskId: 'broker-task-123',
    });
  });

  it('reattaches to an interrupted provider task and applies it to the originating marker', async () => {
    const slice = createSlice();
    slice.imageJobs['saved-job'] = {
      id: 'saved-job',
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      requestedModel: 'Qubico/flux1-dev',
      requestedProvider: 'PiAPI',
      status: 'interrupted',
      resumeKind: 'piapi',
      externalTaskId: 'task-123',
      version: 2,
      startedAt: Date.now() - 5000,
      updatedAt: Date.now(),
      estimateSampleCount: 0,
    };
    resumeImageJobMock.mockResolvedValue({
      imageState: { isLoading: false, data: 'recovered-image', error: null },
      metrics: { count: 1, totalTime: 5, totalCost: 0.03, lastModel: 'Qubico/flux1-dev' },
    });

    await slice.resumeInterruptedImageJobs();

    expect(resumeImageJobMock).toHaveBeenCalledTimes(1);
    expect(slice.generatedImages['chapter-1:[ILLUSTRATION-1]']?.data).toBe('recovered-image');
    expect(slice.imageVersions['chapter-1:[ILLUSTRATION-1]']).toBe(2);
    expect(slice.imageJobs['saved-job'].status).toBe('completed');
    expect(slice.showNotification).toHaveBeenCalledWith(
      'A previously submitted illustration is ready in its originating chapter.',
      'success',
    );
  });

  it('claims restored jobs before awaiting so duplicate boot effects cannot poll twice', async () => {
    const slice = createSlice();
    slice.imageJobs['saved-job'] = {
      id: 'saved-job',
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      requestedModel: 'Qubico/flux1-dev',
      requestedProvider: 'PiAPI',
      status: 'interrupted',
      resumeKind: 'piapi',
      externalTaskId: 'task-123',
      version: 2,
      startedAt: Date.now() - 5000,
      updatedAt: Date.now(),
      estimateSampleCount: 0,
    };
    const deferred = createDeferred<any>();
    resumeImageJobMock.mockReturnValueOnce(deferred.promise);

    const firstRecovery = slice.resumeInterruptedImageJobs();
    await slice.resumeInterruptedImageJobs();
    expect(resumeImageJobMock).toHaveBeenCalledTimes(1);

    deferred.resolve({
      imageState: { isLoading: false, data: 'recovered-image', error: null },
      metrics: { count: 1, totalTime: 5, totalCost: 0.03, lastModel: 'Qubico/flux1-dev' },
    });
    await firstRecovery;
  });

  it('keeps the provider task id when recovery is temporarily unreachable', async () => {
    const slice = createSlice();
    slice.imageJobs['saved-job'] = {
      id: 'saved-job',
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      requestedModel: 'indrasnet/storybook',
      requestedProvider: 'IndrasNet',
      status: 'interrupted',
      resumeKind: 'indrasnet',
      externalTaskId: 'broker-task-123',
      version: 2,
      startedAt: Date.now() - 5000,
      updatedAt: Date.now(),
      estimateSampleCount: 0,
    };
    resumeImageJobMock.mockRejectedValueOnce(Object.assign(
      new Error('IndrasNet is unreachable from this device.'),
      { retryable: true },
    ));

    await slice.resumeInterruptedImageJobs();

    expect(slice.imageJobs['saved-job']).toMatchObject({
      status: 'interrupted',
      externalTaskId: 'broker-task-123',
    });
    expect(JSON.parse(localStorage.getItem('LF_RESUMABLE_IMAGE_JOBS_V1') || '[]')).toEqual([
      expect.objectContaining({ id: 'saved-job', externalTaskId: 'broker-task-123', status: 'interrupted' }),
    ]);
    expect(slice.showNotification).toHaveBeenCalledWith(
      'The illustration provider is unavailable. The existing task will be checked again after reload.',
      'error',
    );
  });

  it('retires a durable task when the provider says its record is terminally unavailable', async () => {
    const slice = createSlice();
    slice.imageJobs['expired-job'] = {
      id: 'expired-job',
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      requestedModel: 'indrasnet/storybook',
      requestedProvider: 'IndrasNet',
      status: 'interrupted',
      resumeKind: 'indrasnet',
      externalTaskId: 'expired-task-123',
      version: 2,
      startedAt: Date.now() - 5000,
      updatedAt: Date.now(),
      estimateSampleCount: 0,
    };
    resumeImageJobMock.mockRejectedValueOnce(Object.assign(
      new Error('ComfyUI broker job not found; the broker may have restarted.'),
      { code: 'COMFYUI_JOB_NOT_FOUND', retryable: false },
    ));

    await slice.resumeInterruptedImageJobs();

    expect(slice.imageJobs['expired-job'].status).toBe('failed');
    expect(localStorage.getItem('LF_RESUMABLE_IMAGE_JOBS_V1')).toBeNull();
  });
});
