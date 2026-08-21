import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createImageJobsSlice, type ImageJobsSlice } from '../../../store/slices/imageJobsSlice';

const averageTimeMock = vi.hoisted(() => vi.fn());

vi.mock('../../../services/apiMetricsService', () => ({
  apiMetricsService: {
    getAverageImageGenerationTime: averageTimeMock,
  },
}));

vi.mock('../../../services/imageService', () => ({
  imageProviderForModel: (model: string) => model.startsWith('Qubico/')
    ? 'PiAPI'
    : model.startsWith('indrasnet/') ? 'Asus / IndrasNet' : 'OpenRouter',
}));

const createSlice = (): ImageJobsSlice => {
  const state: Partial<ImageJobsSlice> = {};
  const set = (partial: Partial<ImageJobsSlice> | ((previous: ImageJobsSlice) => Partial<ImageJobsSlice> | void)) => {
    const next = typeof partial === 'function' ? partial(state as ImageJobsSlice) : partial;
    if (next) Object.assign(state, next);
  };
  const get = () => state as ImageJobsSlice;
  const api = { setState: set, getState: get, subscribe: () => () => {}, destroy: () => {} } as never;
  Object.assign(state, createImageJobsSlice(set as never, get as never, api));
  return state as ImageJobsSlice;
};

describe('imageJobsSlice', () => {
  beforeEach(() => {
    localStorage.clear();
    averageTimeMock.mockReset().mockResolvedValue({
      avgTimeSeconds: 42,
      sampleCount: 3,
      minTimeSeconds: 30,
      maxTimeSeconds: 55,
    });
  });

  it('uses a job as the duplicate guard until it reaches a terminal state', () => {
    const slice = createSlice();
    const first = slice.startImageJob({
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      model: 'openrouter/model',
      version: 1,
    });
    const second = slice.startImageJob({
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      model: 'openrouter/model',
      version: 1,
    });

    expect(second).toBe(first);
    expect(slice.hasActiveImageJobs()).toBe(true);

    slice.completeImageJob(first, 'openrouter/model', 12);
    expect(slice.hasActiveImageJobs()).toBe(false);

    const third = slice.startImageJob({
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      model: 'openrouter/model',
      version: 2,
    });
    expect(third).not.toBe(first);
  });

  it('persists only jobs with durable provider task ids', () => {
    const slice = createSlice();
    const direct = slice.startImageJob({
      chapterId: 'chapter-direct',
      placementMarker: '[ILLUSTRATION-1]',
      model: 'openrouter/model',
      version: 1,
    });
    slice.markImageJobRunning(direct);
    expect(localStorage.getItem('LF_RESUMABLE_IMAGE_JOBS_V1')).toBeNull();

    const resumable = slice.startImageJob({
      chapterId: 'chapter-piapi',
      placementMarker: '[ILLUSTRATION-2]',
      model: 'Qubico/flux1-dev',
      version: 1,
    });
    slice.markImageJobSubmitted(resumable, 'task-123', 'piapi');

    const persisted = JSON.parse(localStorage.getItem('LF_RESUMABLE_IMAGE_JOBS_V1') || '[]');
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({ id: resumable, externalTaskId: 'task-123', resumeKind: 'piapi' });
  });

  it('persists the normalized broker origin with a durable IndrasNet task', () => {
    const slice = createSlice();
    const jobId = slice.startImageJob({
      chapterId: 'chapter-broker',
      placementMarker: '[ILLUSTRATION-6]',
      model: 'indrasnet/gen_anime',
      version: 1,
    });

    slice.markImageJobSubmitted(
      jobId,
      'broker-origin-task',
      'indrasnet',
      'indrasnet/gen_anime',
      undefined,
      'https://original-broker.example',
    );

    expect(slice.imageJobs[jobId]).toMatchObject({
      brokerBaseUrl: 'https://original-broker.example',
      externalTaskId: 'broker-origin-task',
    });
    expect(JSON.parse(localStorage.getItem('LF_RESUMABLE_IMAGE_JOBS_V1') || '[]')[0]).toMatchObject({
      brokerBaseUrl: 'https://original-broker.example',
      externalTaskId: 'broker-origin-task',
    });
  });

  it('persists the actual fallback model that owns a durable provider task', async () => {
    const slice = createSlice();
    const jobId = slice.startImageJob({
      chapterId: 'chapter-fallback',
      placementMarker: '[ILLUSTRATION-3]',
      model: 'indrasnet/gen_anime',
      version: 1,
    });

    const fallback = {
      attemptedProvider: 'Asus / IndrasNet',
      attemptedModel: 'indrasnet/gen_anime',
      reasonCode: 'COMFYUI_OFFLINE',
      reason: 'broker offline',
    };
    slice.markImageJobSubmitted(jobId, 'pi-fallback-task', 'piapi', 'Qubico/flux1-dev', fallback);
    await vi.waitFor(() => expect(slice.imageJobs[jobId].estimateSampleCount).toBe(3));

    expect(slice.imageJobs[jobId]).toMatchObject({
      requestedModel: 'indrasnet/gen_anime',
      requestedProvider: 'Asus / IndrasNet',
      taskModel: 'Qubico/flux1-dev',
      taskProvider: 'PiAPI',
      fallback,
      externalTaskId: 'pi-fallback-task',
      resumeKind: 'piapi',
      estimatedDurationSeconds: 42,
      estimateSampleCount: 3,
    });
    const persisted = JSON.parse(localStorage.getItem('LF_RESUMABLE_IMAGE_JOBS_V1') || '[]');
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      requestedModel: 'indrasnet/gen_anime',
      taskModel: 'Qubico/flux1-dev',
      taskProvider: 'PiAPI',
      fallback,
      externalTaskId: 'pi-fallback-task',
      resumeKind: 'piapi',
    });
  });

  it('switches exact-model ETA for a non-durable fallback without persisting a task', async () => {
    const slice = createSlice();
    const jobId = slice.startImageJob({
      chapterId: 'chapter-direct-fallback',
      placementMarker: '[ILLUSTRATION-5]',
      model: 'indrasnet/gen_anime',
      version: 1,
    });
    const fallback = {
      attemptedProvider: 'Asus / IndrasNet',
      attemptedModel: 'indrasnet/gen_anime',
      reasonCode: 'COMFYUI_OFFLINE',
      reason: 'broker offline',
    };

    slice.markImageJobRunning(jobId);
    slice.markImageJobProviderSwitched(jobId, 'openrouter/fallback-model', fallback);
    await vi.waitFor(() => expect(slice.imageJobs[jobId].estimateSampleCount).toBe(3));

    expect(slice.imageJobs[jobId]).toMatchObject({
      requestedModel: 'indrasnet/gen_anime',
      taskModel: 'openrouter/fallback-model',
      taskProvider: 'OpenRouter',
      fallback,
      resumeKind: 'none',
      status: 'running',
      estimatedDurationSeconds: 42,
    });
    expect(localStorage.getItem('LF_RESUMABLE_IMAGE_JOBS_V1')).toBeNull();
  });

  it('does not let the requested-model ETA overwrite fallback-model history', async () => {
    let resolveRequestedEstimate!: (_value: unknown) => void;
    const requestedEstimate = new Promise<unknown>(resolve => { resolveRequestedEstimate = resolve; });
    averageTimeMock
      .mockReturnValueOnce(requestedEstimate)
      .mockResolvedValueOnce({ avgTimeSeconds: 42, sampleCount: 3 });
    const slice = createSlice();
    const jobId = slice.startImageJob({
      chapterId: 'chapter-race',
      placementMarker: '[ILLUSTRATION-4]',
      model: 'indrasnet/gen_anime',
      version: 1,
    });

    slice.markImageJobSubmitted(jobId, 'pi-race-task', 'piapi', 'Qubico/flux1-dev');
    await vi.waitFor(() => expect(slice.imageJobs[jobId].estimatedDurationSeconds).toBe(42));
    resolveRequestedEstimate({ avgTimeSeconds: 900, sampleCount: 10 });
    await Promise.resolve();
    await Promise.resolve();

    expect(slice.imageJobs[jobId]).toMatchObject({
      taskModel: 'Qubico/flux1-dev',
      estimatedDurationSeconds: 42,
      estimateSampleCount: 3,
    });
  });

  it('keeps the first completion duration when a batch emits a final aggregate callback', () => {
    const slice = createSlice();
    const id = slice.startImageJob({
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      model: 'openrouter/model',
      version: 1,
    });

    slice.completeImageJob(id, 'openrouter/model', 12);
    slice.completeImageJob(id, 'openrouter/model', 99);

    expect(slice.imageJobs[id].durationSeconds).toBe(12);
  });

  it('leaves duration unknown when recovered work is terminal before execution is observed', () => {
    const slice = createSlice();
    const id = slice.startImageJob({
      chapterId: 'chapter-terminal-first',
      placementMarker: '[ILLUSTRATION-1]',
      model: 'Qubico/flux1-dev',
      version: 1,
    });

    slice.markImageJobSubmitted(id, 'pi-already-complete', 'piapi');
    slice.completeImageJob(id, 'Qubico/flux1-dev');

    expect(slice.imageJobs[id]).toMatchObject({ status: 'completed' });
    expect(slice.imageJobs[id].durationSeconds).toBeUndefined();
  });

  it('starts the execution clock when a queued job actually begins', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    try {
      const slice = createSlice();
      const id = slice.startImageJob({
        chapterId: 'chapter-clock',
        placementMarker: '[ILLUSTRATION-1]',
        model: 'openrouter/model',
        version: 1,
      });

      expect(slice.imageJobs[id]).toMatchObject({ status: 'queued', startedAt: 1_000 });
      now.mockReturnValue(5_000);
      slice.markImageJobRunning(id);
      expect(slice.imageJobs[id]).toMatchObject({ status: 'running', startedAt: 5_000 });

      now.mockReturnValue(9_000);
      slice.markImageJobRunning(id);
      expect(slice.imageJobs[id]).toMatchObject({ status: 'running', startedAt: 5_000 });
    } finally {
      now.mockRestore();
    }
  });

  it('starts the execution clock when provider-submitted work begins running', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    try {
      const slice = createSlice();
      const id = slice.startImageJob({
        chapterId: 'chapter-provider-clock',
        placementMarker: '[ILLUSTRATION-1]',
        model: 'Qubico/flux1-dev',
        version: 1,
      });

      now.mockReturnValue(2_000);
      slice.markImageJobSubmitted(id, 'pi-task-1', 'piapi');
      expect(slice.imageJobs[id]).toMatchObject({ status: 'submitted', startedAt: 1_000 });

      now.mockReturnValue(8_000);
      slice.markImageJobRunning(id);
      expect(slice.imageJobs[id]).toMatchObject({ status: 'running', startedAt: 8_000 });

      now.mockReturnValue(9_000);
      slice.markImageJobRunning(id);
      expect(slice.imageJobs[id]).toMatchObject({ status: 'running', startedAt: 8_000 });
    } finally {
      now.mockRestore();
    }
  });

  it('starts a fresh exact-model clock when fallback takes task ownership', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    try {
      const slice = createSlice();
      const id = slice.startImageJob({
        chapterId: 'chapter-fallback-clock',
        placementMarker: '[ILLUSTRATION-1]',
        model: 'indrasnet/gen_anime',
        version: 1,
      });
      slice.markImageJobRunning(id);

      now.mockReturnValue(8_000);
      slice.markImageJobProviderSwitched(id, 'Qubico/flux1-dev', {
        attemptedProvider: 'Asus / IndrasNet',
        attemptedModel: 'indrasnet/gen_anime',
        reasonCode: 'COMFYUI_OFFLINE',
        reason: 'broker offline',
      });
      expect(slice.imageJobs[id]).toMatchObject({ taskModel: 'Qubico/flux1-dev', startedAt: 8_000 });

      now.mockReturnValue(9_000);
      slice.markImageJobSubmitted(id, 'fallback-task', 'piapi', 'Qubico/flux1-dev');
      expect(slice.imageJobs[id].startedAt).toBe(8_000);
    } finally {
      now.mockRestore();
    }
  });

  it('restores a durable provider task as interrupted instead of replaying a paid request', () => {
    localStorage.setItem('LF_RESUMABLE_IMAGE_JOBS_V1', JSON.stringify([{
      id: 'saved-job',
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      requestedModel: 'Qubico/flux1-dev',
      requestedProvider: 'PiAPI',
      status: 'running',
      resumeKind: 'piapi',
      externalTaskId: 'task-123',
      version: 1,
      startedAt: 10,
      updatedAt: 10,
      estimateSampleCount: 0,
    }]));

    const slice = createSlice();
    expect(slice.imageJobs['saved-job']).toMatchObject({ status: 'interrupted', externalTaskId: 'task-123' });
    // Recovery is paused, so it should not trigger the browser's generic
    // in-progress guard even though it still blocks a duplicate submission.
    expect(slice.hasActiveImageJobs()).toBe(false);

    const duplicate = slice.startImageJob({
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      model: 'Qubico/flux1-dev',
      version: 2,
    });
    expect(duplicate).toBe('saved-job');

    slice.dismissImageJob('saved-job');
    const replacement = slice.startImageJob({
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      model: 'Qubico/flux1-dev',
      version: 2,
    });
    expect(replacement).not.toBe('saved-job');
  });
});
