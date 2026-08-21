import type { ImageExecutionMetadata } from '../types';

export type ImageJobResumeKind = 'none' | 'piapi' | 'indrasnet';

export const RESUMABLE_IMAGE_JOBS_STORAGE_KEY = 'LF_RESUMABLE_IMAGE_JOBS_V1';

export type ImageJobLifecycleEvent =
  | {
      type: 'submitted';
      externalTaskId: string;
      resumeKind: Exclude<ImageJobResumeKind, 'none'>;
      submittedModel?: string;
      fallback?: ImageExecutionMetadata['fallback'];
    }
  | { type: 'running' };

export type ImageJobLifecycleListener = (event: ImageJobLifecycleEvent) => void;
