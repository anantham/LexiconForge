import type { StateCreator } from 'zustand';
import { apiMetricsService } from '../../services/apiMetricsService';
import { imageProviderForModel } from '../../services/imageService';
import type { ImageJobResumeKind } from '../../services/imageJobTypes';
import type { StoreState } from '../storeTypes';

export type ImageJobStatus = 'queued' | 'submitted' | 'running' | 'completed' | 'failed' | 'interrupted';

export interface ImageJob {
  id: string;
  chapterId: string;
  placementMarker: string;
  requestedModel: string;
  requestedProvider: string;
  executedModel?: string;
  status: ImageJobStatus;
  resumeKind: ImageJobResumeKind;
  externalTaskId?: string;
  version: number;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  durationSeconds?: number;
  estimatedDurationSeconds?: number;
  estimateSampleCount: number;
  error?: string;
}

const STORAGE_KEY = 'LF_RESUMABLE_IMAGE_JOBS_V1';
const ACTIVE_STATUSES = new Set<ImageJobStatus>(['queued', 'submitted', 'running']);

const newId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `image-job-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const loadRecoverableJobs = (): Record<string, ImageJob> => {
  if (typeof localStorage === 'undefined') return {};
  try {
    const decoded = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as unknown;
    if (!Array.isArray(decoded)) return {};
    return decoded.reduce<Record<string, ImageJob>>((jobs, candidate) => {
      if (!candidate || typeof candidate !== 'object') return jobs;
      const job = candidate as ImageJob;
      if (!job.id || !job.chapterId || !job.placementMarker || !job.externalTaskId) return jobs;
      if (job.resumeKind !== 'piapi' && job.resumeKind !== 'indrasnet') return jobs;
      jobs[job.id] = { ...job, status: 'interrupted', updatedAt: Date.now() };
      return jobs;
    }, {});
  } catch (error) {
    console.error('[ImageJobs] Failed to restore resumable image jobs:', error);
    return {};
  }
};

const persistRecoverableJobs = (jobs: Record<string, ImageJob>): void => {
  if (typeof localStorage === 'undefined') return;
  const recoverable = Object.values(jobs).filter(job =>
    (job.resumeKind === 'piapi' || job.resumeKind === 'indrasnet')
    && Boolean(job.externalTaskId)
    && (ACTIVE_STATUSES.has(job.status) || job.status === 'interrupted')
  );
  try {
    if (recoverable.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(recoverable));
  } catch (error) {
    console.error('[ImageJobs] Failed to persist resumable image jobs:', error);
  }
};

export interface ImageJobsState {
  imageJobs: Record<string, ImageJob>;
}

export interface ImageJobsActions {
  startImageJob: (input: {
    chapterId: string;
    placementMarker: string;
    model: string;
    version: number;
  }) => string;
  markImageJobSubmitted: (jobId: string, externalTaskId: string, resumeKind: Exclude<ImageJobResumeKind, 'none'>) => void;
  markImageJobRunning: (jobId: string) => void;
  completeImageJob: (jobId: string, executedModel?: string, durationSeconds?: number) => void;
  failImageJob: (jobId: string, error: string) => void;
  interruptImageJob: (jobId: string, error: string) => void;
  dismissImageJob: (jobId: string) => void;
  getActiveImageJobFor: (chapterId: string, placementMarker: string) => ImageJob | null;
  hasActiveImageJobs: () => boolean;
}

export type ImageJobsSlice = ImageJobsState & ImageJobsActions;

export const createImageJobsSlice: StateCreator<StoreState, [], [], ImageJobsSlice> = (set, get) => ({
  imageJobs: loadRecoverableJobs(),

  startImageJob: ({ chapterId, placementMarker, model, version }) => {
    const existing = get().getActiveImageJobFor(chapterId, placementMarker);
    if (existing) return existing.id;

    const id = newId();
    const now = Date.now();
    const job: ImageJob = {
      id,
      chapterId,
      placementMarker,
      requestedModel: model,
      requestedProvider: imageProviderForModel(model),
      status: 'queued',
      resumeKind: 'none',
      version,
      startedAt: now,
      updatedAt: now,
      estimateSampleCount: 0,
    };
    set(state => ({ imageJobs: { ...state.imageJobs, [id]: job } }));

    void apiMetricsService.getAverageImageGenerationTime(model).then(estimate => {
      if (!estimate) return;
      set(state => {
        const current = state.imageJobs[id];
        if (!current || !ACTIVE_STATUSES.has(current.status)) return {};
        return {
          imageJobs: {
            ...state.imageJobs,
            [id]: {
              ...current,
              estimatedDurationSeconds: estimate.avgTimeSeconds,
              estimateSampleCount: estimate.sampleCount,
              updatedAt: Date.now(),
            },
          },
        };
      });
    }).catch(error => console.warn('[ImageJobs] Failed to load empirical ETA:', error));

    return id;
  },

  markImageJobSubmitted: (jobId, externalTaskId, resumeKind) => set(state => {
    const current = state.imageJobs[jobId];
    if (!current) return {};
    const imageJobs = {
      ...state.imageJobs,
      [jobId]: { ...current, externalTaskId, resumeKind, status: 'submitted' as const, updatedAt: Date.now() },
    };
    persistRecoverableJobs(imageJobs);
    return { imageJobs };
  }),

  markImageJobRunning: (jobId) => set(state => {
    const current = state.imageJobs[jobId];
    if (!current) return {};
    const imageJobs = {
      ...state.imageJobs,
      [jobId]: { ...current, status: 'running' as const, updatedAt: Date.now() },
    };
    persistRecoverableJobs(imageJobs);
    return { imageJobs };
  }),

  completeImageJob: (jobId, executedModel, durationSeconds) => set(state => {
    const current = state.imageJobs[jobId];
    if (!current) return {};
    // Batch generation emits an immediate per-image completion and a final
    // aggregate callback. Preserve the first terminal timestamp/duration so
    // an early image is not reported as taking the whole batch wall time.
    if (current.status === 'completed' || current.status === 'failed') return {};
    const completedAt = Date.now();
    const imageJobs = {
      ...state.imageJobs,
      [jobId]: {
        ...current,
        status: 'completed' as const,
        executedModel: executedModel || current.requestedModel,
        durationSeconds: durationSeconds ?? (completedAt - current.startedAt) / 1000,
        completedAt,
        updatedAt: completedAt,
      },
    };
    persistRecoverableJobs(imageJobs);
    return { imageJobs };
  }),

  failImageJob: (jobId, error) => set(state => {
    const current = state.imageJobs[jobId];
    if (!current) return {};
    const now = Date.now();
    const imageJobs = {
      ...state.imageJobs,
      [jobId]: { ...current, status: 'failed' as const, error, completedAt: now, updatedAt: now },
    };
    persistRecoverableJobs(imageJobs);
    return { imageJobs };
  }),

  interruptImageJob: (jobId, error) => set(state => {
    const current = state.imageJobs[jobId];
    if (!current) return {};
    const imageJobs = {
      ...state.imageJobs,
      [jobId]: { ...current, status: 'interrupted' as const, error, completedAt: undefined, updatedAt: Date.now() },
    };
    persistRecoverableJobs(imageJobs);
    return { imageJobs };
  }),

  dismissImageJob: (jobId) => set(state => {
    const imageJobs = { ...state.imageJobs };
    delete imageJobs[jobId];
    persistRecoverableJobs(imageJobs);
    return { imageJobs };
  }),

  getActiveImageJobFor: (chapterId, placementMarker) => {
    return Object.values(get().imageJobs).find(job =>
      job.chapterId === chapterId
      && job.placementMarker === placementMarker
      && ACTIVE_STATUSES.has(job.status)
    ) || null;
  },

  hasActiveImageJobs: () => Object.values(get().imageJobs).some(job => ACTIVE_STATUSES.has(job.status)),
});
