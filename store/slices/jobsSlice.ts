import { StateCreator } from 'zustand';

// Job types and statuses
export type JobType = 'translation' | 'epub' | 'image';
export type JobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface BaseJob {
  id: string;
  type: JobType;
  status: JobStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  progress: number; // 0-100
  message?: string;
  error?: string;
  cancellationRequested?: boolean;
}

export interface TranslationJob extends BaseJob {
  type: 'translation';
  chapterUrls: string[];
  settings: any; // AppSettings
  totalChapters: number;
  completedChapters: number;
  currentChapter?: string;
  results?: any[]; // TranslationResult[]
}

export interface EpubJob extends BaseJob {
  type: 'epub';
  chapterUrls: string[];
  filename: string;
  stage?: 'collecting' | 'processing' | 'packaging' | 'completed';
  result?: ArrayBuffer;
}

export interface ImageJob extends BaseJob {
  type: 'image';
  prompt: string;
  settings: any;
  result?: string; // base64 or URL
}

export type Job = TranslationJob | EpubJob | ImageJob;

// Jobs slice state
export interface JobsSlice {
  jobs: Record<string, Job>;
  
  // Actions
  addJob: (job: Omit<Job, 'createdAt' | 'progress'>) => void;
  updateJob: (id: string, updates: Partial<Job>) => void;
  removeJob: (id: string) => void;
  clearCompleted: () => void;
  clearAll: () => void;
  
  // Job control
  startJob: (id: string) => void;
  pauseJob: (id: string) => void;
  resumeJob: (id: string) => void;
  cancelJob: (id: string) => void;
  
  // Selectors
  getJob: (id: string) => Job | undefined;
  getJobsByType: (type: JobType) => Job[];
  getJobsByStatus: (status: JobStatus) => Job[];
  getRunningJobs: () => Job[];
  hasRunningJobs: () => boolean;
  
  // Worker management
  workers: {
    translation?: Worker;
    epub?: Worker;
  };
  initializeWorkers: () => void;
  terminateWorkers: () => void;
}

export const createJobsSlice: StateCreator<JobsSlice> = (set, get) => ({
  jobs: {},
  workers: {},

  // Actions
  addJob: (jobData) => {
    const job: Job = {
      ...jobData,
      createdAt: Date.now(),
      progress: 0,
    };
    
    set((state) => ({
      jobs: { ...state.jobs, [job.id]: job }
    }));
  },

  updateJob: (id, updates) => {
    set((state) => {
      const existingJob = state.jobs[id];
      if (!existingJob) return state;

      return {
        jobs: {
          ...state.jobs,
          [id]: { ...existingJob, ...updates }
        }
      };
    });
  },

  removeJob: (id) => {
    set((state) => {
      const { [id]: removed, ...remainingJobs } = state.jobs;
      return { jobs: remainingJobs };
    });
  },

  clearCompleted: () => {
    set((state) => {
      const activeJobs = Object.fromEntries(
        Object.entries(state.jobs).filter(([_, job]) => 
          !['completed', 'failed', 'cancelled'].includes(job.status)
        )
      );
      return { jobs: activeJobs };
    });
  },

  clearAll: () => {
    // Cancel any running jobs first
    const runningJobs = get().getRunningJobs();
    runningJobs.forEach(job => get().cancelJob(job.id));
    
    set({ jobs: {} });
  },

  // Job control
  startJob: (id) => {
    const job = get().jobs[id];
    if (!job || job.status !== 'pending') return;

    set((state) => ({
      jobs: {
        ...state.jobs,
        [id]: {
          ...job,
          status: 'running' as JobStatus,
          startedAt: Date.now()
        }
      }
    }));

    // Start the appropriate worker
    get().startWorkerJob(job);
  },

  pauseJob: (id) => {
    set((state) => {
      const job = state.jobs[id];
      if (!job || job.status !== 'running') return state;

      return {
        jobs: {
          ...state.jobs,
          [id]: { ...job, status: 'paused' as JobStatus }
        }
      };
    });
  },

  resumeJob: (id) => {
    const job = get().jobs[id];
    if (!job || job.status !== 'paused') return;

    set((state) => ({
      jobs: {
        ...state.jobs,
        [id]: { ...job, status: 'running' as JobStatus }
      }
    }));

    // Resume the worker job
    get().startWorkerJob(job);
  },

  cancelJob: (id) => {
    const job = get().jobs[id];
    if (!job || ['completed', 'failed', 'cancelled'].includes(job.status)) return;

    // Mark as cancellation requested
    set((state) => ({
      jobs: {
        ...state.jobs,
        [id]: { ...job, cancellationRequested: true }
      }
    }));

    // Send cancellation to worker
    get().cancelWorkerJob(job);

    // Update status after a brief delay to allow worker to respond
    setTimeout(() => {
      set((state) => ({
        jobs: {
          ...state.jobs,
          [id]: { 
            ...state.jobs[id], 
            status: 'cancelled' as JobStatus,
            completedAt: Date.now()
          }
        }
      }));
    }, 100);
  },

  // Selectors
  getJob: (id) => get().jobs[id],
  
  getJobsByType: (type) => 
    Object.values(get().jobs).filter(job => job.type === type),
  
  getJobsByStatus: (status) => 
    Object.values(get().jobs).filter(job => job.status === status),
  
  getRunningJobs: () => 
    Object.values(get().jobs).filter(job => job.status === 'running'),
  
  hasRunningJobs: () => 
    get().getRunningJobs().length > 0,

  // Worker management
  initializeWorkers: () => {
    const state = get();
    
    if (!state.workers.translation) {
      const translationWorker = new Worker(
        new URL('../workers/translate.worker.ts', import.meta.url),
        { type: 'module' }
      );
      
      translationWorker.addEventListener('message', (event) => {
        get().handleWorkerMessage(event, 'translation');
      });
      
      set((state) => ({
        workers: { ...state.workers, translation: translationWorker }
      }));
    }

    if (!state.workers.epub) {
      const epubWorker = new Worker(
        new URL('../workers/epub.worker.ts', import.meta.url),
        { type: 'module' }
      );
      
      epubWorker.addEventListener('message', (event) => {
        get().handleWorkerMessage(event, 'epub');
      });
      
      set((state) => ({
        workers: { ...state.workers, epub: epubWorker }
      }));
    }
  },

  terminateWorkers: () => {
    const { workers } = get();
    
    Object.values(workers).forEach(worker => {
      if (worker) {
        worker.terminate();
      }
    });
    
    set({ workers: {} });
  },

  // Worker communication (private methods)
  startWorkerJob: (job: Job) => {
    const { workers } = get();
    
    if (job.type === 'translation' && workers.translation) {
      workers.translation.postMessage({
        type: 'START_TRANSLATION_JOB',
        payload: {
          id: job.id,
          chapters: (job as TranslationJob).chapterUrls.map(url => ({
            url,
            title: `Chapter ${url}`, // This would come from actual chapter data
            content: `Content for ${url}` // This would come from actual chapter data
          })),
          settings: (job as TranslationJob).settings,
          history: [], // This would come from context
          fanTranslation: null
        }
      });
    } else if (job.type === 'epub' && workers.epub) {
      workers.epub.postMessage({
        type: 'START_EPUB_JOB',
        payload: {
          id: job.id,
          options: {
            chapterUrls: (job as EpubJob).chapterUrls,
            includeStatsPage: true
            // Other options would be passed here
          }
        }
      });
    }
  },

  cancelWorkerJob: (job: Job) => {
    const { workers } = get();
    
    if (job.type === 'translation' && workers.translation) {
      workers.translation.postMessage({
        type: 'CANCEL_TRANSLATION_JOB',
        payload: { jobId: job.id }
      });
    } else if (job.type === 'epub' && workers.epub) {
      workers.epub.postMessage({
        type: 'CANCEL_EPUB_JOB',
        payload: { jobId: job.id }
      });
    }
  },

  handleWorkerMessage: (event: MessageEvent, workerType: 'translation' | 'epub') => {
    const { type, payload } = event.data;
    
    if (type === 'TRANSLATION_PROGRESS') {
      const { jobId, completed, total, currentChapter, error, results } = payload;
      
      get().updateJob(jobId, {
        progress: Math.round((completed / total) * 100),
        message: currentChapter ? `Translating: ${currentChapter}` : undefined,
        error,
        ...(results && { 
          status: 'completed' as JobStatus,
          completedAt: Date.now(),
          results 
        })
      });
    } else if (type === 'EPUB_PROGRESS') {
      const { jobId, stage, progress, message, error, result } = payload;
      
      const updates: Partial<Job> = {
        progress,
        message,
        error
      };

      if (stage === 'completed' && result) {
        updates.status = 'completed';
        updates.completedAt = Date.now();
        (updates as Partial<EpubJob>).result = result;
      } else if (stage === 'error') {
        updates.status = 'failed';
        updates.completedAt = Date.now();
      } else {
        (updates as Partial<EpubJob>).stage = stage;
      }

      get().updateJob(jobId, updates);
    }
  }
});

// Helper function to generate job IDs
export function generateJobId(prefix: string = 'job'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}