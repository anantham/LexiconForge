// Worker Service - Manages background job execution and coordination

import type { AppSettings, HistoricalChapter } from '../types';
import { generateJobId, type TranslationJob, type EpubJob, type JobType } from '../store/slices/jobsSlice';
import type { EpubExportOptions } from './epubService';

export interface TranslationJobRequest {
  chapterUrls: string[];
  settings: AppSettings;
  history?: HistoricalChapter[];
  fanTranslation?: string | null;
}

export interface EpubJobRequest {
  chapterUrls: string[];
  filename: string;
  options?: Partial<EpubExportOptions>;
}

export class WorkerService {
  private static instance: WorkerService;
  private store: any; // Will be injected

  static getInstance(): WorkerService {
    if (!WorkerService.instance) {
      WorkerService.instance = new WorkerService();
    }
    return WorkerService.instance;
  }

  setStore(store: any) {
    this.store = store;
  }

  /**
   * Start a batch translation job
   */
  async startTranslationJob(request: TranslationJobRequest): Promise<string> {
    const jobId = generateJobId('translation');
    
    // Get chapter data from the store or database
    const chapters = await this.getChapterData(request.chapterUrls);
    
    const job: Omit<TranslationJob, 'createdAt' | 'progress'> = {
      id: jobId,
      type: 'translation',
      status: 'pending',
      chapterUrls: request.chapterUrls,
      settings: request.settings,
      totalChapters: chapters.length,
      completedChapters: 0,
      message: 'Preparing translation job...'
    };

    // Add job to store
    this.store.addJob(job);

    // Initialize workers if needed
    this.store.initializeWorkers();

    // Start the job
    this.store.startJob(jobId);

    return jobId;
  }

  /**
   * Start an EPUB generation job
   */
  async startEpubJob(request: EpubJobRequest): Promise<string> {
    const jobId = generateJobId('epub');
    
    const job: Omit<EpubJob, 'createdAt' | 'progress'> = {
      id: jobId,
      type: 'epub',
      status: 'pending',
      chapterUrls: request.chapterUrls,
      filename: request.filename,
      stage: 'collecting',
      message: 'Preparing EPUB generation...'
    };

    // Add job to store
    this.store.addJob(job);

    // Initialize workers if needed
    this.store.initializeWorkers();

    // Start the job
    this.store.startJob(jobId);

    return jobId;
  }

  /**
   * Cancel a running job
   */
  cancelJob(jobId: string): void {
    this.store.cancelJob(jobId);
  }

  /**
   * Pause a running job
   */
  pauseJob(jobId: string): void {
    this.store.pauseJob(jobId);
  }

  /**
   * Resume a paused job
   */
  resumeJob(jobId: string): void {
    this.store.resumeJob(jobId);
  }

  /**
   * Get job status
   */
  getJob(jobId: string) {
    return this.store.getJob(jobId);
  }

  /**
   * Get all jobs of a specific type
   */
  getJobsByType(type: JobType) {
    return this.store.getJobsByType(type);
  }

  /**
   * Check if there are any running jobs
   */
  hasRunningJobs(): boolean {
    return this.store.hasRunningJobs();
  }

  /**
   * Clear completed jobs
   */
  clearCompleted(): void {
    this.store.clearCompleted();
  }

  /**
   * Download completed EPUB job result
   */
  downloadEpubResult(jobId: string): void {
    const job = this.store.getJob(jobId) as EpubJob;
    if (!job || job.type !== 'epub' || !job.result || job.status !== 'completed') {
      throw new Error('EPUB job not found or not completed');
    }

    // Create download link
    const blob = new Blob([job.result], { type: 'application/epub+zip' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = job.filename.endsWith('.epub') ? job.filename : `${job.filename}.epub`;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Get translation job results
   */
  getTranslationResults(jobId: string) {
    const job = this.store.getJob(jobId) as TranslationJob;
    if (!job || job.type !== 'translation' || job.status !== 'completed') {
      return null;
    }
    return job.results || [];
  }

  /**
   * Terminate all workers and clean up
   */
  cleanup(): void {
    this.store.terminateWorkers();
    this.store.clearAll();
  }

  // Private helper methods
  private async getChapterData(urls: string[]): Promise<Array<{url: string; title: string; content: string}>> {
    // This would typically fetch from IndexedDB or the store
    // For now, return mock data structure
    return urls.map(url => ({
      url,
      title: `Chapter for ${url}`,
      content: `Content for ${url}`
    }));
  }
}

// Export singleton instance
export const workerService = WorkerService.getInstance();