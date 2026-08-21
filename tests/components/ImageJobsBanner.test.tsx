import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ImageJobsBanner from '../../components/ImageJobsBanner';
import type { ImageJob } from '../../store/slices/imageJobsSlice';

const setCurrentChapter = vi.fn();
const loadChapterFromIDB = vi.fn();
const showNotification = vi.fn();
const dismissImageJob = vi.fn();
const storeState: {
  imageJobs: Record<string, ImageJob>;
  chapters: Map<string, any>;
  setCurrentChapter: typeof setCurrentChapter;
  loadChapterFromIDB: typeof loadChapterFromIDB;
  showNotification: typeof showNotification;
  dismissImageJob: typeof dismissImageJob;
} = {
  imageJobs: {},
  chapters: new Map(),
  setCurrentChapter,
  loadChapterFromIDB,
  showNotification,
  dismissImageJob,
};

vi.mock('../../store', () => ({
  useAppStore: vi.fn((selector) => selector(storeState)),
}));

const job = (overrides: Partial<ImageJob> = {}): ImageJob => ({
  id: 'job-1',
  chapterId: 'chapter-1',
  placementMarker: '[ILLUSTRATION-1]',
  requestedModel: 'openrouter/model',
  requestedProvider: 'OpenRouter',
  status: 'running',
  resumeKind: 'none',
  version: 1,
  startedAt: Date.now() - 10_000,
  updatedAt: Date.now(),
  estimatedDurationSeconds: 40,
  estimateSampleCount: 3,
  ...overrides,
});

describe('ImageJobsBanner', () => {
  beforeEach(() => {
    storeState.imageJobs = {};
    storeState.chapters = new Map();
    setCurrentChapter.mockReset();
    loadChapterFromIDB.mockReset();
    showNotification.mockReset();
    dismissImageJob.mockReset();
  });

  it('shows an empirical ETA and navigates to the loaded originating chapter', async () => {
    storeState.imageJobs = { 'job-1': job() };
    storeState.chapters = new Map([['chapter-1', { title: 'Origin Chapter', translationResult: {} }]]);
    render(<ImageJobsBanner />);

    expect(screen.getByText('Origin Chapter')).toBeInTheDocument();
    expect(screen.getByText(/3 prior runs/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open origin chapter/i }));
    await waitFor(() => expect(setCurrentChapter).toHaveBeenCalledWith('chapter-1'));
    expect(loadChapterFromIDB).not.toHaveBeenCalled();
  });

  it('hydrates a shelved origin before opening it', async () => {
    storeState.imageJobs = { 'job-1': job({ status: 'completed' }) };
    loadChapterFromIDB.mockResolvedValue({ id: 'chapter-1', title: 'Hydrated Origin', translationResult: {} });
    render(<ImageJobsBanner />);

    fireEvent.click(screen.getByRole('button', { name: /open chapter-1/i }));

    await waitFor(() => expect(loadChapterFromIDB).toHaveBeenCalledWith('chapter-1'));
    expect(setCurrentChapter).toHaveBeenCalledWith('chapter-1');
  });

  it('keeps the job visible and reports a failed origin hydration', async () => {
    storeState.imageJobs = { 'job-1': job({ status: 'completed' }) };
    loadChapterFromIDB.mockResolvedValue(null);
    render(<ImageJobsBanner />);

    fireEvent.click(screen.getByRole('button', { name: /open chapter-1/i }));

    await waitFor(() => expect(showNotification).toHaveBeenCalledWith(
      expect.stringContaining('originating chapter could not be loaded'),
      'error',
    ));
    expect(setCurrentChapter).not.toHaveBeenCalled();
    expect(screen.getByText(/illustration ready/i)).toBeInTheDocument();
  });

  it('rehydrates a cached translation-error stub before navigating', async () => {
    storeState.imageJobs = { 'job-1': job({ status: 'completed' }) };
    storeState.chapters = new Map([['chapter-1', {
      id: 'chapter-1',
      _translationLoadError: 'IndexedDB transaction aborted',
    }]]);
    loadChapterFromIDB.mockResolvedValue({ id: 'chapter-1', translationResult: {} });
    render(<ImageJobsBanner />);

    fireEvent.click(screen.getByRole('button', { name: /open chapter-1/i }));

    await waitFor(() => expect(loadChapterFromIDB).toHaveBeenCalledWith('chapter-1'));
    expect(setCurrentChapter).toHaveBeenCalledWith('chapter-1');
  });

  it('lets every visible job be selected, opened, and dismissed', async () => {
    storeState.imageJobs = {
      'job-1': job({ status: 'completed', completedAt: Date.now(), updatedAt: 200 }),
      'job-2': job({
        id: 'job-2',
        chapterId: 'chapter-2',
        status: 'completed',
        completedAt: Date.now(),
        updatedAt: 100,
      }),
    };
    storeState.chapters = new Map([
      ['chapter-1', { title: 'First Origin', translationResult: {} }],
      ['chapter-2', { title: 'Second Origin', translationResult: {} }],
    ]);
    render(<ImageJobsBanner />);

    expect(screen.getByText('First Origin')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next image job/i }));
    expect(screen.getByText('Second Origin')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open second origin/i }));
    await waitFor(() => expect(setCurrentChapter).toHaveBeenCalledWith('chapter-2'));
    fireEvent.click(screen.getByRole('button', { name: /dismiss image job/i }));
    expect(dismissImageJob).toHaveBeenCalledWith('job-2');
  });

  it('does not invent an ETA when there is no empirical history', () => {
    storeState.imageJobs = { 'job-1': job({ estimatedDurationSeconds: undefined, estimateSampleCount: 0 }) };
    render(<ImageJobsBanner />);
    expect(screen.getByText(/gathering ETA data/i)).toBeInTheDocument();
  });

  it('shows queued batch work without a generating countdown or progress bar', () => {
    storeState.imageJobs = { 'job-1': job({ status: 'queued' }) };
    render(<ImageJobsBanner />);

    expect(screen.getByText(/waiting for earlier illustrations/i)).toBeInTheDocument();
    expect(screen.queryByText(/about .* left|elapsed|gathering ETA/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/estimated .* complete/i)).not.toBeInTheDocument();
  });

  it('shows provider-submitted work without an execution countdown or progress bar', () => {
    storeState.imageJobs = { 'job-1': job({ status: 'submitted' }) };
    render(<ImageJobsBanner />);

    expect(screen.getByText(/^queued by provider$/i)).toBeInTheDocument();
    expect(screen.queryByText(/about .* left|elapsed|gathering ETA/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/estimated .* complete/i)).not.toBeInTheDocument();
  });

  it('lets a completed job be dismissed', () => {
    storeState.imageJobs = { 'job-1': job({ status: 'completed', completedAt: Date.now(), durationSeconds: 33 }) };
    render(<ImageJobsBanner />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss image job/i }));
    expect(dismissImageJob).toHaveBeenCalledWith('job-1');
  });

  it('does not invent a duration for terminal-first recovered work', () => {
    storeState.imageJobs = {
      'job-1': job({ status: 'completed', completedAt: Date.now(), durationSeconds: undefined }),
    };
    render(<ImageJobsBanner />);

    expect(screen.getByText(/^illustration ready$/i)).toBeInTheDocument();
    expect(screen.queryByText(/ready after/i)).not.toBeInTheDocument();
  });

  it('explains why a resumable task is paused', () => {
    storeState.imageJobs = {
      'job-1': job({ status: 'interrupted', resumeKind: 'indrasnet', error: 'IndrasNet is unreachable from this device.' }),
    };
    render(<ImageJobsBanner />);
    expect(screen.getByText(/paused: IndrasNet is unreachable/i)).toBeInTheDocument();
  });
});
