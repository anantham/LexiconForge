export type ImageJobResumeKind = 'none' | 'piapi' | 'indrasnet';

export type ImageJobLifecycleEvent =
  | { type: 'submitted'; externalTaskId: string; resumeKind: Exclude<ImageJobResumeKind, 'none'> }
  | { type: 'running' };

export type ImageJobLifecycleListener = (event: ImageJobLifecycleEvent) => void;
