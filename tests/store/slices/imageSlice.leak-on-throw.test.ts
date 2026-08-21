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

const { retryImageMock, generateImagesMock, resumeImageJobMock, applyResumedImageJobArtifactMock, imageCacheHasMock } = vi.hoisted(() => ({
  retryImageMock: vi.fn(),
  generateImagesMock: vi.fn(),
  resumeImageJobMock: vi.fn(),
  applyResumedImageJobArtifactMock: vi.fn(),
  imageCacheHasMock: vi.fn(),
}));

vi.mock('../../../services/imageCacheService', () => ({
  ImageCacheStore: { has: imageCacheHasMock },
}));

vi.mock('../../../services/imageGenerationService', () => ({
  ImageGenerationService: {
    retryImage: retryImageMock,
    generateImages: generateImagesMock,
    resumeImageJobArtifact: resumeImageJobMock,
    applyResumedImageJobArtifact: applyResumedImageJobArtifactMock,
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
    imageCacheHasMock.mockReset().mockResolvedValue(false);
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

  it('keeps a durable task after retryImage returns a retryable error state', async () => {
    const slice = createSlice();
    slice.settings = { ...slice.settings, imageModel: 'indrasnet/gen_anime' };
    retryImageMock.mockImplementationOnce(async (_chapterId, _placementMarker, context) => {
      context.onJobEvent?.('[ILLUSTRATION-1]', {
        type: 'submitted',
        externalTaskId: 'broker-single-retry-1',
        resumeKind: 'indrasnet',
      });
      return {
        imageState: {
          isLoading: false,
          data: null,
          error: 'Completed artifact is temporarily unreachable',
          errorType: 'INDRASNET_IMAGE_DOWNLOAD_FAILED',
          canRetry: true,
        },
      };
    });

    await slice.handleRetryImage('chapter-1', '[ILLUSTRATION-1]');

    expect(Object.values(slice.imageJobs)).toContainEqual(expect.objectContaining({
      status: 'interrupted',
      externalTaskId: 'broker-single-retry-1',
      resumeKind: 'indrasnet',
    }));
    expect(JSON.parse(localStorage.getItem('LF_RESUMABLE_IMAGE_JOBS_V1') || '[]')).toEqual([
      expect.objectContaining({ status: 'interrupted', externalTaskId: 'broker-single-retry-1' }),
    ]);
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
      metrics: { chapterId: 'chapter-1', count: 1, totalTime: 2, totalCost: 0.03, lastModel: mockSettings.imageModel },
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

  it('preserves a submitted durable ID when batch polling fails transiently', async () => {
    const slice = createSlice();
    const chapter = slice.chapters.get('chapter-1');
    chapter.translationResult.suggestedIllustrations = [
      { placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'Hero on ridge' },
    ];
    generateImagesMock.mockImplementationOnce(async (chapterId, context, onProgress) => {
      context.onJobEvent?.('[ILLUSTRATION-1]', {
        type: 'submitted',
        externalTaskId: 'broker-task-123',
        resumeKind: 'indrasnet',
      });
      const generatedImages = {
        [`${chapterId}:[ILLUSTRATION-1]`]: {
          isLoading: false,
          data: null,
          error: 'IndrasNet is temporarily unreachable.',
          canRetry: true,
        },
      };
      onProgress(generatedImages, null);
      return { generatedImages };
    });

    await slice.handleGenerateImages('chapter-1');

    expect(Object.values(slice.imageJobs)).toContainEqual(expect.objectContaining({
      status: 'interrupted',
      externalTaskId: 'broker-task-123',
      resumeKind: 'indrasnet',
    }));
    expect(JSON.parse(localStorage.getItem('LF_RESUMABLE_IMAGE_JOBS_V1') || '[]')).toEqual([
      expect.objectContaining({ status: 'interrupted', externalTaskId: 'broker-task-123' }),
    ]);
  });

  it('does not exclude a duplicate marker because this batch already created its job', async () => {
    const slice = createSlice();
    const chapter = slice.chapters.get('chapter-1');
    chapter.translationResult.suggestedIllustrations = [
      { placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'first prompt' },
      { placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'duplicate imported prompt' },
    ];
    generateImagesMock.mockImplementationOnce(async (chapterId, context) => {
      expect(context.excludedPlacementMarkers?.has('[ILLUSTRATION-1]')).toBe(false);
      return {
        generatedImages: {
          [`${chapterId}:[ILLUSTRATION-1]`]: { isLoading: false, data: 'one-image', error: null },
        },
        metrics: {
          chapterId, count: 1, totalTime: 2, totalCost: 0.03, lastModel: mockSettings.imageModel,
        },
      };
    });

    await slice.handleGenerateImages('chapter-1');

    expect(generateImagesMock).toHaveBeenCalledTimes(1);
    expect(Object.values(slice.imageJobs)).toHaveLength(1);
    expect(Object.values(slice.imageJobs)[0]).toMatchObject({ status: 'completed' });
  });

  it('keeps later batch jobs queued until their own generation begins', async () => {
    const slice = createSlice();
    generateImagesMock.mockImplementationOnce(async (chapterId, context) => {
      const jobsByMarker = Object.fromEntries(
        Object.values(slice.imageJobs).map(job => [job.placementMarker, job]),
      );
      expect(jobsByMarker['[ILLUSTRATION-1]']).toMatchObject({ status: 'queued' });
      expect(jobsByMarker['[ILLUSTRATION-2]']).toMatchObject({ status: 'queued' });

      context.onJobEvent?.('[ILLUSTRATION-1]', { type: 'running' });
      expect(slice.imageJobs[jobsByMarker['[ILLUSTRATION-1]'].id]).toMatchObject({ status: 'running' });
      expect(slice.imageJobs[jobsByMarker['[ILLUSTRATION-2]'].id]).toMatchObject({ status: 'queued' });

      context.onJobEvent?.('[ILLUSTRATION-2]', { type: 'running' });
      expect(slice.imageJobs[jobsByMarker['[ILLUSTRATION-2]'].id]).toMatchObject({ status: 'running' });
      return {
        generatedImages: {
          [`${chapterId}:[ILLUSTRATION-1]`]: { isLoading: false, data: 'image-1', error: null },
          [`${chapterId}:[ILLUSTRATION-2]`]: { isLoading: false, data: 'image-2', error: null },
        },
        metrics: {
          chapterId, count: 2, totalTime: 4, totalCost: 0.06, lastModel: mockSettings.imageModel,
        },
      };
    });

    await slice.handleGenerateImages('chapter-1');

    expect(Object.values(slice.imageJobs)).toEqual([
      expect.objectContaining({ placementMarker: '[ILLUSTRATION-1]', status: 'completed' }),
      expect.objectContaining({ placementMarker: '[ILLUSTRATION-2]', status: 'completed' }),
    ]);
  });
});

describe('imageSlice — chapter-owned metrics', () => {
  it('replaces rather than combines metrics when a different chapter reports', () => {
    const slice = createSlice();
    slice.updateMetrics({
      chapterId: 'chapter-1', count: 2, totalTime: 10, totalCost: 0.06, lastModel: 'model-a',
    });
    slice.updateMetrics({
      chapterId: 'chapter-2', count: 1, totalTime: 4, totalCost: 0.02, lastModel: 'model-b',
    });

    expect(slice.imageGenerationMetrics).toEqual({
      chapterId: 'chapter-2', count: 1, totalTime: 4, totalCost: 0.02, lastModel: 'model-b',
    });
  });
});

describe('imageSlice — durable task recovery', () => {
  beforeEach(() => {
    resumeImageJobMock.mockReset();
    applyResumedImageJobArtifactMock.mockReset().mockImplementation(
      async (_job, _context, artifact) => artifact,
    );
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

  it('retires a stale durable job when its exact artifact version was already persisted', async () => {
    const slice = createSlice();
    imageCacheHasMock.mockResolvedValueOnce(true);
    const chapter = slice.chapters.get('chapter-1');
    chapter.translationResult.suggestedIllustrations[0].generatedImage = {
      imageData: '',
      imageCacheKey: {
        chapterId: 'chapter-1',
        placementMarker: '[ILLUSTRATION-1]',
        version: 2,
      },
      metadata: { version: 2, model: 'indrasnet/gen_anime' },
    };
    chapter.translationResult.imageVersionState = {
      '[ILLUSTRATION-1]': {
        latestVersion: 2,
        activeVersion: 2,
        versions: { 2: { version: 2, model: 'indrasnet/gen_anime' } },
      },
    };
    slice.imageJobs['persisted-job'] = {
      id: 'persisted-job',
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      requestedModel: 'indrasnet/gen_anime',
      requestedProvider: 'Asus / IndrasNet',
      taskModel: 'indrasnet/gen_anime',
      status: 'interrupted',
      resumeKind: 'indrasnet',
      externalTaskId: 'expired-broker-task',
      version: 2,
      startedAt: Date.now() - 5000,
      updatedAt: Date.now(),
      estimateSampleCount: 0,
    };

    await slice.resumeInterruptedImageJobs();

    expect(resumeImageJobMock).not.toHaveBeenCalled();
    expect(applyResumedImageJobArtifactMock).not.toHaveBeenCalled();
    expect(slice.imageJobs['persisted-job']).toMatchObject({
      status: 'completed',
      durationSeconds: undefined,
    });
    expect(slice.showNotification).toHaveBeenCalledWith(
      expect.stringContaining('already saved'),
      'success',
    );
  });

  it('does not retire a durable job for an evicted persisted cache pointer', async () => {
    const slice = createSlice();
    const chapter = slice.chapters.get('chapter-1');
    chapter.translationResult.suggestedIllustrations[0].generatedImage = {
      imageData: '',
      imageCacheKey: {
        chapterId: 'chapter-1',
        placementMarker: '[ILLUSTRATION-1]',
        version: 2,
      },
      metadata: { version: 2, model: 'indrasnet/gen_anime' },
    };
    chapter.translationResult.imageVersionState = {
      '[ILLUSTRATION-1]': {
        latestVersion: 2,
        activeVersion: 2,
        versions: { 2: { version: 2, model: 'indrasnet/gen_anime' } },
      },
    };
    slice.imageJobs['evicted-cache-job'] = {
      id: 'evicted-cache-job',
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      requestedModel: 'indrasnet/gen_anime',
      requestedProvider: 'Asus / IndrasNet',
      taskModel: 'indrasnet/gen_anime',
      status: 'interrupted',
      resumeKind: 'indrasnet',
      externalTaskId: 'still-recoverable-provider-task',
      version: 2,
      startedAt: Date.now() - 5000,
      updatedAt: Date.now(),
      estimateSampleCount: 0,
    };
    imageCacheHasMock.mockResolvedValue(false);
    resumeImageJobMock.mockResolvedValueOnce({
      imageState: { isLoading: false, data: 'recovered-image', error: null },
    });

    await slice.resumeInterruptedImageJobs();

    expect(imageCacheHasMock).toHaveBeenCalledWith(
      chapter.translationResult.suggestedIllustrations[0].generatedImage.imageCacheKey,
    );
    expect(resumeImageJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'evicted-cache-job' }),
      expect.anything(),
    );
  });

  it('does not trust version metadata without a concrete persisted artifact', async () => {
    const slice = createSlice();
    const chapter = slice.chapters.get('chapter-1');
    chapter.translationResult.imageVersionState = {
      '[ILLUSTRATION-1]': {
        latestVersion: 2,
        activeVersion: 2,
        versions: { 2: { version: 2 } },
      },
    };
    slice.imageJobs['metadata-only-job'] = {
      id: 'metadata-only-job',
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      requestedModel: 'indrasnet/gen_anime',
      requestedProvider: 'Asus / IndrasNet',
      status: 'interrupted',
      resumeKind: 'indrasnet',
      externalTaskId: 'provider-task-still-required',
      version: 2,
      startedAt: Date.now() - 5000,
      updatedAt: Date.now(),
      estimateSampleCount: 0,
    };
    resumeImageJobMock.mockResolvedValueOnce({
      imageState: { isLoading: false, data: 'recovered-image', error: null },
    });

    await slice.resumeInterruptedImageJobs();

    expect(resumeImageJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'metadata-only-job' }),
      expect.anything(),
    );
  });

  it('reapplies an exact cached artifact before repolling an expired provider task', async () => {
    const slice = createSlice();
    slice.imageJobs['cached-job'] = {
      id: 'cached-job',
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      requestedModel: 'indrasnet/gen_anime',
      requestedProvider: 'Asus / IndrasNet',
      taskModel: 'indrasnet/gen_anime',
      taskProvider: 'Asus / IndrasNet',
      status: 'interrupted',
      resumeKind: 'indrasnet',
      externalTaskId: 'expired-after-cache',
      version: 2,
      startedAt: Date.now() - 5000,
      updatedAt: Date.now(),
      estimateSampleCount: 0,
    };
    imageCacheHasMock.mockResolvedValueOnce(true);
    applyResumedImageJobArtifactMock.mockResolvedValueOnce({
      imageState: { isLoading: false, data: '', error: null },
      metrics: { chapterId: 'chapter-1', lastModel: 'indrasnet/gen_anime' },
    });

    await slice.resumeInterruptedImageJobs();

    expect(imageCacheHasMock).toHaveBeenCalledWith({
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      version: 2,
    });
    expect(resumeImageJobMock).not.toHaveBeenCalled();
    expect(applyResumedImageJobArtifactMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cached-job' }),
      expect.anything(),
      expect.objectContaining({
        imageData: '',
        imageCacheKey: {
          chapterId: 'chapter-1',
          placementMarker: '[ILLUSTRATION-1]',
          version: 2,
        },
      }),
    );
    expect(slice.imageJobs['cached-job']).toMatchObject({ status: 'completed' });
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
      metrics: { chapterId: 'chapter-1', count: 1, totalTime: 5, totalCost: 0.03, lastModel: 'Qubico/flux1-dev' },
    });

    await slice.resumeInterruptedImageJobs();

    expect(resumeImageJobMock).toHaveBeenCalledTimes(1);
    expect(slice.generatedImages['chapter-1:[ILLUSTRATION-1]']?.data).toBe('recovered-image');
    expect(slice.imageVersions['chapter-1:[ILLUSTRATION-1]']).toBe(2);
    expect(slice.imageJobs['saved-job'].status).toBe('completed');
    expect(slice.imageJobs['saved-job'].durationSeconds).toBeUndefined();
    expect(slice.showNotification).toHaveBeenCalledWith(
      'A previously submitted illustration is ready in its originating chapter.',
      'success',
    );
  });

  it('uses the recovered running clock instead of aggregate PiAPI polling time', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    try {
      const slice = createSlice();
      slice.imageJobs['timed-job'] = {
        id: 'timed-job',
        chapterId: 'chapter-1',
        placementMarker: '[ILLUSTRATION-1]',
        requestedModel: 'Qubico/flux1-dev',
        requestedProvider: 'PiAPI',
        status: 'interrupted',
        resumeKind: 'piapi',
        externalTaskId: 'task-timed',
        version: 2,
        startedAt: 100,
        updatedAt: 100,
        estimateSampleCount: 0,
      };
      resumeImageJobMock.mockImplementation(async (job, context) => {
        now.mockReturnValue(5_000);
        context.onJobEvent(job.placementMarker, { type: 'running' });
        now.mockReturnValue(8_000);
        return {
          imageState: { isLoading: false, data: 'recovered-image', error: null },
          metrics: { chapterId: 'chapter-1', count: 1, totalTime: 99, totalCost: 0.03, lastModel: 'Qubico/flux1-dev' },
        };
      });

      await slice.resumeInterruptedImageJobs();

      expect(slice.imageJobs['timed-job']).toMatchObject({
        status: 'completed',
        startedAt: 5_000,
        durationSeconds: 3,
      });
    } finally {
      now.mockRestore();
    }
  });

  it('recovers an IndrasNet task from the broker origin that accepted it', async () => {
    const slice = createSlice();
    slice.settings.indrasNetBaseUrl = 'https://new-broker.example';
    slice.imageJobs['saved-indras-job'] = {
      id: 'saved-indras-job',
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      requestedModel: 'indrasnet/gen_anime',
      requestedProvider: 'Asus / IndrasNet',
      taskModel: 'indrasnet/gen_anime',
      taskProvider: 'Asus / IndrasNet',
      brokerBaseUrl: 'https://original-broker.example',
      status: 'interrupted',
      resumeKind: 'indrasnet',
      externalTaskId: 'broker-task-123',
      version: 2,
      startedAt: Date.now() - 5000,
      updatedAt: Date.now(),
      estimateSampleCount: 0,
    };
    resumeImageJobMock.mockResolvedValue({
      imageState: { isLoading: false, data: 'recovered-image', error: null },
      metrics: { chapterId: 'chapter-1', count: 1, totalTime: 5, totalCost: 0, lastModel: 'indrasnet/gen_anime' },
    });

    await slice.resumeInterruptedImageJobs();

    expect(resumeImageJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'saved-indras-job' }),
      expect.objectContaining({
        settings: expect.objectContaining({ indrasNetBaseUrl: 'https://original-broker.example' }),
      }),
    );
    expect(slice.imageJobs['saved-indras-job'].status).toBe('completed');
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
    expect(slice.imageJobs['saved-job'].status).toBe('submitted');

    deferred.resolve({
      imageState: { isLoading: false, data: 'recovered-image', error: null },
      metrics: { chapterId: 'chapter-1', count: 1, totalTime: 5, totalCost: 0.03, lastModel: 'Qubico/flux1-dev' },
    });
    await firstRecovery;
  });

  it('resumes restored provider tasks independently without head-of-line blocking', async () => {
    const slice = createSlice();
    const first = createDeferred<any>();
    slice.imageJobs['slow-job'] = {
      id: 'slow-job', chapterId: 'chapter-1', placementMarker: '[ILLUSTRATION-1]',
      requestedModel: 'Qubico/flux1-dev', requestedProvider: 'PiAPI', status: 'interrupted',
      resumeKind: 'piapi', externalTaskId: 'task-slow', version: 2,
      startedAt: Date.now() - 5000, updatedAt: Date.now(), estimateSampleCount: 0,
    };
    slice.imageJobs['fast-job'] = {
      id: 'fast-job', chapterId: 'chapter-1', placementMarker: '[ILLUSTRATION-2]',
      requestedModel: 'Qubico/flux1-dev', requestedProvider: 'PiAPI', status: 'interrupted',
      resumeKind: 'piapi', externalTaskId: 'task-fast', version: 2,
      startedAt: Date.now() - 5000, updatedAt: Date.now(), estimateSampleCount: 0,
    };
    resumeImageJobMock.mockImplementation(job => job.id === 'slow-job'
      ? first.promise
      : Promise.resolve({
          imageState: { isLoading: false, data: 'fast-image', error: null },
          metrics: { chapterId: 'chapter-1', count: 1, totalTime: 1, totalCost: 0.03, lastModel: 'Qubico/flux1-dev' },
        }));

    const recovery = slice.resumeInterruptedImageJobs();
    await vi.waitFor(() => expect(slice.imageJobs['fast-job'].status).toBe('completed'));
    expect(slice.imageJobs['slow-job'].status).toBe('submitted');

    first.resolve({
      imageState: { isLoading: false, data: 'slow-image', error: null },
      metrics: { chapterId: 'chapter-1', count: 1, totalTime: 5, totalCost: 0.03, lastModel: 'Qubico/flux1-dev' },
    });
    await recovery;
    expect(slice.imageJobs['slow-job'].status).toBe('completed');
  });

  it('hydrates an evicted shared origin once and serializes result application', async () => {
    const slice = createSlice();
    const originalChapter = slice.chapters.get('chapter-1');
    slice.chapters.delete('chapter-1');
    const loadChapterFromIDB = vi.fn(async () => {
      slice.chapters.set('chapter-1', structuredClone(originalChapter));
    });
    (slice as any).loadChapterFromIDB = loadChapterFromIDB;
    slice.imageJobs['first-job'] = {
      id: 'first-job', chapterId: 'chapter-1', placementMarker: '[ILLUSTRATION-1]',
      requestedModel: 'Qubico/flux1-dev', requestedProvider: 'PiAPI', status: 'interrupted',
      resumeKind: 'piapi', externalTaskId: 'task-first', version: 2,
      startedAt: Date.now() - 5000, updatedAt: Date.now(), estimateSampleCount: 0,
    };
    slice.imageJobs['second-job'] = {
      id: 'second-job', chapterId: 'chapter-1', placementMarker: '[ILLUSTRATION-2]',
      requestedModel: 'Qubico/flux1-dev', requestedProvider: 'PiAPI', status: 'interrupted',
      resumeKind: 'piapi', externalTaskId: 'task-second', version: 2,
      startedAt: Date.now() - 5000, updatedAt: Date.now(), estimateSampleCount: 0,
    };
    const artifact = (data: string) => ({
      imageState: { isLoading: false, data, error: null },
      metrics: { chapterId: 'chapter-1', count: 1, totalTime: 1, totalCost: 0.03, lastModel: 'Qubico/flux1-dev' },
    });
    resumeImageJobMock.mockImplementation(job => Promise.resolve(artifact(job.id)));
    const firstApplication = createDeferred<any>();
    applyResumedImageJobArtifactMock
      .mockImplementationOnce(() => firstApplication.promise)
      .mockImplementationOnce((_job, _context, result) => Promise.resolve(result));

    const recovery = slice.resumeInterruptedImageJobs();
    await vi.waitFor(() => expect(resumeImageJobMock).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(applyResumedImageJobArtifactMock).toHaveBeenCalledTimes(1));
    expect(loadChapterFromIDB).toHaveBeenCalledTimes(1);

    firstApplication.resolve(artifact('first-image'));
    await recovery;
    expect(applyResumedImageJobArtifactMock).toHaveBeenCalledTimes(2);
    expect(slice.imageJobs['first-job'].status).toBe('completed');
    expect(slice.imageJobs['second-job'].status).toBe('completed');
  });

  it('does not poll the provider until the originating translation marker hydrates', async () => {
    const slice = createSlice();
    slice.chapters.set('chapter-1', {
      id: 'chapter-1',
      _translationLoadError: 'IndexedDB transaction aborted',
    });
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

    await slice.resumeInterruptedImageJobs();

    expect(resumeImageJobMock).not.toHaveBeenCalled();
    expect(slice.imageJobs['saved-job']).toMatchObject({
      status: 'interrupted',
      externalTaskId: 'broker-task-123',
      error: expect.stringContaining('could not hydrate its translation'),
    });
  });

  it('retires a durable task whose stable originating marker is genuinely gone', async () => {
    const slice = createSlice();
    slice.imageJobs['orphaned-job'] = {
      id: 'orphaned-job',
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-99]',
      requestedModel: 'indrasnet/gen_anime',
      requestedProvider: 'Asus / IndrasNet',
      status: 'interrupted',
      resumeKind: 'indrasnet',
      externalTaskId: 'broker-task-orphaned',
      version: 2,
      startedAt: Date.now() - 5000,
      updatedAt: Date.now(),
      estimateSampleCount: 0,
    };

    await slice.resumeInterruptedImageJobs();

    expect(resumeImageJobMock).not.toHaveBeenCalled();
    expect(slice.imageJobs['orphaned-job']).toMatchObject({
      status: 'failed',
      externalTaskId: 'broker-task-orphaned',
      error: expect.stringContaining('Originating illustration [ILLUSTRATION-99] is unavailable'),
    });
    expect(localStorage.getItem('LF_RESUMABLE_IMAGE_JOBS_V1')).toBeNull();
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

  it('keeps an unsaved paused task actionable in the current tab', async () => {
    const setItem = vi.spyOn(Object.getPrototypeOf(localStorage), 'setItem')
      .mockImplementation(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const slice = createSlice();
      slice.imageJobs['unsaved-job'] = {
        id: 'unsaved-job',
        chapterId: 'chapter-1',
        placementMarker: '[ILLUSTRATION-1]',
        requestedModel: 'indrasnet/storybook',
        requestedProvider: 'IndrasNet',
        status: 'interrupted',
        resumeKind: 'indrasnet',
        externalTaskId: 'broker-task-unsaved',
        version: 2,
        startedAt: Date.now() - 5000,
        updatedAt: Date.now(),
        estimateSampleCount: 0,
        recoveryPersistenceError: 'Reload recovery is unavailable. Keep this tab open.',
      };
      resumeImageJobMock.mockRejectedValueOnce(Object.assign(
        new Error('IndrasNet is unreachable from this device.'),
        { retryable: true },
      ));

      await slice.resumeInterruptedImageJobs();

      expect(slice.imageJobs['unsaved-job']).toMatchObject({
        status: 'interrupted',
        externalTaskId: 'broker-task-unsaved',
        recoveryPersistenceError: expect.stringMatching(/reload recovery is unavailable.*keep this tab open/i),
      });
      expect(slice.showNotification).toHaveBeenCalledWith(
        expect.stringMatching(/exists only in this tab.*resume the existing task without reloading/i),
        'error',
      );
    } finally {
      setItem.mockRestore();
      consoleError.mockRestore();
    }
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

  it('retires a terminal PiAPI task reported with canRetry false', async () => {
    const slice = createSlice();
    slice.imageJobs['pi-expired-job'] = {
      id: 'pi-expired-job',
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      requestedModel: 'Qubico/flux1-dev',
      requestedProvider: 'PiAPI',
      status: 'interrupted',
      resumeKind: 'piapi',
      externalTaskId: 'pi-expired-task',
      version: 2,
      startedAt: Date.now() - 5000,
      updatedAt: Date.now(),
      estimateSampleCount: 0,
    };
    resumeImageJobMock.mockRejectedValueOnce(Object.assign(
      new Error('PiAPI polling failed (404): task not found'),
      { canRetry: false },
    ));

    await slice.resumeInterruptedImageJobs();

    expect(slice.imageJobs['pi-expired-job'].status).toBe('failed');
    expect(localStorage.getItem('LF_RESUMABLE_IMAGE_JOBS_V1')).toBeNull();
  });
});
