import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createJobsSlice, generateJobId, type JobsSlice, type TranslationJob } from '../../../store/slices/jobsSlice';

vi.mock('../../../utils/debug', () => ({
  debugLog: vi.fn(),
}));

const createSlice = (): JobsSlice => {
  const state: Partial<JobsSlice> = {};
  const set = (partial: Partial<JobsSlice> | ((prev: JobsSlice) => Partial<JobsSlice> | void)) => {
    const next = typeof partial === 'function' ? partial(state as JobsSlice) : partial;
    if (!next) return;
    Object.assign(state, next);
  };
  const get = () => state as JobsSlice;
  Object.assign(state, createJobsSlice(set as any, get as any));
  return state as JobsSlice;
};

describe('jobsSlice', () => {
  let slice: JobsSlice;

  beforeEach(() => {
    slice = createSlice();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('job CRUD', () => {
    it('adds jobs with defaults', () => {
      slice.addJob({
        id: 'job-1',
        type: 'translation',
        status: 'pending',
        chapterUrls: [],
        settings: {},
        totalChapters: 0,
        completedChapters: 0,
      });

      const job = slice.getJob('job-1')!;
      expect(job.id).toBe('job-1');
      expect(job.progress).toBe(0);
      expect(job.createdAt).toBeTypeOf('number');
    });

    it('updates existing jobs without affecting others', () => {
      slice.addJob({
        id: 'job-1',
        type: 'translation',
        status: 'pending',
        chapterUrls: [],
        settings: {},
        totalChapters: 0,
        completedChapters: 0,
      });
      slice.addJob({
        id: 'job-2',
        type: 'epub',
        status: 'running',
        chapterUrls: [],
        filename: 'test.epub',
      });

      slice.updateJob('job-1', { status: 'running', message: 'Booting worker' });

      expect(slice.getJob('job-1')?.status).toBe('running');
      expect(slice.getJob('job-1')?.message).toBe('Booting worker');
      expect(slice.getJob('job-2')?.status).toBe('running');
    });

    it('removes jobs by id', () => {
      slice.addJob({
        id: 'job-1',
        type: 'translation',
        status: 'pending',
        chapterUrls: [],
        settings: {},
        totalChapters: 0,
        completedChapters: 0,
      });
      slice.removeJob('job-1');
      expect(slice.getJob('job-1')).toBeUndefined();
    });
  });

  describe('cleanup helpers', () => {
    beforeEach(() => {
      slice.addJob({
        id: 'completed',
        type: 'translation',
        status: 'completed',
        chapterUrls: [],
        settings: {},
        totalChapters: 1,
        completedChapters: 1,
      });
      slice.addJob({
        id: 'failed',
        type: 'translation',
        status: 'failed',
        chapterUrls: [],
        settings: {},
        totalChapters: 1,
        completedChapters: 0,
      });
      slice.addJob({
        id: 'running',
        type: 'translation',
        status: 'running',
        chapterUrls: [],
        settings: {},
        totalChapters: 1,
        completedChapters: 0,
      });
    });

    it('clearCompleted only removes finished jobs', () => {
      slice.clearCompleted();
      expect(Object.keys(slice.jobs)).toEqual(['running']);
    });

    it('clearAll cancels running jobs before wiping state', () => {
      const cancelSpy = vi.spyOn(slice, 'cancelJob');
      slice.clearAll();
      expect(cancelSpy).toHaveBeenCalledWith('running');
      expect(Object.keys(slice.jobs)).toHaveLength(0);
    });
  });

  describe('job control flows', () => {
    beforeEach(() => {
      slice.addJob({
        id: 'job-1',
        type: 'translation',
        status: 'pending',
        chapterUrls: ['url-1'],
        settings: {},
        totalChapters: 1,
        completedChapters: 0,
      });
    });

    it('startJob moves pending jobs to running and triggers worker hook', () => {
      const workerSpy = vi.spyOn(slice, 'startWorkerJob');
      slice.startJob('job-1');

      const job = slice.getJob('job-1')!;
      expect(job.status).toBe('running');
      expect(job.startedAt).toBeTypeOf('number');
      expect(workerSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-1' }));
    });

    it('pauseJob only affects running jobs', () => {
      slice.startJob('job-1');
      slice.pauseJob('job-1');
      expect(slice.getJob('job-1')?.status).toBe('paused');

      slice.pauseJob('job-1'); // no-op when already paused
      expect(slice.getJob('job-1')?.status).toBe('paused');
    });

    it('resumeJob restarts paused jobs and re-triggers worker hook', () => {
      slice.startJob('job-1');
      slice.pauseJob('job-1');
      const workerSpy = vi.spyOn(slice, 'startWorkerJob');

      slice.resumeJob('job-1');
      expect(workerSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-1' }));
      expect(slice.getJob('job-1')?.status).toBe('running');
    });

    it('cancelJob marks cancellation and eventually sets status to cancelled', () => {
      slice.startJob('job-1');
      vi.useFakeTimers();

      const cancelWorkerSpy = vi.spyOn(slice, 'cancelWorkerJob');
      slice.cancelJob('job-1');

      expect(slice.getJob('job-1')?.cancellationRequested).toBe(true);
      expect(cancelWorkerSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-1' }));

      vi.runAllTimers();
      expect(slice.getJob('job-1')?.status).toBe('cancelled');
      expect(slice.getJob('job-1')?.completedAt).toBeTypeOf('number');
    });
  });

  describe('selectors', () => {
    beforeEach(() => {
      slice.addJob({
        id: 'translation-running',
        type: 'translation',
        status: 'running',
        chapterUrls: [],
        settings: {},
        totalChapters: 1,
        completedChapters: 0,
      });
      slice.addJob({
        id: 'translation-pending',
        type: 'translation',
        status: 'pending',
        chapterUrls: [],
        settings: {},
        totalChapters: 1,
        completedChapters: 0,
      });
      slice.addJob({
        id: 'epub',
        type: 'epub',
        status: 'running',
        chapterUrls: [],
        filename: 'test.epub',
      });
    });

    it('getJobsByType filters by type', () => {
      expect(slice.getJobsByType('translation')).toHaveLength(2);
      expect(slice.getJobsByType('epub')).toHaveLength(1);
    });

    it('getJobsByStatus filters by status', () => {
      expect(slice.getJobsByStatus('running')).toHaveLength(2);
      expect(slice.getJobsByStatus('pending')).toHaveLength(1);
    });

    it('getRunningJobs returns only running jobs and hasRunningJobs mirrors presence', () => {
      const running = slice.getRunningJobs();
      expect(running.map(job => job.id).sort()).toEqual(['epub', 'translation-running']);
      expect(slice.hasRunningJobs()).toBe(true);

      running.forEach(job => slice.updateJob(job.id, { status: 'completed' }));
      expect(slice.hasRunningJobs()).toBe(false);
    });
  });

  describe('workers', () => {
    it('initializeWorkers does not mutate worker registry yet', () => {
      slice.initializeWorkers();
      expect(slice.workers).toEqual({});
    });

    it('terminateWorkers calls terminate on any registered workers', () => {
      const translationTerminate = vi.fn();
      const epubTerminate = vi.fn();
      slice.workers.translation = { terminate: translationTerminate } as unknown as Worker;
      slice.workers.epub = { terminate: epubTerminate } as unknown as Worker;

      slice.terminateWorkers();
      expect(translationTerminate).toHaveBeenCalled();
      expect(epubTerminate).toHaveBeenCalled();
      expect(slice.workers).toEqual({});
    });

    it('worker helper methods do not throw', () => {
      const job: TranslationJob = {
        id: 'job-1',
        type: 'translation',
        status: 'running',
        createdAt: Date.now(),
        progress: 50,
        chapterUrls: [],
        settings: {},
        totalChapters: 1,
        completedChapters: 0,
      };

      expect(() => slice.startWorkerJob(job)).not.toThrow();
      expect(() => slice.cancelWorkerJob(job)).not.toThrow();
      expect(() => slice.handleWorkerMessage({ data: {} } as MessageEvent, 'translation')).not.toThrow();
    });
  });

  describe('utilities', () => {
    it('generateJobId produces unique identifiers', () => {
      const a = generateJobId('alpha');
      const b = generateJobId('alpha');
      expect(a).not.toBe(b);
      expect(a.startsWith('alpha_')).toBe(true);
    });
  });
});
