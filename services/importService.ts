/**
 * Import Service - Handle session imports from URLs and files
 */

import { useAppStore } from '../store';
import type { SessionData } from '../types/session';
import type {
  AppSettings,
  Chapter,
  TranslationResult,
  UsageMetrics,
  TranslationProvider,
} from '../types';
import { ChapterOps } from './db/operations/chapters';
import { TranslationOps } from './db/operations/translations';
import { SettingsOps } from './db/operations';
import { fetchChaptersForReactRendering } from './db/operations/rendering';
import { debugLog } from '../utils/debug';
import { normalizeUrlAggressively } from './stableIdService';
import { telemetryService } from './telemetryService';
import {
  convertBookTokiToLexiconForgeFullPayload,
  isBookTokiScrapePayload,
} from './import/booktoki';

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
const FIRST_BATCH_THRESHOLD = 4;

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
        let sessionData = JSON.parse(text);

        // Allow BookToki scraper JSON payloads by converting them into a LexiconForge full export payload.
        if (isBookTokiScrapePayload(sessionData)) {
          sessionData = convertBookTokiToLexiconForgeFullPayload(sessionData);
        }

        // Validate format
        if (!sessionData.metadata?.format?.startsWith('lexiconforge')) {
          throw new Error('Invalid session format. Expected lexiconforge export or BookToki scrape JSON.');
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

      const now = () =>
        typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : Date.now();
      const streamStart = now();
      let firstBatchTelemetrySent = false;

      try {
        let chaptersLoaded = 0;
        let totalChapters = 0;
        let metadata: any = null;
        let firstChaptersReadyCalled = false;

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
            settings: Pick<AppSettings, 'provider' | 'model' | 'temperature' | 'systemPrompt'> & {
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

        const response = await fetch(fetchUrl, {
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok || !response.body) {
          throw new Error(`Failed to fetch session (${response.status} ${response.statusText})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = '';
        let metadataEmitted = false;
        let chaptersStarted = false;
        let chaptersCompleted = false;

        const findMatchingBrace = (source: string, start: number): number => {
          let depth = 0;
          let inString = false;
          let escaped = false;

          for (let i = start; i < source.length; i++) {
            const char = source[i];

            if (escaped) {
              escaped = false;
              continue;
            }

            if (char === '\\') {
              escaped = true;
              continue;
            }

            if (char === '"') {
              inString = !inString;
              continue;
            }

            if (inString) continue;

            if (char === '{') depth++;
            if (char === '}') {
              depth--;
              if (depth === 0) {
                return i;
              }
            }
          }

          return -1;
        };

        const trimLeadingSeparators = () => {
          let index = 0;
          while (index < buffer.length) {
            const char = buffer[index];
            if (char === ',' || char === '\n' || char === '\r' || char === '\t' || char === ' ') {
              index++;
              continue;
            }
            break;
          }
          if (index > 0) {
            buffer = buffer.slice(index);
          }
        };

        const emitMetadataIfReady = () => {
          if (metadataEmitted) return;

          const metadataKey = buffer.indexOf('"metadata"');
          if (metadataKey === -1) return;

          const objectStart = buffer.indexOf('{', metadataKey);
          if (objectStart === -1) return;

          const objectEnd = findMatchingBrace(buffer, objectStart);
          if (objectEnd === -1) return;

          const metadataJson = buffer.slice(objectStart, objectEnd + 1);
          try {
            metadata = JSON.parse(metadataJson);
          } catch (error) {
            console.error('[StreamImport] Failed to parse metadata chunk', error);
            throw error;
          }
          metadataEmitted = true;
          totalChapters = metadata.chapterCount || 0;
          console.log('[StreamImport] Metadata loaded:', { totalChapters });

          onProgress?.({
            stage: 'streaming',
            progress: 0,
            chaptersLoaded: 0,
            totalChapters,
            message: `Starting stream... (${totalChapters || 'unknown'} chapters total)`,
            canStartReading: false,
          });

          buffer = buffer.slice(objectEnd + 1);
        };

        const ensureChaptersArrayStarted = () => {
          if (!metadataEmitted || chaptersStarted) return;

          const chaptersKey = buffer.indexOf('"chapters"');
          if (chaptersKey === -1) return;

          const arrayStart = buffer.indexOf('[', chaptersKey);
          if (arrayStart === -1) return;

          buffer = buffer.slice(arrayStart + 1);
          chaptersStarted = true;
        };

        const extractNextChapter = (): any | null => {
          trimLeadingSeparators();

          if (!buffer.length) return 'incomplete';

          const firstChar = buffer[0];

          if (firstChar === ']') {
            chaptersCompleted = true;
            buffer = buffer.slice(1);
            return null;
          }

          if (firstChar !== '{') {
            buffer = buffer.slice(1);
            return 'incomplete';
          }

          const endIndex = findMatchingBrace(buffer, 0);
          if (endIndex === -1) {
            return 'incomplete';
          }

          const chapterJson = buffer.slice(0, endIndex + 1);
          buffer = buffer.slice(endIndex + 1);

          try {
            return JSON.parse(chapterJson);
          } catch (error) {
            console.error('[StreamImport] Failed to parse chapter JSON', error);
            throw error;
          }
        };

        const processChapter = async (chapter: any) => {
          const chapterUrl: string | undefined = chapter.url || chapter.canonicalUrl;
          if (!chapterUrl) {
            console.warn('[StreamImport] Skipping chapter without URL:', chapter);
            return;
          }

          const translationInputs = buildTranslationInputs(chapter);

          console.log(`[📥 IMPORT] Storing chapter #${chapter.chapterNumber}: "${chapter.title}"`, {
            url: chapterUrl,
            translationsFound: translationInputs.length,
          });

          const chapterPayload: Chapter & { stableId?: string; fanTranslation?: string | null } = {
            stableId: chapter.stableId,
            originalUrl: chapterUrl,
            title: chapter.title,
            content: chapter.content,
            nextUrl: chapter.nextUrl ?? null,
            prevUrl: chapter.prevUrl ?? null,
            chapterNumber: chapter.chapterNumber,
            fanTranslation: chapter.fanTranslation ?? null,
          };
          await ChapterOps.store(chapterPayload);
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

          if (totalChapters === 0 && metadata?.chapterCount) {
            totalChapters = metadata.chapterCount;
          }

          const progress = totalChapters > 0
            ? (chaptersLoaded / totalChapters) * 100
            : Math.min(100, (chaptersLoaded / 500) * 100);
          const readyThreshold = totalChapters > 0 ? Math.min(totalChapters, FIRST_BATCH_THRESHOLD) : FIRST_BATCH_THRESHOLD;

          debugLog(
            'import',
            'summary',
            '[StreamImport] Progress tick',
            {
              chaptersLoaded,
              totalChapters,
              readyThreshold,
              firstChaptersReadyCalled,
            }
          );

          onProgress?.({
            stage: 'streaming',
            progress,
            chaptersLoaded,
            totalChapters,
            message: totalChapters > 0
              ? `Loaded ${chaptersLoaded}/${totalChapters} chapters...`
              : `Loaded ${chaptersLoaded} chapters...`,
            canStartReading: chaptersLoaded >= readyThreshold,
          });

          const shouldTriggerFirstChapters =
            !firstChaptersReadyCalled && chaptersLoaded >= readyThreshold;

          debugLog(
            'import',
            'summary',
            '[StreamImport] Evaluating first chapter hydration trigger',
            {
              chaptersLoaded,
              totalChapters,
              readyThreshold,
              firstChaptersReadyCalled,
              conditionMet: shouldTriggerFirstChapters,
            }
          );

          if (shouldTriggerFirstChapters) {
            debugLog(
              'import',
              'summary',
              '[StreamImport] Triggering onFirstChaptersReady callback',
              {
                chaptersLoaded,
                totalChapters,
                readyThreshold,
              }
            );
            firstChaptersReadyCalled = true;
            if (!firstBatchTelemetrySent) {
              const durationMs = now() - streamStart;
              telemetryService.capturePerformance('import:stream:firstBatchReady', durationMs, {
                chaptersLoaded,
                totalChapters: totalChapters || null,
                threshold: readyThreshold,
              });
              firstBatchTelemetrySent = true;
            }
            console.log('[StreamImport] First batch of chapters ready - user can start reading');
            onFirstChaptersReady?.();
          }

          if (chaptersLoaded % 50 === 0) {
            console.log(`[StreamImport] Progress: ${chaptersLoaded}/${totalChapters || 'unknown'} chapters loaded`);
          }
        };

        try {
          let done = false;
          while (!done) {
            const { value, done: chunkDone } = await reader.read();
            done = chunkDone;
            buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

            emitMetadataIfReady();
            ensureChaptersArrayStarted();

            while (chaptersStarted && !chaptersCompleted) {
              const nextChapter = extractNextChapter();
              if (nextChapter === 'incomplete') break;
              if (nextChapter === null) break;
              await processChapter(nextChapter);
            }
          }

          buffer += decoder.decode();

          emitMetadataIfReady();
          ensureChaptersArrayStarted();

          while (chaptersStarted && !chaptersCompleted) {
            const nextChapter = extractNextChapter();
            if (nextChapter === 'incomplete') break;
            if (nextChapter === null) break;
            await processChapter(nextChapter);
          }
        } catch (error) {
          console.error('[StreamImport] Stream failed:', error);
          reject(new Error(`Streaming import failed: ${error instanceof Error ? error.message : String(error)}`));
          telemetryService.capturePerformance('import:stream:error', now() - streamStart, {
            chaptersLoaded,
            totalChapters: totalChapters || null,
            reason: error instanceof Error ? error.message : String(error),
          });
          return;
        } finally {
          reader.releaseLock();
        }

        if (!totalChapters) {
          totalChapters = chaptersLoaded;
        }

        console.log('[StreamImport] Stream complete:', { chaptersLoaded, totalChapters });

        onProgress?.({
          stage: 'complete',
          progress: 100,
          chaptersLoaded,
          totalChapters,
          message: `All ${totalChapters} chapters loaded!`,
          canStartReading: true,
        });

        telemetryService.capturePerformance('import:stream:complete', now() - streamStart, {
          chaptersLoaded,
          totalChapters: totalChapters || null,
        });

        debugLog(
          'import',
          'summary',
          '[StreamImport] Hydrating store after streaming import',
          {
            chaptersLoaded,
            totalChapters,
          }
        );

        const rendering = await fetchChaptersForReactRendering();
        const nav = await SettingsOps.getKey<any>('navigation-history').catch(() => null);

        useAppStore.setState(state => {
          const newChapters = new Map<string, any>();
          const newUrlIndex = new Map<string, string>();
          const newRawUrlIndex = new Map<string, string>();
          for (const ch of rendering) {
            const chapterData = ch.data?.chapter;
            const canonicalUrl = ch.url ?? chapterData?.originalUrl ?? null;
            const originalUrl = chapterData?.originalUrl ?? canonicalUrl ?? null;
            const title = chapterData?.title ?? ch.title ?? 'Untitled Chapter';
            const content = chapterData?.content ?? '';
            const nextUrl = chapterData?.nextUrl ?? null;
            const prevUrl = chapterData?.prevUrl ?? null;
            const chapterNumber = ch.chapterNumber ?? chapterData?.chapterNumber ?? 0;

            newChapters.set(ch.stableId, {
              id: ch.stableId,
              stableId: ch.stableId,
              url: canonicalUrl,
              canonicalUrl,
              title,
              content,
              nextUrl,
              prevUrl,
              chapterNumber,
              fanTranslation: chapterData?.fanTranslation ?? null,
              translationResult: ch.data?.translationResult || null,
              feedback: [],
            });

            if (canonicalUrl) {
              newRawUrlIndex.set(canonicalUrl, ch.stableId);
              const normalizedCanonical = normalizeUrlAggressively(canonicalUrl);
              if (normalizedCanonical) {
                newUrlIndex.set(normalizedCanonical, ch.stableId);
              }
            }

            if (originalUrl) {
              newRawUrlIndex.set(originalUrl, ch.stableId);
              const normalizedOriginal = normalizeUrlAggressively(originalUrl);
              if (normalizedOriginal) {
                newUrlIndex.set(normalizedOriginal, ch.stableId);
              }
            }
          }

          return {
            chapters: newChapters,
            urlIndex: newUrlIndex,
            rawUrlIndex: newRawUrlIndex,
            navigationHistory: Array.isArray(nav?.stableIds) ? nav.stableIds : state.navigationHistory,
            error: null,
          };
        });

        const postHydrationState = useAppStore.getState();
        debugLog(
          'import',
          'summary',
          '[StreamImport] Post-hydration state snapshot',
          {
            hydratedChapters: rendering.length,
            currentChapterId: postHydrationState.currentChapterId,
          }
        );

        if (!postHydrationState.currentChapterId && rendering.length > 0) {
          const first = rendering[0];
          const firstUrl = first.url ?? first.data?.chapter?.originalUrl ?? null;
          debugLog(
            'import',
            'summary',
            '[StreamImport] Selecting first chapter after hydration fallback',
            {
              firstStableId: first.stableId,
              firstTitle: first.title,
              totalHydrated: rendering.length,
            }
          );
          useAppStore.setState(state => {
            const existing = state.currentChapterId;
            if (existing) {
              return state;
            }
            const updatedUrlIndex = state.urlIndex instanceof Map ? new Map(state.urlIndex) : new Map<string, string>();
            const updatedRawUrlIndex = state.rawUrlIndex instanceof Map ? new Map(state.rawUrlIndex) : new Map<string, string>();
            if (firstUrl) {
              updatedRawUrlIndex.set(firstUrl, first.stableId);
              const normalized = normalizeUrlAggressively(firstUrl);
              if (normalized) {
                updatedUrlIndex.set(normalized, first.stableId);
              }
            }
            const originalUrl = first.data?.chapter?.originalUrl;
            if (originalUrl) {
              updatedRawUrlIndex.set(originalUrl, first.stableId);
              const normalizedOriginal = normalizeUrlAggressively(originalUrl);
              if (normalizedOriginal) {
                updatedUrlIndex.set(normalizedOriginal, first.stableId);
              }
            }
            return {
              currentChapterId: first.stableId,
              urlIndex: updatedUrlIndex,
              rawUrlIndex: updatedRawUrlIndex,
            };
          });
        }

        resolve({ metadata, chaptersLoaded });
      } catch (error: any) {
        console.error('[StreamImport] Failed to start stream:', error);
        telemetryService.capturePerformance('import:stream:error', now() - streamStart, {
          chaptersLoaded: 0,
          totalChapters: null,
          reason: error?.message || String(error),
        });
        reject(new Error(`Failed to start streaming: ${error.message || error}`));
      }
    });
  }

  /**
   * Import from File (existing behavior)
   */
  static async importFromFile(file: File): Promise<any> {
    try {
      const text = await file.text();
      let sessionData = JSON.parse(text);

      // Allow BookToki scraper JSON payloads by converting them into a LexiconForge full export payload.
      if (isBookTokiScrapePayload(sessionData)) {
        sessionData = convertBookTokiToLexiconForgeFullPayload(sessionData);
      }

      // Validate format
      if (!sessionData.metadata?.format?.startsWith('lexiconforge')) {
        throw new Error('Invalid session format. Expected lexiconforge export or BookToki scrape JSON.');
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
