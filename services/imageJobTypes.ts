import type { AppSettings, ImageExecutionMetadata } from '../types';

/** One-job route changes. These are applied to a settings snapshot and never persisted globally. */
export type ImageGenerationOverrides = Partial<Pick<
  AppSettings,
  'imageModel' | 'openRouterImageEndpoint'
>>;

export type ImageJobResumeKind = 'none' | 'piapi' | 'indrasnet';

export const RESUMABLE_IMAGE_JOBS_STORAGE_KEY = 'LF_RESUMABLE_IMAGE_JOBS_V1';

export type ImageJobLifecycleEvent =
  | {
      type: 'provider_switched';
      model: string;
      fallback: NonNullable<ImageExecutionMetadata['fallback']>;
    }
  | {
      type: 'submitted';
      externalTaskId: string;
      resumeKind: Exclude<ImageJobResumeKind, 'none'>;
      submittedModel?: string;
      fallback?: ImageExecutionMetadata['fallback'];
      brokerBaseUrl?: string;
    }
  | { type: 'running' };

export type ImageJobLifecycleListener = (event: ImageJobLifecycleEvent) => void;
