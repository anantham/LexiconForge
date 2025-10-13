import { StateCreator } from 'zustand';
import { debugLog } from '../../utils/debug';

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
    // Workers are not implemented yet - this is a placeholder for future functionality
    debugLog('worker', 'summary', '[Jobs] Worker initialization is not yet implemented');
    
    // TODO: Implement workers when needed
    // - Translation worker for background translation jobs
    // - EPUB worker for background EPUB generation
    // - Image worker for background image generation
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

  // Worker communication (private methods) - Placeholder implementations
  startWorkerJob: (job: Job) => {
    debugLog('worker', 'summary', `[Jobs] Starting job ${job.id} - workers not yet implemented`);
    // TODO: Implement actual worker communication when workers are available
  },

  cancelWorkerJob: (job: Job) => {
    debugLog('worker', 'summary', `[Jobs] Cancelling job ${job.id} - workers not yet implemented`);
    // TODO: Implement actual worker cancellation when workers are available
  },

  handleWorkerMessage: (event: MessageEvent, workerType: 'translation' | 'epub') => {
    debugLog('worker', 'summary', `[Jobs] Received message from ${workerType} worker - not yet implemented`);
    // TODO: Implement actual message handling when workers are available
  }
});

// Helper function to generate job IDs
export function generateJobId(prefix: string = 'job'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
