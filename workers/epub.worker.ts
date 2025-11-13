// EPUB Worker – orchestrates background exports using the typed pipeline.

import type { EpubExportOptions } from '../services/epub/types';
import type { EnhancedChapter } from '../services/stableIdService';

interface SerializedSnapshot {
  chapters?: Array<[string, EnhancedChapter]>;
  currentNovelTitle?: string;
}

export interface EpubJob {
  id: string;
  options: EpubExportOptions;
  snapshot?: SerializedSnapshot;
}

export interface EpubProgress {
  jobId: string;
  stage: 'collecting' | 'processing' | 'packaging' | 'completed' | 'error';
  progress: number;
  message?: string;
  error?: string;
  result?: ArrayBuffer;
}

const activeJobs = new Map<string, AbortController>();

self.addEventListener('message', async (event) => {
  const { type, payload } = event.data ?? {};

  switch (type) {
    case 'START_EPUB_JOB':
      await handleEpubJob(payload as EpubJob);
      break;
    case 'CANCEL_EPUB_JOB':
      handleJobCancellation((payload as { jobId: string }).jobId);
      break;
    default:
      console.warn('[EpubWorker] Unknown message type:', type);
  }
});

async function handleEpubJob(job: EpubJob) {
  if (!job?.id) {
    console.error('[EpubWorker] Invalid job payload', job);
    return;
  }

  const abortController = new AbortController();
  activeJobs.set(job.id, abortController);

  try {
    const { exportEpub } = await import('../services/epub/exportService');
    const snapshot = deserializeSnapshot(job.snapshot);

    const result = await exportEpub(
      job.options,
      snapshot,
      (progress) => {
        const stage = mapPhaseToStage(progress.phase);
        const rounded = Math.max(0, Math.min(100, Math.round(progress.percent)));
        postProgress(job.id, stage, rounded, progress.message, undefined);
      }
    );

    if (abortController.signal.aborted) {
      postProgress(job.id, 'error', 0, undefined, 'Job cancelled');
      return;
    }

    if (!result.success || !result.blob) {
      const errorMessage = result.error ?? 'Unknown export error';
      postProgress(job.id, 'error', 0, undefined, errorMessage);
      return;
    }

    const arrayBuffer = await result.blob.arrayBuffer();
    postProgress(job.id, 'completed', 100, 'EPUB generation completed', undefined, arrayBuffer);
  } catch (error: any) {
    console.error(`[EpubWorker] Job ${job.id} failed:`, error);
    if (error?.name === 'AbortError' || abortController.signal.aborted) {
      postProgress(job.id, 'error', 0, undefined, 'Job cancelled');
    } else {
      postProgress(job.id, 'error', 0, undefined, error?.message || 'EPUB export failed');
    }
  } finally {
    activeJobs.delete(job.id);
  }
}

function handleJobCancellation(jobId: string) {
  if (!jobId) return;
  const controller = activeJobs.get(jobId);
  if (controller) {
    controller.abort();
    activeJobs.delete(jobId);
    console.log(`[EpubWorker] Job ${jobId} cancellation requested`);
  }
}

function postProgress(
  jobId: string,
  stage: EpubProgress['stage'],
  progress: number,
  message?: string,
  error?: string,
  result?: ArrayBuffer
) {
  const payload: EpubProgress = {
    jobId,
    stage,
    progress,
    message,
    error,
    result,
  };

  self.postMessage({
    type: 'EPUB_PROGRESS',
    payload,
  });
}

function deserializeSnapshot(serialized?: SerializedSnapshot) {
  if (!serialized?.chapters) return undefined;
  try {
    return {
      chapters: new Map<string, EnhancedChapter>(serialized.chapters),
      currentNovelTitle: serialized.currentNovelTitle,
    };
  } catch (error) {
    console.warn('[EpubWorker] Failed to deserialize snapshot', error);
    return undefined;
  }
}

function mapPhaseToStage(
  phase: 'collecting' | 'resolving' | 'building' | 'packaging' | 'complete' | 'error',
): EpubProgress['stage'] {
  switch (phase) {
    case 'collecting':
      return 'collecting';
    case 'resolving':
    case 'building':
      return 'processing';
    case 'packaging':
      return 'packaging';
    case 'complete':
      return 'completed';
    case 'error':
    default:
      return 'error';
  }
}

console.log('[EpubWorker] Worker initialized and ready');
