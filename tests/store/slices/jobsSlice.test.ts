import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createJobsSlice, generateJobId, type JobsSlice, type TranslationJob, type EpubJob } from '../../../store/slices/jobsSlice';

// Mock Worker
class MockWorker {
  public listeners = new Map<string, Function[]>();
  public postMessage = vi.fn();
  public terminate = vi.fn();

  addEventListener(type: string, listener: Function) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  // Helper method to simulate worker messages
  simulateMessage(data: any) {
    const listeners = this.listeners.get('message') || [];
    listeners.forEach(listener => listener({ data }));
  }
}

// Mock Worker constructor
vi.stubGlobal('Worker', vi.fn(() => new MockWorker()));

describe('jobsSlice', () => {
  let store: JobsSlice;

  beforeEach(() => {
    const set = vi.fn((updater) => {
      const newState = updater(store);
      Object.assign(store, newState);
    });
    const get = vi.fn(() => store);

    store = createJobsSlice(set, get);
    vi.clearAllMocks();
  });

  describe('generateJobId', () => {
    it('generates unique job IDs', () => {
      const id1 = generateJobId('test');
      const id2 = generateJobId('test');
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^test_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^test_\d+_[a-z0-9]+$/);
    });

    it('uses default prefix when none provided', () => {
      const id = generateJobId();
      expect(id).toMatch(/^job_\d+_[a-z0-9]+$/);
    });
  });

  describe('job management', () => {
    it('adds jobs to the store', () => {
      const job: Omit<TranslationJob, 'createdAt' | 'progress'> = {
        id: 'test-job-1',
        type: 'translation',
        status: 'pending',
        chapterUrls: ['url1', 'url2'],
        settings: {} as any,
        totalChapters: 2,
        completedChapters: 0
      };

      store.addJob(job);

      const addedJob = store.getJob('test-job-1');
      expect(addedJob).toBeDefined();
      expect(addedJob?.id).toBe('test-job-1');
      expect(addedJob?.type).toBe('translation');
      expect(addedJob?.status).toBe('pending');
      expect(addedJob?.progress).toBe(0);
      expect(addedJob?.createdAt).toBeTypeOf('number');
    });

    it('updates existing jobs', () => {
      const job: Omit<TranslationJob, 'createdAt' | 'progress'> = {
        id: 'test-job-1',
        type: 'translation',
        status: 'pending',
        chapterUrls: ['url1'],
        settings: {} as any,
        totalChapters: 1,
        completedChapters: 0
      };

      store.addJob(job);
      store.updateJob('test-job-1', { 
        status: 'running', 
        progress: 50,
        message: 'In progress...'
      });

      const updatedJob = store.getJob('test-job-1');
      expect(updatedJob?.status).toBe('running');
      expect(updatedJob?.progress).toBe(50);
      expect(updatedJob?.message).toBe('In progress...');
    });

    it('removes jobs from the store', () => {
      const job: Omit<TranslationJob, 'createdAt' | 'progress'> = {
        id: 'test-job-1',
        type: 'translation',
        status: 'pending',
        chapterUrls: ['url1'],
        settings: {} as any,
        totalChapters: 1,
        completedChapters: 0
      };

      store.addJob(job);
      expect(store.getJob('test-job-1')).toBeDefined();

      store.removeJob('test-job-1');
      expect(store.getJob('test-job-1')).toBeUndefined();
    });

    it('ignores updates to non-existent jobs', () => {
      const initialJobsCount = Object.keys(store.jobs).length;
      
      store.updateJob('non-existent-job', { status: 'running' });
      
      expect(Object.keys(store.jobs)).toHaveLength(initialJobsCount);
    });
  });

  describe('job filtering and selection', () => {
    beforeEach(() => {
      // Add sample jobs
      store.addJob({
        id: 'translation-job-1',
        type: 'translation',
        status: 'running',
        chapterUrls: ['url1'],
        settings: {} as any,
        totalChapters: 1,
        completedChapters: 0
      });

      store.addJob({
        id: 'translation-job-2',
        type: 'translation',
        status: 'completed',
        chapterUrls: ['url2'],
        settings: {} as any,
        totalChapters: 1,
        completedChapters: 1
      });

      store.addJob({
        id: 'epub-job-1',
        type: 'epub',
        status: 'running',
        chapterUrls: ['url3'],
        filename: 'test.epub'
      });
    });

    it('gets jobs by type', () => {
      const translationJobs = store.getJobsByType('translation');
      const epubJobs = store.getJobsByType('epub');
      
      expect(translationJobs).toHaveLength(2);
      expect(epubJobs).toHaveLength(1);
      expect(translationJobs[0].type).toBe('translation');
      expect(epubJobs[0].type).toBe('epub');
    });

    it('gets jobs by status', () => {
      const runningJobs = store.getJobsByStatus('running');
      const completedJobs = store.getJobsByStatus('completed');
      
      expect(runningJobs).toHaveLength(2);
      expect(completedJobs).toHaveLength(1);
      expect(completedJobs[0].id).toBe('translation-job-2');
    });

    it('gets running jobs', () => {
      const runningJobs = store.getRunningJobs();
      
      expect(runningJobs).toHaveLength(2);
      expect(runningJobs.every(job => job.status === 'running')).toBe(true);
    });

    it('checks if has running jobs', () => {
      expect(store.hasRunningJobs()).toBe(true);
      
      // Complete all running jobs
      store.updateJob('translation-job-1', { status: 'completed' });
      store.updateJob('epub-job-1', { status: 'completed' });
      
      expect(store.hasRunningJobs()).toBe(false);
    });
  });

  describe('job control', () => {
    let job: Omit<TranslationJob, 'createdAt' | 'progress'>;

    beforeEach(() => {
      job = {
        id: 'test-job-1',
        type: 'translation',
        status: 'pending',
        chapterUrls: ['url1'],
        settings: {} as any,
        totalChapters: 1,
        completedChapters: 0
      };
      store.addJob(job);
    });

    it('starts pending jobs', () => {
      store.initializeWorkers();
      store.startJob('test-job-1');

      const startedJob = store.getJob('test-job-1');
      expect(startedJob?.status).toBe('running');
      expect(startedJob?.startedAt).toBeTypeOf('number');
    });

    it('ignores start requests for non-pending jobs', () => {
      store.updateJob('test-job-1', { status: 'running' });
      const originalJob = store.getJob('test-job-1');
      
      store.startJob('test-job-1');
      const afterStart = store.getJob('test-job-1');
      
      expect(afterStart?.status).toBe('running');
      expect(afterStart?.startedAt).toBe(originalJob?.startedAt);
    });

    it('pauses running jobs', () => {
      store.updateJob('test-job-1', { status: 'running' });
      store.pauseJob('test-job-1');

      const pausedJob = store.getJob('test-job-1');
      expect(pausedJob?.status).toBe('paused');
    });

    it('resumes paused jobs', () => {
      store.updateJob('test-job-1', { status: 'paused' });
      store.initializeWorkers();
      store.resumeJob('test-job-1');

      const resumedJob = store.getJob('test-job-1');
      expect(resumedJob?.status).toBe('running');
    });

    it('cancels jobs and marks them as cancelled', (done) => {
      store.updateJob('test-job-1', { status: 'running' });
      store.initializeWorkers();
      store.cancelJob('test-job-1');

      // Check immediate cancellation request
      const cancellingJob = store.getJob('test-job-1');
      expect(cancellingJob?.cancellationRequested).toBe(true);

      // Check final status after timeout
      setTimeout(() => {
        const cancelledJob = store.getJob('test-job-1');
        expect(cancelledJob?.status).toBe('cancelled');
        expect(cancelledJob?.completedAt).toBeTypeOf('number');
        done();
      }, 150);
    });

    it('ignores control requests for completed jobs', () => {
      store.updateJob('test-job-1', { status: 'completed' });
      
      store.pauseJob('test-job-1');
      store.cancelJob('test-job-1');
      
      const job = store.getJob('test-job-1');
      expect(job?.status).toBe('completed');
      expect(job?.cancellationRequested).toBeUndefined();
    });
  });

  describe('cleanup operations', () => {
    beforeEach(() => {
      // Add jobs with different statuses
      store.addJob({
        id: 'completed-job',
        type: 'translation',
        status: 'completed',
        chapterUrls: ['url1'],
        settings: {} as any,
        totalChapters: 1,
        completedChapters: 1
      });

      store.addJob({
        id: 'failed-job',
        type: 'translation',
        status: 'failed',
        chapterUrls: ['url2'],
        settings: {} as any,
        totalChapters: 1,
        completedChapters: 0
      });

      store.addJob({
        id: 'running-job',
        type: 'translation',
        status: 'running',
        chapterUrls: ['url3'],
        settings: {} as any,
        totalChapters: 1,
        completedChapters: 0
      });
    });

    it('clears only completed jobs', () => {
      expect(Object.keys(store.jobs)).toHaveLength(3);
      
      store.clearCompleted();
      
      expect(Object.keys(store.jobs)).toHaveLength(1);
      expect(store.getJob('running-job')).toBeDefined();
      expect(store.getJob('completed-job')).toBeUndefined();
      expect(store.getJob('failed-job')).toBeUndefined();
    });

    it('clears all jobs and cancels running ones', () => {
      store.initializeWorkers();
      expect(Object.keys(store.jobs)).toHaveLength(3);
      
      store.clearAll();
      
      expect(Object.keys(store.jobs)).toHaveLength(0);
    });
  });

  describe('worker management', () => {
    it('initializes workers', () => {
      expect(store.workers.translation).toBeUndefined();
      expect(store.workers.epub).toBeUndefined();
      
      store.initializeWorkers();
      
      expect(store.workers.translation).toBeDefined();
      expect(store.workers.epub).toBeDefined();
      expect(Worker).toHaveBeenCalledTimes(2);
    });

    it('does not create duplicate workers', () => {
      store.initializeWorkers();
      const translationWorker = store.workers.translation;
      const epubWorker = store.workers.epub;
      
      store.initializeWorkers();
      
      expect(store.workers.translation).toBe(translationWorker);
      expect(store.workers.epub).toBe(epubWorker);
      expect(Worker).toHaveBeenCalledTimes(2); // Still only 2 calls
    });

    it('terminates workers', () => {
      store.initializeWorkers();
      const translationWorker = store.workers.translation as MockWorker;
      const epubWorker = store.workers.epub as MockWorker;
      
      store.terminateWorkers();
      
      expect(translationWorker.terminate).toHaveBeenCalled();
      expect(epubWorker.terminate).toHaveBeenCalled();
      expect(store.workers.translation).toBeUndefined();
      expect(store.workers.epub).toBeUndefined();
    });

    it('handles translation worker progress messages', () => {
      store.addJob({
        id: 'test-translation',
        type: 'translation',
        status: 'running',
        chapterUrls: ['url1'],
        settings: {} as any,
        totalChapters: 2,
        completedChapters: 0
      });

      store.initializeWorkers();
      const worker = store.workers.translation as MockWorker;
      
      // Simulate progress message
      worker.simulateMessage({
        type: 'TRANSLATION_PROGRESS',
        payload: {
          jobId: 'test-translation',
          completed: 1,
          total: 2,
          currentChapter: 'Chapter 1'
        }
      });

      const job = store.getJob('test-translation');
      expect(job?.progress).toBe(50);
      expect(job?.message).toBe('Translating: Chapter 1');
    });

    it('handles epub worker progress messages', () => {
      store.addJob({
        id: 'test-epub',
        type: 'epub',
        status: 'running',
        chapterUrls: ['url1'],
        filename: 'test.epub'
      });

      store.initializeWorkers();
      const worker = store.workers.epub as MockWorker;
      
      // Simulate progress message
      worker.simulateMessage({
        type: 'EPUB_PROGRESS',
        payload: {
          jobId: 'test-epub',
          stage: 'processing',
          progress: 60,
          message: 'Converting chapters...'
        }
      });

      const job = store.getJob('test-epub') as EpubJob;
      expect(job?.progress).toBe(60);
      expect(job?.stage).toBe('processing');
      expect(job?.message).toBe('Converting chapters...');
    });

    it('handles job completion messages', () => {
      store.addJob({
        id: 'test-translation',
        type: 'translation',
        status: 'running',
        chapterUrls: ['url1'],
        settings: {} as any,
        totalChapters: 1,
        completedChapters: 0
      });

      store.initializeWorkers();
      const worker = store.workers.translation as MockWorker;
      
      const mockResults = [{ translatedTitle: 'Test', translation: 'Content' }];
      
      // Simulate completion message
      worker.simulateMessage({
        type: 'TRANSLATION_PROGRESS',
        payload: {
          jobId: 'test-translation',
          completed: 1,
          total: 1,
          results: mockResults
        }
      });

      const job = store.getJob('test-translation') as TranslationJob;
      expect(job?.progress).toBe(100);
      expect(job?.status).toBe('completed');
      expect(job?.completedAt).toBeTypeOf('number');
      expect(job?.results).toEqual(mockResults);
    });
  });
});