import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createImageJobsSlice, type ImageJobsSlice } from '../../../store/slices/imageJobsSlice';

vi.mock('../../../services/apiMetricsService', () => ({
  apiMetricsService: {
    getAverageImageGenerationTime: vi.fn().mockResolvedValue({
      avgTimeSeconds: 42,
      sampleCount: 3,
      minTimeSeconds: 30,
      maxTimeSeconds: 55,
    }),
  },
}));

vi.mock('../../../services/imageService', () => ({
  imageProviderForModel: (model: string) => model.startsWith('Qubico/') ? 'PiAPI' : 'OpenRouter',
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
  beforeEach(() => localStorage.clear());

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

  it('persists the actual fallback model that owns a durable provider task', async () => {
    const slice = createSlice();
    const jobId = slice.startImageJob({
      chapterId: 'chapter-fallback',
      placementMarker: '[ILLUSTRATION-3]',
      model: 'indrasnet/gen_anime',
      version: 1,
    });

    slice.markImageJobSubmitted(jobId, 'pi-fallback-task', 'piapi', 'Qubico/flux1-dev');
    await vi.waitFor(() => expect(slice.imageJobs[jobId].estimateSampleCount).toBe(3));

    expect(slice.imageJobs[jobId]).toMatchObject({
      requestedModel: 'Qubico/flux1-dev',
      requestedProvider: 'PiAPI',
      externalTaskId: 'pi-fallback-task',
      resumeKind: 'piapi',
      estimatedDurationSeconds: 42,
      estimateSampleCount: 3,
    });
    const persisted = JSON.parse(localStorage.getItem('LF_RESUMABLE_IMAGE_JOBS_V1') || '[]');
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      requestedModel: 'Qubico/flux1-dev',
      requestedProvider: 'PiAPI',
      externalTaskId: 'pi-fallback-task',
      resumeKind: 'piapi',
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
