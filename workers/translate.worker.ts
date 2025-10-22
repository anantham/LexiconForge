// Translation Worker - Handles batch translation operations off the main thread

import type { AppSettings, HistoricalChapter, TranslationResult } from '../types';

// Message types for communication with main thread
export interface TranslationJob {
  id: string;
  chapters: Array<{
    url: string;
    title: string;
    content: string;
    chapterId?: string;
  }>;
  settings: AppSettings;
  history: HistoricalChapter[];
  fanTranslation?: string | null;
}

export interface TranslationProgress {
  jobId: string;
  completed: number;
  total: number;
  currentChapter?: string;
  error?: string;
  results?: TranslationResult[];
}

// Job state management
const activeJobs = new Map<string, AbortController>();

// Listen for messages from main thread
self.addEventListener('message', async (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'START_TRANSLATION_JOB':
      await handleTranslationJob(payload);
      break;
    case 'CANCEL_TRANSLATION_JOB':
      handleJobCancellation(payload.jobId);
      break;
    case 'PAUSE_TRANSLATION_JOB':
      // TODO: Implement pause functionality
      break;
    default:
      console.warn(`[TranslationWorker] Unknown message type: ${type}`);
  }
});

async function handleTranslationJob(job: TranslationJob) {
  const { id, chapters, settings, history, fanTranslation } = job;
  const abortController = new AbortController();
  activeJobs.set(id, abortController);

  try {
    // Initialize translation service
    await initializeTranslationService();

    const results: TranslationResult[] = [];
    
    // Process chapters sequentially to respect rate limits
    for (let i = 0; i < chapters.length; i++) {
      if (abortController.signal.aborted) {
        postProgress(id, i, chapters.length, undefined, 'Job cancelled');
        return;
      }

      const chapter = chapters[i];
      
      try {
        // Post progress update
        postProgress(id, i, chapters.length, chapter.title);

        // Perform translation
        const result = await translateChapter(
          chapter.title,
          chapter.content,
          settings,
          history,
          fanTranslation,
          abortController.signal,
          chapter.chapterId
        );

        results.push(result);

        // Update history with successful translation for context
        history.push({
          originalTitle: chapter.title,
          originalContent: chapter.content,
          translatedContent: JSON.stringify({
            translatedTitle: result.translatedTitle,
            translation: result.translation
          })
        });

        // Keep history manageable (last 3 translations)
        if (history.length > 3) {
          history.shift();
        }

      } catch (error: any) {
        console.error(`[TranslationWorker] Failed to translate chapter ${i + 1}:`, error);
        
        if (error.name === 'AbortError' || abortController.signal.aborted) {
          postProgress(id, i, chapters.length, chapter.title, 'Job cancelled');
          return;
        }

        // For rate limit errors, implement exponential backoff
        if (error.message?.includes('429') || error.message?.includes('rate_limit')) {
          const delay = Math.min(60000, 1000 * Math.pow(2, Math.floor(i / 5))); // Max 1 minute
          console.warn(`[TranslationWorker] Rate limited, waiting ${delay}ms before continuing...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Retry this chapter
          i--; 
          continue;
        }

        // For other errors, record the error and continue
        results.push({
          translatedTitle: `[ERROR] ${chapter.title}`,
          translation: `Translation failed: ${error.message}`,
          illustrations: [],
          amendments: [],
          model: settings.model,
          provider: settings.provider,
          translationSettings: {
            provider: settings.provider,
            model: settings.model,
            temperature: settings.temperature,
            systemPrompt: settings.systemPrompt,
          }
        });
      }
    }

    // Job completed successfully
    postProgress(id, chapters.length, chapters.length, undefined, undefined, results);
    activeJobs.delete(id);

  } catch (error: any) {
    console.error(`[TranslationWorker] Job ${id} failed:`, error);
    postProgress(id, 0, chapters.length, undefined, error.message);
    activeJobs.delete(id);
  }
}

function handleJobCancellation(jobId: string) {
  const controller = activeJobs.get(jobId);
  if (controller) {
    controller.abort();
    activeJobs.delete(jobId);
    console.log(`[TranslationWorker] Job ${jobId} cancelled`);
  }
}

function postProgress(
  jobId: string, 
  completed: number, 
  total: number, 
  currentChapter?: string, 
  error?: string,
  results?: TranslationResult[]
) {
  const progress: TranslationProgress = {
    jobId,
    completed,
    total,
    currentChapter,
    error,
    results
  };

  self.postMessage({
    type: 'TRANSLATION_PROGRESS',
    payload: progress
  });
}

// Initialize translation services in worker context
async function initializeTranslationService() {
  try {
    // Import and initialize the translation system
    const { initializeProviders } = await import('../adapters/providers');
    await initializeProviders();
  } catch (error) {
    console.error('[TranslationWorker] Failed to initialize translation service:', error);
    throw error;
  }
}

// Worker-compatible translation function
async function translateChapter(
  title: string,
  content: string,
  settings: AppSettings,
  history: HistoricalChapter[],
  fanTranslation?: string | null,
  abortSignal?: AbortSignal,
  chapterId?: string
): Promise<TranslationResult> {
  const { translator } = await import('../services/translate/Translator');

  return translator.translate({
    title,
    content,
    settings,
    history,
    fanTranslation,
    abortSignal,
    chapterId
  }, {
    maxRetries: settings.retryMax ?? 3,
    initialDelay: settings.retryInitialDelayMs ?? 2000
  });
}

console.log('[TranslationWorker] Worker initialized and ready');