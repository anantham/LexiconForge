import type { StateCreator } from 'zustand';
import { apiMetricsService } from '../../services/apiMetricsService';
import { imageProviderForModel } from '../../services/imageService';
import {
  RESUMABLE_IMAGE_JOBS_STORAGE_KEY,
  type ImageJobResumeKind,
} from '../../services/imageJobTypes';
import type { StoreState } from '../storeTypes';
import type { ImageExecutionMetadata } from '../../types';

export type ImageJobStatus = 'queued' | 'submitted' | 'running' | 'completed' | 'failed' | 'interrupted';

export interface ImageJob {
  id: string;
  chapterId: string;
  placementMarker: string;
  requestedModel: string;
  requestedProvider: string;
  taskModel?: string;
  taskProvider?: string;
  fallback?: ImageExecutionMetadata['fallback'];
  brokerBaseUrl?: string;
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
  recoveryPersistenceError?: string;
}

const ACTIVE_STATUSES = new Set<ImageJobStatus>(['queued', 'submitted', 'running']);

const blocksDuplicateSubmission = (job: ImageJob): boolean =>
  ACTIVE_STATUSES.has(job.status)
  || (
    job.status === 'interrupted'
    && (job.resumeKind === 'piapi' || job.resumeKind === 'indrasnet')
    && Boolean(job.externalTaskId)
  );

const newId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `image-job-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const loadRecoverableJobs = (): Record<string, ImageJob> => {
  if (typeof localStorage === 'undefined') return {};
  try {
    const decoded = JSON.parse(localStorage.getItem(RESUMABLE_IMAGE_JOBS_STORAGE_KEY) || '[]') as unknown;
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

const RECOVERY_PERSISTENCE_ERROR = 'Reload recovery is unavailable because this browser could not save the provider task ID. Keep this tab open.';

const withoutRecoveryPersistenceErrors = (jobs: Record<string, ImageJob>): Record<string, ImageJob> =>
  Object.fromEntries(Object.entries(jobs).map(([id, job]) => {
    if (!job.recoveryPersistenceError) return [id, job];
    const { recoveryPersistenceError: _recoveryPersistenceError, ...persistableJob } = job;
    return [id, persistableJob];
  }));

const persistRecoverableJobs = (
  jobs: Record<string, ImageJob>,
  warnJobIdOnFailure?: string,
): Record<string, ImageJob> => {
  const persistableJobs = withoutRecoveryPersistenceErrors(jobs);
  const recoverable = Object.values(persistableJobs).filter(job =>
    (job.resumeKind === 'piapi' || job.resumeKind === 'indrasnet')
    && Boolean(job.externalTaskId)
    && (ACTIVE_STATUSES.has(job.status) || job.status === 'interrupted')
  );
  try {
    if (typeof localStorage === 'undefined') {
      if (recoverable.length === 0) return persistableJobs;
      throw new Error('Browser localStorage is unavailable.');
    }
    if (recoverable.length === 0) localStorage.removeItem(RESUMABLE_IMAGE_JOBS_STORAGE_KEY);
    else localStorage.setItem(RESUMABLE_IMAGE_JOBS_STORAGE_KEY, JSON.stringify(recoverable));
  } catch (error) {
    console.error('[ImageJobs] Failed to persist resumable image jobs:', error);
    if (!warnJobIdOnFailure) return jobs;
    const job = jobs[warnJobIdOnFailure];
    if (!job || !recoverable.some(candidate => candidate.id === warnJobIdOnFailure)) return jobs;
    return {
      ...jobs,
      [warnJobIdOnFailure]: {
        ...job,
        recoveryPersistenceError: RECOVERY_PERSISTENCE_ERROR,
      },
    };
  }
  return persistableJobs;
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
  markImageJobSubmitted: (
    jobId: string,
    externalTaskId: string,
    resumeKind: Exclude<ImageJobResumeKind, 'none'>,
    _submittedModel?: string,
    _fallback?: ImageExecutionMetadata['fallback'],
    _brokerBaseUrl?: string,
  ) => void;
  markImageJobProviderSwitched: (
    _jobId: string,
    _model: string,
    _fallback: NonNullable<ImageExecutionMetadata['fallback']>,
  ) => void;
  markImageJobRunning: (jobId: string) => void;
  completeImageJob: (jobId: string, executedModel?: string, durationSeconds?: number) => void;
  failImageJob: (jobId: string, error: string) => void;
  interruptImageJob: (jobId: string, error: string) => void;
  dismissImageJob: (jobId: string) => void;
  getActiveImageJobFor: (chapterId: string, placementMarker: string) => ImageJob | null;
  hasActiveImageJobs: () => boolean;
}

export type ImageJobsSlice = ImageJobsState & ImageJobsActions;

export const createImageJobsSlice: StateCreator<StoreState, [], [], ImageJobsSlice> = (set, get) => {
  const assignTaskOwner = (
    jobId: string,
    taskModel: string,
    fallback?: ImageExecutionMetadata['fallback'],
  ): void => {
    let ownerChanged = false;
    set(state => {
      const current = state.imageJobs[jobId];
      if (!current) return {};
      ownerChanged = taskModel !== (current.taskModel ?? current.requestedModel);
      const updatedAt = Date.now();
      const imageJobs = {
        ...state.imageJobs,
        [jobId]: {
          ...current,
          taskModel,
          taskProvider: imageProviderForModel(taskModel),
          fallback: fallback ?? current.fallback,
          ...(ownerChanged ? {
            startedAt: updatedAt,
            estimatedDurationSeconds: undefined,
            estimateSampleCount: 0,
          } : {}),
          updatedAt,
        },
      };
      return { imageJobs: persistRecoverableJobs(imageJobs) };
    });
    if (!ownerChanged) return;
    void apiMetricsService.getAverageImageGenerationTime(taskModel).then(estimate => {
      if (!estimate) return;
      set(state => {
        const current = state.imageJobs[jobId];
        if (!current || current.taskModel !== taskModel || !ACTIVE_STATUSES.has(current.status)) return {};
        return {
          imageJobs: {
            ...state.imageJobs,
            [jobId]: {
              ...current,
              estimatedDurationSeconds: estimate.avgTimeSeconds,
              estimateSampleCount: estimate.sampleCount,
              updatedAt: Date.now(),
            },
          },
        };
      });
    }).catch(error => console.warn('[ImageJobs] Failed to refresh empirical ETA after provider switch:', error));
  };

  return {
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
        if (
          !current
          || !ACTIVE_STATUSES.has(current.status)
          || (current.taskModel ?? current.requestedModel) !== model
        ) return {};
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

  markImageJobSubmitted: (jobId, externalTaskId, resumeKind, submittedModel, fallback, brokerBaseUrl) => {
    const current = get().imageJobs[jobId];
    if (!current) return;
    assignTaskOwner(jobId, submittedModel || current.taskModel || current.requestedModel, fallback);
    set(state => {
      const current = state.imageJobs[jobId];
      if (!current) return {};
      const imageJobs = {
        ...state.imageJobs,
        [jobId]: {
          ...current,
          externalTaskId,
          resumeKind,
          brokerBaseUrl: brokerBaseUrl ?? current.brokerBaseUrl,
          status: 'submitted' as const,
          updatedAt: Date.now(),
        },
      };
      return { imageJobs: persistRecoverableJobs(imageJobs, jobId) };
    });
  },

  markImageJobProviderSwitched: (jobId, model, fallback) => assignTaskOwner(jobId, model, fallback),

  markImageJobRunning: (jobId) => set(state => {
    const current = state.imageJobs[jobId];
    if (!current) return {};
    const now = Date.now();
    const executionStarting = current.status === 'queued'
      || current.status === 'submitted'
      || current.status === 'interrupted';
    const imageJobs = {
      ...state.imageJobs,
      [jobId]: {
        ...current,
        status: 'running' as const,
        startedAt: executionStarting ? now : current.startedAt,
        updatedAt: now,
      },
    };
    return { imageJobs: persistRecoverableJobs(imageJobs) };
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
        executedModel: executedModel || current.taskModel || current.requestedModel,
        durationSeconds: durationSeconds ?? (current.status === 'running'
          ? (completedAt - current.startedAt) / 1000
          : undefined),
        completedAt,
        updatedAt: completedAt,
      },
    };
    return { imageJobs: persistRecoverableJobs(imageJobs) };
  }),

  failImageJob: (jobId, error) => set(state => {
    const current = state.imageJobs[jobId];
    if (!current) return {};
    const now = Date.now();
    const imageJobs = {
      ...state.imageJobs,
      [jobId]: { ...current, status: 'failed' as const, error, completedAt: now, updatedAt: now },
    };
    return { imageJobs: persistRecoverableJobs(imageJobs) };
  }),

  interruptImageJob: (jobId, error) => set(state => {
    const current = state.imageJobs[jobId];
    if (!current) return {};
    const imageJobs = {
      ...state.imageJobs,
      [jobId]: { ...current, status: 'interrupted' as const, error, completedAt: undefined, updatedAt: Date.now() },
    };
    return { imageJobs: persistRecoverableJobs(imageJobs) };
  }),

  dismissImageJob: (jobId) => set(state => {
    const imageJobs = { ...state.imageJobs };
    delete imageJobs[jobId];
    return { imageJobs: persistRecoverableJobs(imageJobs) };
  }),

  getActiveImageJobFor: (chapterId, placementMarker) => {
    return Object.values(get().imageJobs).find(job =>
      job.chapterId === chapterId
      && job.placementMarker === placementMarker
      && blocksDuplicateSubmission(job)
    ) || null;
  },

  hasActiveImageJobs: () => Object.values(get().imageJobs).some(job =>
    ACTIVE_STATUSES.has(job.status)
    || (job.status === 'interrupted' && Boolean(job.recoveryPersistenceError))
  ),
  };
};
