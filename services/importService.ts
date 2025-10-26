/**
 * Import Service - Handle session imports from URLs and files
 */

import { indexedDBService } from './indexeddb';
import { useAppStore } from '../store';
import type { SessionData } from '../types/session';
import type { TranslationResult, UsageMetrics, TranslationProvider } from '../types';
import { ChapterOps } from './db/operations/chapters';
import { TranslationOps } from './db/operations/translations';

export interface ImportProgress {
  stage: 'downloading' | 'parsing' | 'importing' | 'streaming' | 'complete';
  progress: number; // 0-100
  loaded?: number;
  total?: number;
  message?: string;
  retryAttempt?: number;
  maxRetries?: number;
  chaptersLoaded?: number;
  totalChapters?: number;
  canStartReading?: boolean;
}

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 2000; // 2 seconds

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable (network/timeout errors)
 */
function isRetryableError(error: any): boolean {
  const message = error.message?.toLowerCase() || '';
  return (
    error.name === 'AbortError' ||
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('connection')
  );
}

export class ImportService {
  /**
   * Import session from URL with CORS handling and progress tracking
   */
  static async importFromUrl(
    url: string,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<any> {
    let lastError: any;

    // Retry loop with exponential backoff
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // Convert GitHub URLs to raw format
      let fetchUrl = url;
      if (url.includes('github.com') && !url.includes('raw.githubusercontent.com')) {
        fetchUrl = url
          .replace('github.com', 'raw.githubusercontent.com')
          .replace('/blob/', '/');
      }

      // Convert Google Drive share links to Google Drive API endpoint
      if (url.includes('drive.google.com/file/d/')) {
        const fileId = url.match(/\/d\/([^/]+)/)?.[1];
        if (fileId) {
          // Use Google Drive API v3 endpoint which supports CORS
          // Requires GOOGLE_DRIVE_API_KEY in environment variables
          const apiKey = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY;

          if (apiKey) {
            // Google Drive API v3 with API key (supports CORS)
            fetchUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
          } else {
            // Fallback to direct download (will fail with CORS error)
            console.warn('[Import] GOOGLE_DRIVE_API_KEY not found. Set VITE_GOOGLE_DRIVE_API_KEY in .env.local to enable Google Drive downloads.');
            fetchUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
          }
        }
      }

      const attemptMsg = attempt > 0 ? ` (retry ${attempt}/${MAX_RETRIES})` : '';
      console.log(`[Import] Fetching from: ${fetchUrl}${attemptMsg}`);

      // Fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      try {
        const retryMsg = attempt > 0 ? ` (Retry ${attempt}/${MAX_RETRIES})` : '';
        onProgress?.({
          stage: 'downloading',
          progress: 0,
          message: `Starting download...${retryMsg}`,
          retryAttempt: attempt,
          maxRetries: MAX_RETRIES
        });

        const response = await fetch(fetchUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Check file size
        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength) : 0;

        if (total && total > 500 * 1024 * 1024) {
          throw new Error('Session file too large (>500MB)');
        }

        // Read response with progress tracking
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }

        let receivedLength = 0;
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          chunks.push(value);
          receivedLength += value.length;

          if (total) {
            const downloadProgress = Math.min((receivedLength / total) * 100, 99);
            onProgress?.({
              stage: 'downloading',
              progress: downloadProgress,
              loaded: receivedLength,
              total,
              message: `Downloading... ${(receivedLength / 1024 / 1024).toFixed(1)}MB / ${(total / 1024 / 1024).toFixed(1)}MB`
            });
          } else {
            onProgress?.({
              stage: 'downloading',
              progress: 50,
              loaded: receivedLength,
              message: `Downloading... ${(receivedLength / 1024 / 1024).toFixed(1)}MB`
            });
          }
        }

        onProgress?.({ stage: 'parsing', progress: 0, message: 'Parsing session data...' });

        // Convert chunks to text
        const blob = new Blob(chunks);
        const text = await blob.text();
        const sessionData = JSON.parse(text);

        // Validate format
        if (!sessionData.metadata?.format?.startsWith('lexiconforge')) {
          throw new Error('Invalid session format. Expected lexiconforge export.');
        }

        // NEW: Extract and store provenance if present
        if (sessionData.provenance) {
          useAppStore.getState().setSessionProvenance(sessionData.provenance);
        }

        // NEW: Extract and store version info if present
        if (sessionData.version) {
          useAppStore.getState().setSessionVersion(sessionData.version);
        }

        onProgress?.({ stage: 'importing', progress: 0, message: 'Importing to database...' });

        // Use store's import method which handles both IndexedDB AND store updates
        await useAppStore.getState().importSessionData(sessionData);

        onProgress?.({ stage: 'complete', progress: 100, message: 'Import complete!' });

        console.log(`[Import] Successfully imported ${sessionData.chapters?.length || 0} chapters`);

        // Success! Return the data
        return sessionData;
      } catch (error: any) {
        clearTimeout(timeoutId);

        // Store the error for potential retry
        lastError = error;

        // Check if this is a retryable error
        if (isRetryableError(error)) {
          // If we have retries left, wait and try again
          if (attempt < MAX_RETRIES) {
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt); // Exponential backoff
            console.warn(`[Import] Network error on attempt ${attempt + 1}. Retrying in ${delay}ms...`);

            onProgress?.({
              stage: 'downloading',
              progress: 0,
              message: `Network error. Retrying in ${delay / 1000}s...`,
              retryAttempt: attempt + 1,
              maxRetries: MAX_RETRIES
            });

            await sleep(delay);
            continue; // Retry the loop
          }
        }

        // Not retryable or out of retries, throw
        throw error;
      }
    }

    // If we get here, all retries failed
    console.error('[Import] Failed to import from URL after all retries:', lastError);
    throw new Error(`Failed to import after ${MAX_RETRIES} retries: ${lastError.message}`);
  }

  /**
   * Stream import session from URL - loads chapters progressively
   * Allows users to start reading after first 10 chapters load
   */
  static async streamImportFromUrl(
    url: string,
    onProgress?: (progress: ImportProgress) => void,
    onFirstChaptersReady?: () => void
  ): Promise<any> {
    return new Promise(async (resolve, reject) => {
      console.log('[StreamImport] Starting streaming import from:', url);

      // Convert GitHub URLs to raw format
      let fetchUrl = url;
      if (url.includes('github.com') && !url.includes('raw.githubusercontent.com')) {
        fetchUrl = url
          .replace('github.com', 'raw.githubusercontent.com')
          .replace('/blob/', '/');
      }

      // Convert Google Drive share links
      if (url.includes('drive.google.com/file/d/')) {
        const fileId = url.match(/\/d\/([^/]+)/)?.[1];
        if (fileId) {
          const apiKey = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY;
          if (apiKey) {
            fetchUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
          } else {
            fetchUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
          }
        }
      }

      console.log('[StreamImport] Fetching from:', fetchUrl);

      try {
        // Dynamic import oboe
        const oboe = (await import('oboe')).default;

        let chaptersLoaded = 0;
        let totalChapters = 0;
        let metadata: any = null;
        let firstChaptersReadyCalled = false;
        const loadedChapterIds = new Set<string>();

        const normalizeUsageMetrics = (
          metrics: Partial<UsageMetrics> | undefined,
          fallbackProvider?: string,
          fallbackModel?: string
        ): UsageMetrics => {
          const provider = (metrics?.provider || fallbackProvider || 'OpenRouter') as TranslationProvider;
          return {
            totalTokens: metrics?.totalTokens ?? 0,
            promptTokens: metrics?.promptTokens ?? 0,
            completionTokens: metrics?.completionTokens ?? 0,
            estimatedCost: metrics?.estimatedCost ?? 0,
            requestTime: metrics?.requestTime ?? 0,
            provider,
            model: metrics?.model || fallbackModel || 'unknown-model',
          };
        };

        const buildTranslationInputs = (chapter: any) => {
          const inputs: Array<{
            result: TranslationResult;
            settings: {
              provider: string;
              model: string;
              temperature: number;
              systemPrompt: string;
              promptId?: string;
              promptName?: string;
            };
            isActive: boolean;
          }> = [];

          if (Array.isArray(chapter.translations) && chapter.translations.length > 0) {
            for (const translation of chapter.translations) {
              const usage = normalizeUsageMetrics(
                translation.usageMetrics,
                translation.provider,
                translation.model
              );

              const result: TranslationResult = {
                translatedTitle: translation.translatedTitle || chapter.title || 'Untitled Chapter',
                translation: translation.translation || '',
                footnotes: translation.footnotes || [],
                suggestedIllustrations: translation.suggestedIllustrations || [],
                usageMetrics: usage,
                proposal: translation.proposal ?? null,
                customVersionLabel: translation.customVersionLabel,
                imageVersionState: translation.imageVersionState,
              };

              inputs.push({
                result,
                settings: {
                  provider: usage.provider,
                  model: usage.model,
                  temperature: typeof translation.temperature === 'number' ? translation.temperature : 0.7,
                  systemPrompt: translation.systemPrompt || '',
                  promptId: translation.promptId,
                  promptName: translation.promptName,
                },
                isActive: Boolean(translation.isActive),
              });
            }
          } else if (chapter.translationResult) {
            const usage = normalizeUsageMetrics(
              chapter.translationResult.usageMetrics,
              chapter.translationResult.usageMetrics?.provider,
              chapter.translationResult.usageMetrics?.model
            );

            const result: TranslationResult = {
              translatedTitle: chapter.translationResult.translatedTitle || chapter.title || 'Untitled Chapter',
              translation: chapter.translationResult.translation || '',
              footnotes: chapter.translationResult.footnotes || [],
              suggestedIllustrations: chapter.translationResult.suggestedIllustrations || [],
              proposal: chapter.translationResult.proposal ?? null,
              usageMetrics: usage,
              customVersionLabel: chapter.translationResult.customVersionLabel,
              imageVersionState: chapter.translationResult.imageVersionState,
            };

            inputs.push({
              result,
              settings: {
                provider: usage.provider,
                model: usage.model,
                temperature: 0.7,
                systemPrompt: '',
              },
              isActive: true,
            });
          }

          return inputs;
        };

        oboe(fetchUrl)
          // Extract metadata first
          .node('metadata', function(meta) {
            metadata = meta;
            totalChapters = meta.chapterCount || 0;
            console.log('[StreamImport] Metadata loaded:', { totalChapters });

            onProgress?.({
              stage: 'streaming',
              progress: 0,
              chaptersLoaded: 0,
              totalChapters,
              message: `Starting stream... (${totalChapters} chapters total)`,
              canStartReading: false,
            });

            return oboe.drop; // Don't keep in memory
          })

          // Process each chapter as it arrives
          .node('chapters.*', async function(chapter) {
            try {
              const chapterUrl: string | undefined = chapter.url || chapter.canonicalUrl;
              if (!chapterUrl) {
                console.warn('[StreamImport] Skipping chapter without URL:', chapter);
                return oboe.drop;
              }

              const translationInputs = buildTranslationInputs(chapter);

              console.log(`[📥 IMPORT] Storing chapter #${chapter.chapterNumber}: "${chapter.title}"`, {
                url: chapterUrl,
                translationsFound: translationInputs.length,
              });

              // Import chapter to IndexedDB immediately
              await ChapterOps.store({
                stableId: chapter.stableId,
                originalUrl: chapterUrl,
                title: chapter.title,
                content: chapter.content,
                nextUrl: chapter.nextUrl,
                prevUrl: chapter.prevUrl,
                chapterNumber: chapter.chapterNumber,
                fanTranslation: chapter.fanTranslation,
              });
              console.log(`[✅ IMPORT] Chapter #${chapter.chapterNumber} stored to CHAPTERS`);

              let activeVersion: number | null = null;

              for (const translation of translationInputs) {
                const stored = await TranslationOps.store({
                  ref: { url: chapterUrl, stableId: chapter.stableId },
                  result: translation.result,
                  settings: translation.settings,
                });

                if (
                  translation.isActive ||
                  (translationInputs.length === 1 && activeVersion === null)
                ) {
                  activeVersion = stored.version;
                }

                console.log(
                  `[✅ IMPORT] Translation stored for chapter #${chapter.chapterNumber}: "${translation.result.translatedTitle}" (version ${stored.version})`
                );
              }

              if (activeVersion !== null && translationInputs.length > 1) {
                await TranslationOps.setActiveByUrl(chapterUrl, activeVersion);
              }

              chaptersLoaded++;
              loadedChapterIds.add(chapter.stableId || chapterUrl);

              const progress = totalChapters > 0
                ? (chaptersLoaded / totalChapters) * 100
                : (chaptersLoaded / 500) * 100; // Estimate if unknown

              onProgress?.({
                stage: 'streaming',
                progress,
                chaptersLoaded,
                totalChapters,
                message: `Loaded ${chaptersLoaded}${totalChapters > 0 ? `/${totalChapters}` : ''} chapters...`,
                canStartReading: chaptersLoaded >= 10,
              });

              // After 10 chapters, notify that reading can start
              if (chaptersLoaded === 10 && !firstChaptersReadyCalled) {
                firstChaptersReadyCalled = true;
                console.log('[StreamImport] First 10 chapters ready - user can start reading');
                onFirstChaptersReady?.();
              }

              // Log progress every 50 chapters
              if (chaptersLoaded % 50 === 0) {
                console.log(`[StreamImport] Progress: ${chaptersLoaded}/${totalChapters} chapters loaded`);
              }
            } catch (err) {
              console.error('[StreamImport] Failed to import chapter:', err);
            }

            return oboe.drop; // Don't keep in memory - critical for large files!
          })

          // Stream complete
          .done(async function(fullData) {
            console.log('[StreamImport] Stream complete:', { chaptersLoaded, totalChapters });

            onProgress?.({
              stage: 'complete',
              progress: 100,
              chaptersLoaded,
              totalChapters,
              message: `All ${chaptersLoaded} chapters loaded!`,
              canStartReading: true,
            });

            // Hydrate store from IndexedDB
            const rendering = await indexedDBService.getChaptersForReactRendering();
            const nav = await indexedDBService.getSetting<any>('navigation-history').catch(() => null);

            useAppStore.setState(state => {
              const newChapters = new Map<string, any>();
              for (const ch of rendering) {
                newChapters.set(ch.stableId, {
                  id: ch.stableId,
                  stableId: ch.stableId,
                  title: ch.data.chapter.title,
                  content: ch.data.chapter.content,
                  originalUrl: ch.url,
                  canonicalUrl: ch.url,
                  nextUrl: ch.data.chapter.nextUrl,
                  prevUrl: ch.data.chapter.prevUrl,
                  chapterNumber: ch.chapterNumber || 0,
                  sourceUrls: [ch.url],
                  fanTranslation: ch.data.chapter.fanTranslation ?? null,
                  translationResult: ch.data.translationResult || null,
                  feedback: [],
                });
              }

              return {
                chapters: newChapters,
                navigationHistory: Array.isArray(nav?.stableIds) ? nav.stableIds : state.navigationHistory,
                error: null,
              };
            });

            resolve(fullData);
          })

          // Handle errors
          .fail(function(error) {
            console.error('[StreamImport] Stream failed:', error);
            reject(new Error(`Streaming import failed: ${error.message || error}`));
          });

      } catch (error: any) {
        console.error('[StreamImport] Failed to start stream:', error);
        reject(new Error(`Failed to start streaming: ${error.message}`));
      }
    });
  }

  /**
   * Import from File (existing behavior)
   */
  static async importFromFile(file: File): Promise<any> {
    try {
      const text = await file.text();
      const sessionData = JSON.parse(text);

      // Validate format
      if (!sessionData.metadata?.format?.startsWith('lexiconforge')) {
        throw new Error('Invalid session format');
      }

      // Extract and store provenance if present
      if (sessionData.provenance) {
        useAppStore.getState().setSessionProvenance(sessionData.provenance);
      }

      // Extract and store version info if present
      if (sessionData.version) {
        useAppStore.getState().setSessionVersion(sessionData.version);
      }

      // Use store's import method which handles both IndexedDB AND store updates
      await useAppStore.getState().importSessionData(sessionData);

      console.log(`[Import] Successfully imported from file: ${file.name}`);

      return sessionData;
    } catch (error: any) {
      console.error('[Import] Failed to import from file:', error);
      throw new Error(`Failed to import file: ${error.message}`);
    }
  }
}
