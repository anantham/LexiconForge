/**
 * Import Service - Handle session imports from URLs and files
 */

/** Browser memory safety limit for session import downloads */
const MAX_IMPORT_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

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
import type { TranslationRecord } from './db/types';
import { debugLog, debugWarn } from '../utils/debug';
import { withRetry, isNetworkError } from '../utils/retry';
import { telemetryService } from './telemetryService';
import { loadAllIntoStore, loadNovelIntoStore } from './readerHydrationService';
import { generateStableChapterId } from './stableIdService';
import {
  buildLibraryScopeKey,
  buildScopedStableId,
  buildScopedStorageUrl,
  isScopedStableId,
  parseScopedStableId,
} from './libraryScope';
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

export interface ImportOptions {
  registryNovelId?: string | null;
  registryVersionId?: string | null;
}

const MAX_RETRIES = 3;
const FIRST_BATCH_THRESHOLD = 4;

const GIT_LFS_POINTER_PREFIX = 'version https://git-lfs.github.com/spec/v1';

const convertGitHubUrlToRaw = (url: string): string => {
  if (url.includes('github.com') && !url.includes('raw.githubusercontent.com')) {
    return url
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob/', '/');
  }

  return url;
};

const convertRawGitHubUrlToMedia = (url: string): string => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'raw.githubusercontent.com') {
      return url;
    }

    const [, owner, repo, ...rest] = parsed.pathname.split('/');
    if (!owner || !repo || rest.length === 0) {
      return url;
    }

    return `https://media.githubusercontent.com/media/${owner}/${repo}/${rest.join('/')}`;
  } catch {
    return url;
  }
};

const normalizeImportUrl = (url: string): string => {
  const rawUrl = convertGitHubUrlToRaw(url);
  return /\/session\.json$/i.test(rawUrl) ? convertRawGitHubUrlToMedia(rawUrl) : rawUrl;
};

const isGitLfsPointer = (text: string): boolean => text.trimStart().startsWith(GIT_LFS_POINTER_PREFIX);

const buildGitLfsPointerError = (fetchUrl: string): Error => {
  const mediaSuggestion = fetchUrl.includes('raw.githubusercontent.com')
    ? ` Try the media URL instead: ${convertRawGitHubUrlToMedia(fetchUrl)}`
    : '';
  return new Error(
    `Session URL returned a Git LFS pointer instead of JSON.${mediaSuggestion}`
  );
};

const getScopedChapterIdentity = (
  chapter: {
    stableId?: string;
    chapterNumber?: number;
    title?: string;
    content?: string;
    url?: string;
    canonicalUrl?: string;
  },
  options: ImportOptions
): { stableId: string; storageUrl: string; canonicalUrl: string } => {
  const canonicalUrl = chapter.canonicalUrl || chapter.url || '';

  if (!options.registryNovelId) {
    const stableId =
      chapter.stableId ||
      generateStableChapterId(
        chapter.content || '',
        chapter.chapterNumber || 0,
        chapter.title || 'Untitled Chapter'
      );
    return {
      stableId,
      storageUrl: canonicalUrl,
      canonicalUrl,
    };
  }

  const expectedScopeKey = buildLibraryScopeKey(
    options.registryNovelId,
    options.registryVersionId ?? null
  );

  // isScopedStableId returns true only for strings, so this narrowing is
  // behavior-equivalent — the typeof check merely lets the compiler see it.
  const scopedStableId = chapter.stableId;
  if (typeof scopedStableId === 'string' && isScopedStableId(scopedStableId)) {
    const parsed = parseScopedStableId(scopedStableId);
    if (!parsed) {
      throw new Error(
        `[Import] Failed to parse scoped chapter stableId "${scopedStableId}" for "${chapter.title || canonicalUrl}".`
      );
    }
    if (parsed.scopeKey !== expectedScopeKey) {
      throw new Error(
        `[Import] Scoped stableId scope mismatch for "${chapter.title || canonicalUrl}". ` +
        `expectedScope="${expectedScopeKey}", actualScope="${parsed.scopeKey}", stableId="${scopedStableId}".`
      );
    }

    return {
      stableId: scopedStableId,
      storageUrl: buildScopedStorageUrl(
        scopedStableId,
        options.registryNovelId,
        options.registryVersionId ?? null
      ),
      canonicalUrl,
    };
  }

  const baseStableId =
    chapter.stableId ||
    generateStableChapterId(
      chapter.content || '',
      chapter.chapterNumber || 0,
      chapter.title || 'Untitled Chapter'
    );

  const stableId = buildScopedStableId(
    baseStableId,
    options.registryNovelId,
    options.registryVersionId ?? null
  );

  return {
    stableId,
    storageUrl: buildScopedStorageUrl(
      stableId,
      options.registryNovelId,
      options.registryVersionId ?? null
    ),
    canonicalUrl,
  };
};

export class ImportService {
  /**
   * Import session from URL with CORS handling and progress tracking
   */
  static async importFromUrl(
    url: string,
    onProgress?: (progress: ImportProgress) => void,
    options: ImportOptions = {}
  ): Promise<any> {
    // Convert GitHub URLs to raw format
    let fetchUrl = normalizeImportUrl(url);

    // Convert public Google Drive share links to their direct-download endpoint.
    if (url.includes('drive.google.com/file/d/')) {
      const fileId = url.match(/\/d\/([^/]+)/)?.[1];
      if (fileId) {
        fetchUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      }
    }

    return withRetry(
      async (attempt) => {
        const attemptMsg = attempt > 0 ? ` (retry ${attempt}/${MAX_RETRIES})` : '';
        debugLog('import', 'summary', `[Import] Fetching from: ${fetchUrl}${attemptMsg}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

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

          const contentLength = response.headers.get('content-length');
          const total = contentLength ? parseInt(contentLength) : 0;

          if (total && total > MAX_IMPORT_SIZE_BYTES) {
            throw new Error('Session file too large (>500MB)');
          }

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

          const blob = new Blob(chunks);
          const text = await blob.text();
          if (isGitLfsPointer(text)) {
            throw buildGitLfsPointerError(fetchUrl);
          }
          let sessionData = JSON.parse(text);

          if (isBookTokiScrapePayload(sessionData)) {
            sessionData = convertBookTokiToLexiconForgeFullPayload(sessionData);
          }

          if (typeof options.registryNovelId === 'string') {
            sessionData = {
              ...sessionData,
              novelId: options.registryNovelId,
              libraryVersionId: options.registryVersionId ?? null,
            };
          }

          if (!sessionData.metadata?.format?.startsWith('lexiconforge')) {
            throw new Error('Invalid session format. Expected lexiconforge export or BookToki scrape JSON.');
          }

          if (sessionData.provenance) {
            useAppStore.getState().setSessionProvenance(sessionData.provenance);
          }
          if (sessionData.version) {
            useAppStore.getState().setSessionVersion(sessionData.version);
          }

          onProgress?.({ stage: 'importing', progress: 0, message: 'Importing to database...' });
          await useAppStore.getState().importSessionData(sessionData);
          onProgress?.({ stage: 'complete', progress: 100, message: 'Import complete!' });

          debugLog('import', 'summary', `[Import] Successfully imported ${sessionData.chapters?.length || 0} chapters`);
          return sessionData;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      },
      {
        maxAttempts: MAX_RETRIES + 1,
        initialDelay: 2000,
        // This fetch aborts ITSELF on an internal timeout, and retrying that
        // self-abort is intended. The abort-retry opt-in lives here rather
        // than in isNetworkError, whose contract must never retry a
        // user-cancel AbortError.
        isRetryable: (e) =>
          isNetworkError(e) || (e instanceof DOMException && e.name === 'AbortError'),
        onRetry: (attempt, delay) => {
          debugWarn('import', 'summary', `[Import] Network error on attempt ${attempt}. Retrying in ${delay}ms...`);
          onProgress?.({
            stage: 'downloading',
            progress: 0,
            message: `Network error. Retrying in ${delay / 1000}s...`,
            retryAttempt: attempt,
            maxRetries: MAX_RETRIES
          });
        },
      }
    );
  }

  /**
   * Stream import session from URL - loads chapters progressively
   * Allows users to start reading after first 10 chapters load
   */
  static async streamImportFromUrl(
    url: string,
    onProgress?: (progress: ImportProgress) => void,
    onFirstChaptersReady?: () => void | Promise<void>,
    options: ImportOptions = {}
  ): Promise<any> {
    return new Promise(async (resolve, reject) => {
      debugLog('import', 'summary', '[StreamImport] Starting streaming import from:', url);

      // Convert GitHub URLs to raw format
      let fetchUrl = normalizeImportUrl(url);

      // Convert Google Drive share links
      if (url.includes('drive.google.com/file/d/')) {
        const fileId = url.match(/\/d\/([^/]+)/)?.[1];
        if (fileId) {
          fetchUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
      }

      debugLog('import', 'summary', '[StreamImport] Fetching from:', fetchUrl);

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
        // Translation accounting — a number never travels without its
        // denominator: expected (in the payload), stored (this run), and
        // verified (read back from the database afterwards).
        let translationsExpected = 0;
        let translationsFailed = 0;
        let translationsVerified = 0;
        let translationsReused = 0;

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
            exportedVersion?: number;
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
                exportedVersion: typeof translation.version === 'number' ? translation.version : undefined,
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

          // P0.3: exports list versions NEWEST-first (getVersions sorts
          // descending) and the store renumbers by arrival order, so an
          // unsorted import REVERSED every chapter's version history
          // (newest exported became version 1). Store oldest-first so the
          // renumbering preserves the exported order. Stable sort keeps
          // relative order for inputs without version numbers.
          return inputs
            .map((input, index) => ({ input, index }))
            .sort((a, b) => {
              const av = a.input.exportedVersion;
              const bv = b.input.exportedVersion;
              if (av != null && bv != null && av !== bv) return av - bv;
              return a.index - b.index;
            })
            .map(({ input }) => input);
        };

        const jsonEqual = (left: unknown, right: unknown): boolean =>
          JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

        const isExactPackagedTranslation = (
          existing: TranslationRecord,
          imported: ReturnType<typeof buildTranslationInputs>[number]
        ): boolean => {
          return (
            existing.translatedTitle === imported.result.translatedTitle &&
            existing.translation === imported.result.translation &&
            existing.provider === imported.settings.provider &&
            existing.model === imported.settings.model &&
            (existing.customVersionLabel ?? null) === (imported.result.customVersionLabel ?? null) &&
            jsonEqual(existing.footnotes, imported.result.footnotes) &&
            jsonEqual(existing.suggestedIllustrations, imported.result.suggestedIllustrations) &&
            jsonEqual(existing.proposal, imported.result.proposal)
          );
        };

        const consumeExactPackagedTranslation = (
          available: TranslationRecord[],
          imported: ReturnType<typeof buildTranslationInputs>[number],
          expectedVersion: number | undefined = imported.exportedVersion,
          allowVersionFallback = true
        ): TranslationRecord | undefined => {
          let matchIndex = expectedVersion === undefined
            ? -1
            : available.findIndex((record) =>
                record.version === expectedVersion &&
                isExactPackagedTranslation(record, imported)
              );
          if (matchIndex === -1 && (expectedVersion === undefined || allowVersionFallback)) {
            matchIndex = available.findIndex((record) =>
              isExactPackagedTranslation(record, imported)
            );
          }
          if (matchIndex === -1) {
            return undefined;
          }
          return available.splice(matchIndex, 1)[0];
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
          if (!metadataEmitted && isGitLfsPointer(buffer)) {
            throw buildGitLfsPointerError(fetchUrl);
          }

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
          debugLog('import', 'summary', '[StreamImport] Metadata loaded:', { totalChapters });

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
            debugWarn('import', 'summary', '[StreamImport] Skipping chapter without URL:', chapter);
            return;
          }
          const identity = getScopedChapterIdentity(
            {
              stableId: chapter.stableId,
              chapterNumber: chapter.chapterNumber,
              title: chapter.title,
              content: chapter.content,
              url: chapterUrl,
              canonicalUrl: chapter.canonicalUrl || chapterUrl,
            },
            options
          );

          const translationInputs = buildTranslationInputs(chapter);

          debugLog('import', 'full', `[IMPORT] Storing chapter #${chapter.chapterNumber}: "${chapter.title}"`, {
            url: chapterUrl,
            translationsFound: translationInputs.length,
          });

          const chapterPayload: Chapter & { stableId?: string; fanTranslation?: string | null } = {
            stableId: identity.stableId,
            novelId: options.registryNovelId ?? null,
            libraryVersionId: options.registryVersionId ?? null,
            originalUrl: chapterUrl,
            title: chapter.title,
            content: chapter.content,
            nextUrl: chapter.nextUrl ?? null,
            prevUrl: chapter.prevUrl ?? null,
            chapterNumber: chapter.chapterNumber,
            fanTranslation: chapter.fanTranslation ?? null,
          };
          await ChapterOps.store(chapterPayload);
          debugLog('import', 'full', `[IMPORT] Chapter #${chapter.chapterNumber} stored to CHAPTERS`);

          let activeVersion: number | null = null;
          let chapterTranslationsStored = 0;
          const newlyStoredTranslations: Array<{
            input: ReturnType<typeof buildTranslationInputs>[number];
            version: number;
          }> = [];
          const existingTranslations = translationInputs.length > 0
            ? await TranslationOps.getVersionsByStableId(identity.stableId)
            : [];
          const reusableTranslations = [...existingTranslations];

          for (const translation of translationInputs) {
            translationsExpected++;
            const exactExisting = consumeExactPackagedTranslation(
              reusableTranslations,
              translation
            );
            if (exactExisting) {
              translationsReused++;
              translationsVerified++;
              if (translation.isActive && typeof exactExisting.version === 'number') {
                activeVersion = exactExisting.version;
              }
              debugLog(
                'import',
                'full',
                `[StreamImport] Reused exact translation for chapter #${chapter.chapterNumber} (version ${exactExisting.version ?? 'unknown'})`
              );
              continue;
            }

            // A failed translation store must not abort the whole import —
            // but it MUST be loud. A packaged translation that silently
            // vanishes here re-bills the user downstream: the auto-translate
            // mediator sees "untranslated" and fires a paid call for content
            // the session already carried (observed live 2026-07-28).
            try {
              const stored = await TranslationOps.store({
                ref: { url: identity.storageUrl, stableId: identity.stableId },
                result: translation.result,
                settings: translation.settings,
              });
              chapterTranslationsStored++;
              newlyStoredTranslations.push({
                input: translation,
                version: stored.version,
              });

              if (
                translation.isActive ||
                (translationInputs.length === 1 && activeVersion === null)
              ) {
                activeVersion = stored.version;
              }

              debugLog(
                'import', 'full',
                `[IMPORT] Translation stored for chapter #${chapter.chapterNumber}: "${translation.result.translatedTitle}" (version ${stored.version})`
              );
            } catch (translationError) {
              translationsFailed++;
              const message = translationError instanceof Error ? translationError.message : String(translationError);
              console.error(
                `[StreamImport] ❌ Translation store FAILED for chapter #${chapter.chapterNumber} (${identity.stableId}) — the packaged translation is LOST for this chapter and auto-translate may re-bill it`,
                translationError
              );
              telemetryService.capturePerformance('import:stream:translationStoreFailed', now() - streamStart, {
                stableId: identity.stableId,
                chapterNumber: chapter.chapterNumber ?? null,
                provider: translation.settings.provider ?? null,
                model: translation.settings.model ?? null,
                reason: message,
              });
            }
          }

          // Read-back verification: the observed failure mode was a store()
          // that RESOLVED while the row never became durable (chapter present,
          // translations table empty, zero errors logged). Trust nothing —
          // count what the database actually holds for this chapter.
          if (chapterTranslationsStored > 0) {
            try {
              const persisted = await TranslationOps.getVersionsByStableId(identity.stableId);
              const unverifiedPersisted = [...persisted];
              const verifiedNewCount = newlyStoredTranslations.filter(({ input, version }) =>
                Boolean(consumeExactPackagedTranslation(unverifiedPersisted, input, version, false))
              ).length;
              translationsVerified += verifiedNewCount;
              if (verifiedNewCount < chapterTranslationsStored) {
                console.error(
                  `[StreamImport] ❌ Translation VERIFY mismatch for chapter #${chapter.chapterNumber} (${identity.stableId}): stored ${chapterTranslationsStored}, verified ${verifiedNewCount}`
                );
                telemetryService.capturePerformance('import:stream:translationVerifyMissing', now() - streamStart, {
                  stableId: identity.stableId,
                  chapterNumber: chapter.chapterNumber ?? null,
                  storedCount: chapterTranslationsStored,
                  verifiedCount: verifiedNewCount,
                });
              }
            } catch (verifyError) {
              // The verify instrument must not kill the import, but its own
              // failure is a signal too (infra errors now propagate from the
              // repository instead of masquerading as "no translations").
              console.error(`[StreamImport] Translation verify read failed for ${identity.stableId}`, verifyError);
              telemetryService.capturePerformance('import:stream:translationVerifyError', now() - streamStart, {
                stableId: identity.stableId,
                reason: verifyError instanceof Error ? verifyError.message : String(verifyError),
              });
            }
          }

          if (activeVersion !== null) {
            // P0.3: translations were stored under identity.storageUrl (which
            // library imports SCOPE), but set-active used the exported
            // chapterUrl — a different keyspace, so the exported active
            // selection was silently discarded. Apply this for single-version
            // resumes too: the exact reusable row may no longer be active.
            await TranslationOps.setActiveByUrl(identity.storageUrl, activeVersion);
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
            'full',
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
            'full',
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
            debugLog('import', 'summary', '[StreamImport] First batch of chapters ready - user can start reading');
            await onFirstChaptersReady?.();
          }

          if (chaptersLoaded % 50 === 0) {
            debugLog('import', 'summary', `[StreamImport] Progress: ${chaptersLoaded}/${totalChapters || 'unknown'} chapters loaded`);
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

        debugLog('import', 'summary', '[StreamImport] Stream complete:', { chaptersLoaded, totalChapters });

        // A session smaller than the first-batch threshold never fired the
        // ready callback — and on the library path that callback is the ONLY
        // thing that moves the screen from 'reader-loading' to 'reader'. The
        // threshold compares against the NOVEL's metadata chapterCount (e.g.
        // Aithihyamala advertises 126) while the packaged session may carry a
        // single built chapter, so `1 >= min(126, 10)` never fired and the
        // user sat on "Opening Reader…" forever over a fully hydrated store.
        // Fire it at stream end whenever any chapter arrived.
        if (!firstChaptersReadyCalled && chaptersLoaded > 0) {
          firstChaptersReadyCalled = true;
          debugLog('import', 'summary', '[StreamImport] Stream ended below first-batch threshold — firing onFirstChaptersReady now', {
            chaptersLoaded,
            totalChapters,
          });
          if (!firstBatchTelemetrySent) {
            telemetryService.capturePerformance('import:stream:firstBatchReady', now() - streamStart, {
              chaptersLoaded,
              totalChapters: totalChapters || null,
              threshold: chaptersLoaded,
            });
            firstBatchTelemetrySent = true;
          }
          await onFirstChaptersReady?.();
        }

        onProgress?.({
          stage: 'complete',
          progress: 100,
          chaptersLoaded,
          totalChapters,
          message: `All ${totalChapters} chapters loaded!`,
          canStartReading: true,
        });

        // End-of-stream reconciliation: expected vs verified is the honest
        // headline. A clean run reports expected === verified; anything else
        // is data loss with a paper trail instead of a silent spinner.
        if (translationsVerified < translationsExpected) {
          console.error(
            `[StreamImport] ❌ Translation reconciliation: expected ${translationsExpected}, verified ${translationsVerified} in database (${translationsFailed} threw during store). Affected chapters were logged above.`
          );
        }
        telemetryService.capturePerformance('import:stream:complete', now() - streamStart, {
          chaptersLoaded,
          totalChapters: totalChapters || null,
          translationsExpected,
          translationsFailed,
          translationsVerified,
          translationsReused,
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

        const preHydrationState = useAppStore.getState();
        const openChapterBeforeHydration = preHydrationState.currentChapterId
          ? preHydrationState.chapters.get(preHydrationState.currentChapterId)
          : null;
        const openScopedChapterNumber =
          options.registryNovelId &&
          openChapterBeforeHydration &&
          (openChapterBeforeHydration.novelId ?? null) === options.registryNovelId &&
          (openChapterBeforeHydration.libraryVersionId ?? null) ===
            (options.registryVersionId ?? null) &&
          typeof openChapterBeforeHydration.chapterNumber === 'number' &&
          Number.isSafeInteger(openChapterBeforeHydration.chapterNumber) &&
          openChapterBeforeHydration.chapterNumber > 0
            ? openChapterBeforeHydration.chapterNumber
            : null;

        const firstChapterId = options.registryNovelId
          ? await loadNovelIntoStore(options.registryNovelId, useAppStore.setState, {
              versionId: options.registryVersionId ?? null,
            })
          : await loadAllIntoStore(useAppStore.setState);
        const nav = await SettingsOps.getKey<any>('navigation-history').catch(() => null);
        const hydratedState = useAppStore.getState();
        const remappedOpenChapterId = openScopedChapterNumber === null
          ? null
          : Array.from(hydratedState.chapters.entries()).find(([, chapter]) =>
              (chapter.novelId ?? null) === options.registryNovelId &&
              (chapter.libraryVersionId ?? null) === (options.registryVersionId ?? null) &&
              chapter.chapterNumber === openScopedChapterNumber
            )?.[0] ?? null;

        if (
          preHydrationState.currentChapterId &&
          remappedOpenChapterId &&
          remappedOpenChapterId !== preHydrationState.currentChapterId
        ) {
          debugLog(
            'import',
            'summary',
            '[StreamImport] Remapping open chapter after authoritative hydration',
            {
              previousChapterId: preHydrationState.currentChapterId,
              chapterNumber: openScopedChapterNumber,
              remappedChapterId: remappedOpenChapterId,
              novelId: options.registryNovelId,
              versionId: options.registryVersionId ?? null,
            }
          );
        }

        useAppStore.setState(state => {
          const preservedCurrentChapterId =
            state.currentChapterId && state.chapters.has(state.currentChapterId)
              ? state.currentChapterId
              : null;
          return {
            navigationHistory: Array.isArray(nav?.stableIds) ? nav.stableIds : state.navigationHistory,
            currentChapterId:
              remappedOpenChapterId ?? preservedCurrentChapterId ?? firstChapterId,
            error: null,
          };
        });

        const postHydrationState = useAppStore.getState();
        debugLog(
          'import',
          'summary',
          '[StreamImport] Post-hydration state snapshot',
          {
            hydratedChapters: useAppStore.getState().chapters.size,
            currentChapterId: postHydrationState.currentChapterId,
          }
        );

        if (!postHydrationState.currentChapterId && firstChapterId) {
          debugLog(
            'import',
            'summary',
            '[StreamImport] Selecting first chapter after hydration fallback',
            {
              firstStableId: firstChapterId,
              totalHydrated: useAppStore.getState().chapters.size,
            }
          );
          useAppStore.setState({ currentChapterId: firstChapterId });
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

      debugLog('import', 'summary', `[Import] Successfully imported from file: ${file.name}`);

      return sessionData;
    } catch (error: any) {
      console.error('[Import] Failed to import from file:', error);
      throw new Error(`Failed to import file: ${error.message}`);
    }
  }
}
