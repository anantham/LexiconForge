import type {
  AppSettings,
  HistoricalChapter,
  TranslationResult,
  Footnote,
  SuggestedIllustration,
  TranslationProvider as TranslationProviderName,
} from '../../types';
import { sanitizeHtml } from './HtmlSanitizer';
import { debugLog, debugWarn } from '../../utils/debug';
import { validateAndFixIllustrations, validateAndFixFootnotes } from '../ai/responseValidators';
import { ILLUSTRATION_MARKER_PATTERN } from '../ai/illustrationMarkers';

// Pure translation coordination logic (no I/O operations)

export interface TranslationRequest {
  title: string;
  content: string;
  settings: AppSettings;
  history: HistoricalChapter[];
  fanTranslation?: string | null;
  abortSignal?: AbortSignal;
  chapterId?: string;
}

export interface TranslationProvider {
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

export interface TranslationOptions {
  maxRetries?: number;
  initialDelay?: number;
  timeoutMs?: number;   // Per-attempt timeout (default: 90s)
}

/** `3` and `[3]` both occur in the wild; the text always carries the bracketed form. */
const normalizeFootnoteMarker = (marker: string): string =>
  marker.startsWith('[') ? marker : `[${marker.replace(/[[\]]/g, '')}]`;

/**
 * Rewrite every marker in `text` according to `rename`, in a single pass. A sequential
 * replace would cascade: renaming [1]->[2] and then [2]->[3] would move the same marker twice.
 */
const renumberMarkers = (text: string, rename: Map<string, string>): string => {
  if (rename.size === 0) return text;
  const anyMarker = new RegExp(`${ILLUSTRATION_MARKER_PATTERN}|\\[\\d+\\]`, 'g');
  return text.replace(anyMarker, token => rename.get(token) ?? token);
};

/**
 * Pure translation orchestrator - handles retry logic, chunked fallback,
 * and result processing without performing any I/O operations directly
 */
export class Translator {
  private providers = new Map<string, TranslationProvider>();

  registerProvider(name: string, provider: TranslationProvider): void {
    this.providers.set(name, provider);
  }

  /**
   * Main translation method with retry logic and result sanitization.
   * On length_cap failures after retries exhaust, falls back to chunked translation.
   */
  async translate(request: TranslationRequest, options: TranslationOptions = {}): Promise<TranslationResult> {
    const provider = this.providers.get(request.settings.provider);
    if (!provider) {
      throw new Error(`Provider not registered: ${request.settings.provider}`);
    }

    try {
      return await this.translateSingle(provider, request, options);
    } catch (error: any) {
      // On length_cap, fall back to chunked translation
      const isLengthCap = typeof error.message === 'string' && (
        error.message.includes('length_cap') ||
        error.message.includes('MAX_TOKENS') ||
        (error.message.includes('finish reason') && error.message.includes('length'))
      );

      if (isLengthCap) {
        debugWarn('translation', 'summary', '[Translator] Full chapter hit token limit — falling back to chunked translation');
        return await this.translateChunked(provider, request, options);
      }

      throw error;
    }
  }

  /**
   * Translate the full content in a single API call with retry logic.
   */
  private async translateSingle(
    provider: TranslationProvider,
    request: TranslationRequest,
    options: TranslationOptions
  ): Promise<TranslationResult> {
    const maxRetries = options.maxRetries ?? request.settings.retryMax ?? 3;
    const initialDelay = options.initialDelay ?? request.settings.retryInitialDelayMs ?? 2000;
    const timeoutMs = options.timeoutMs ?? 90_000;

    let lastError: Error | null = null;
    const workingRequest: TranslationRequest = { ...request, settings: { ...request.settings } };

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        debugLog('translation', 'full', `[Translator] Attempt ${attempt + 1}/${maxRetries} with ${workingRequest.settings.provider} (${workingRequest.settings.model})...`);

        if (workingRequest.abortSignal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        // A per-attempt controller, so a timed-out attempt actually CANCELS the provider call.
        // Racing a timeout against a still-running request only abandoned the promise: the
        // original call kept going — and kept billing — while the retry fired a second paid
        // request for the same chapter. The user's own signal is chained into it so a manual
        // abort still cancels the attempt.
        const attemptController = new AbortController();
        const userSignal = workingRequest.abortSignal;
        const abortAttempt = () => attemptController.abort();
        userSignal?.addEventListener('abort', abortAttempt, { once: true });

        const attemptRequest: TranslationRequest = {
          ...workingRequest,
          abortSignal: attemptController.signal,
        };

        const { promise: timeoutPromise, cancel: cancelTimeout } = this.timeout(timeoutMs, userSignal);
        try {
          const providerPromise = provider.translate(attemptRequest);
          // The race abandons this promise on timeout; once we abort the attempt it rejects with
          // an AbortError that nothing is awaiting. Handle it here so it isn't an unhandled
          // rejection. The race still sees the original rejection.
          providerPromise.catch(() => {});

          const result = await Promise.race([providerPromise, timeoutPromise]);
          return this.sanitizeResult(result, workingRequest.settings);
        } finally {
          cancelTimeout();
          // Cancels the in-flight call on timeout or error. A no-op when the call already settled.
          attemptController.abort();
          userSignal?.removeEventListener('abort', abortAttempt);
        }

      } catch (error: any) {
        lastError = error;

        if (error.name === 'AbortError' || workingRequest.abortSignal?.aborted) {
          debugLog('translation', 'summary', `[Translator] Translation aborted for ${workingRequest.settings.provider}`);
          throw new DOMException('Translation was aborted by user', 'AbortError');
        }

        const isJsonParsingError = error.message?.includes('Could not parse translation') ||
                                   error.message?.includes('JSON Syntax Error') ||
                                   error.message?.includes('malformed response') ||
                                   error.message?.includes('Failed to parse JSON response');

        if (isJsonParsingError) {
          debugWarn('translation', 'summary', `[Translator] JSON parsing error — failing immediately:`, error.message);
          throw error;
        }

        // Handle length-cap by doubling maxOutputTokens for next attempt
        const isLengthCap = typeof error.message === 'string' && (
          error.message.includes('length_cap') ||
          error.message.includes('MAX_TOKENS') ||
          (error.message.includes('finish reason') && error.message.includes('length'))
        );
        if (isLengthCap && attempt < maxRetries - 1) {
          const currentMax = workingRequest.settings.maxOutputTokens ?? 16384;
          const nextMax = Math.min(currentMax * 2, 32768);
          if (nextMax > currentMax) {
            debugWarn('translation', 'summary', `[Translator] Hit model token cap. Increasing maxOutputTokens from ${currentMax} to ${nextMax} and retrying...`);
            workingRequest.settings = { ...workingRequest.settings, maxOutputTokens: nextMax } as AppSettings;
            continue;
          }
        }

        const isTimeout = error.message?.includes('timed out');
        const isRateLimitError = error.message?.includes('429') || error.status === 429;

        if (attempt < maxRetries - 1) {
          // All other errors (including timeout and 429) get exponential backoff
          const delay = initialDelay * Math.pow(2, attempt);
          const errorType = isTimeout ? 'Timeout' : isRateLimitError ? 'Rate limit' : 'Error';
          debugWarn('translation', 'summary', `[Translator] ${errorType} hit for ${workingRequest.settings.provider}. Retrying attempt ${attempt + 2}/${maxRetries} in ${delay / 1000}s...`);
          await this.delay(delay);
          continue;
        }

        if (attempt === maxRetries - 1) {
          break;
        }
      }
    }

    debugWarn('translation', 'summary', `[Translator] All ${maxRetries} attempts failed for ${request.settings.provider}:`, lastError?.message);
    throw lastError || new Error('Translation failed after all retries');
  }

  /**
   * Split the chapter into chunks and translate each sequentially.
   * Chunk 1's translation is passed as context to chunk 2, etc.
   * Max 3 chunks — beyond that, quality degrades too much.
   */
  private async translateChunked(
    provider: TranslationProvider,
    request: TranslationRequest,
    options: TranslationOptions
  ): Promise<TranslationResult> {
    const chunks = this.splitContent(request.content);
    debugLog('translation', 'summary', `[Translator] Chunked fallback: splitting chapter into ${chunks.length} parts`);

    const chunkResults: TranslationResult[] = [];
    let previousTranslation = '';

    for (let i = 0; i < chunks.length; i++) {
      if (request.abortSignal?.aborted) {
        throw new DOMException('Translation was aborted by user', 'AbortError');
      }

      debugLog('translation', 'summary', `[Translator] Translating chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`);

      // Build chunk request — include previous chunk's translation as context
      const chunkContent = previousTranslation
        ? `[CONTEXT FROM PREVIOUS SECTION — do not re-translate this, use for continuity only]\n${previousTranslation}\n[END CONTEXT]\n\n[TRANSLATE THIS SECTION]\n${chunks[i]}`
        : chunks[i];

      const chunkRequest: TranslationRequest = {
        ...request,
        content: chunkContent,
        title: i === 0 ? request.title : `(continued, part ${i + 1}/${chunks.length})`,
      };

      // Use translateSingle with reduced retries for chunks
      const result = await this.translateSingle(provider, chunkRequest, {
        ...options,
        maxRetries: 2,
      });

      chunkResults.push(result);
      previousTranslation = result.translation;
    }

    return this.mergeChunkResults(chunkResults, chunks.length, request.settings);
  }

  /**
   * Split content into roughly equal chunks at paragraph boundaries.
   * Tries 2 chunks first, then 3 if individual chunks are still very large.
   */
  private splitContent(content: string): string[] {
    // Split on double line breaks (paragraph boundaries)
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());

    if (paragraphs.length <= 1) {
      // Can't split meaningfully — just split in half by character
      const mid = Math.floor(content.length / 2);
      const breakPoint = content.indexOf('\n', mid);
      const splitAt = breakPoint > mid && breakPoint < mid + 200 ? breakPoint : mid;
      return [content.slice(0, splitAt), content.slice(splitAt)];
    }

    // Try 2 chunks first
    const midIdx = Math.floor(paragraphs.length / 2);
    const chunk1 = paragraphs.slice(0, midIdx).join('\n\n');
    const chunk2 = paragraphs.slice(midIdx).join('\n\n');

    // If either chunk is still very long (>15k chars), try 3 chunks
    if (chunk1.length > 15000 || chunk2.length > 15000) {
      const third = Math.floor(paragraphs.length / 3);
      const twoThirds = Math.floor((paragraphs.length * 2) / 3);
      return [
        paragraphs.slice(0, third).join('\n\n'),
        paragraphs.slice(third, twoThirds).join('\n\n'),
        paragraphs.slice(twoThirds).join('\n\n'),
      ];
    }

    return [chunk1, chunk2];
  }

  /**
   * Merge results from chunked translation into a single TranslationResult.
   */
  private mergeChunkResults(results: TranslationResult[], chunkCount: number, settings: AppSettings): TranslationResult {
    const first = results[0];
    const mergedProvider =
      first.usageMetrics?.provider ??
      (first.provider as TranslationProviderName | undefined) ??
      (first.translationSettings?.provider as TranslationProviderName | undefined);

    if (!mergedProvider) {
      throw new Error('Chunked translation result missing provider metadata.');
    }

    // Each chunk is translated independently, so every chunk's markers restart at 1. Renumber
    // them onto a single global sequence — in the chunk TEXT as well as in the metadata, or the
    // two disagree and an illustration keyed to a marker absent from the text never renders.
    const mergedFootnotes: Footnote[] = [];
    const mergedIllustrations: SuggestedIllustration[] = [];
    const renumberedChunks: string[] = [];
    let footnoteOffset = 0;
    let illustrationOffset = 0;

    for (const result of results) {
      const rename = new Map<string, string>();

      for (const fn of (result.footnotes || [])) {
        footnoteOffset++;
        const to = `[${footnoteOffset}]`;
        rename.set(normalizeFootnoteMarker(String(fn.marker ?? '')), to);
        mergedFootnotes.push({ ...fn, marker: to });
      }

      for (const ill of (result.suggestedIllustrations || [])) {
        illustrationOffset++;
        const to = `[ILLUSTRATION-${illustrationOffset}]`;
        rename.set(ill.placementMarker, to);
        mergedIllustrations.push({ ...ill, placementMarker: to });
      }

      renumberedChunks.push(renumberMarkers(result.translation || '', rename));
    }

    // Stitch translations with a scene break between chunks
    const mergedTranslation = renumberedChunks.join('<br><br>');

    // Sum usage metrics
    const totalUsage = {
      promptTokens: results.reduce((s, r) => s + (r.usageMetrics?.promptTokens || 0), 0),
      completionTokens: results.reduce((s, r) => s + (r.usageMetrics?.completionTokens || 0), 0),
      totalTokens: results.reduce((s, r) => s + (r.usageMetrics?.totalTokens || 0), 0),
      estimatedCost: results.reduce((s, r) => s + (r.usageMetrics?.estimatedCost || 0), 0),
      requestTime: results.reduce((s, r) => s + (r.usageMetrics?.requestTime || 0), 0),
      provider: mergedProvider,
      model: first.usageMetrics?.model || 'unknown',
    };

    // Take the first proposal (if any) and first amendment
    const proposal = results.find(r => r.proposal)?.proposal || null;
    const amendments = results.flatMap(r => r.amendments || []);

    const note = `[Translated in ${chunkCount} parts due to model output limit]`;

    return this.sanitizeResult({
      translatedTitle: first.translatedTitle || '',
      translation: mergedTranslation,
      proposal,
      footnotes: mergedFootnotes,
      suggestedIllustrations: mergedIllustrations,
      usageMetrics: totalUsage,
      illustrations: results.flatMap(r => r.illustrations || []),
      amendments,
      costUsd: results.reduce((s, r) => s + (r.costUsd || 0), 0),
      tokensUsed: {
        promptTokens: totalUsage.promptTokens,
        completionTokens: totalUsage.completionTokens,
        totalTokens: totalUsage.totalTokens,
      },
      model: first.model,
      provider: first.provider,
      translationSettings: first.translationSettings,
      // Append a note about chunking to the title
      customVersionLabel: note,
    }, settings);
  }

  /**
   * Sanitizes and validates translation results.
   *
   * This is the one place illustration/footnote markers are reconciled. Adapters return the
   * model's raw output; every provider funnels through here, so provider choice cannot change
   * validation behavior. (It used to: Claude reconciled markers with its own forked copy, while
   * OpenAI and Gemini did no reconciliation at all and shipped dangling markers.)
   *
   * Reconciliation runs before sanitizeHtml, on the model's own text, matching the ordering the
   * validators were written against. A validation throw is caught by the retry loop in
   * translateSingle, which is the intended recovery: ask the model again.
   */
  private sanitizeResult(result: TranslationResult, settings: AppSettings): TranslationResult {
    // A provider that returns no text has failed, whatever it reports. Accepting it persists a
    // BLANK chapter as a completed translation: the reader sees an empty chapter, and because the
    // app now believes the chapter is translated, nothing ever retries it. Throw instead — the
    // retry loop in translateSingle will ask the model again.
    //
    // This has to run BEFORE reconciliation: if the model also returned illustrations, the
    // auto-recovery below would append their markers to the empty string and it would no longer
    // look empty. (GeminiAdapter coerces a missing `translation` field to '' and returns success.)
    if (!result.translation?.trim()) {
      throw new Error('Provider returned an empty translation.');
    }

    const { translation: illustrationsFixed, suggestedIllustrations } = validateAndFixIllustrations(
      result.translation,
      result.suggestedIllustrations,
    );

    const { translation: reconciled, footnotes } = validateAndFixFootnotes(
      illustrationsFixed,
      result.footnotes,
      settings.footnoteStrictMode ?? 'append_missing',
    );

    return {
      ...result,
      translatedTitle: result.translatedTitle?.trim() || '',
      translation: sanitizeHtml(reconciled),
      footnotes,
      suggestedIllustrations,
      illustrations: result.illustrations || [],
      amendments: result.amendments || [],
      costUsd: result.costUsd,
      tokensUsed: result.tokensUsed,
      model: result.model,
      provider: result.provider,
      translationSettings: result.translationSettings
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private timeout(ms: number, abortSignal?: AbortSignal): { promise: Promise<never>; cancel: () => void } {
    let timer: ReturnType<typeof setTimeout>;
    let onAbort: (() => void) | null = null;

    const promise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Translation timed out after ${Math.round(ms / 1000)}s. The model may be overloaded — try again or switch models.`)),
        ms
      );

      // On abort this used to only clear the timer. That disarms the one thing that could still
      // settle the race, so a provider which ignores its abort signal (claudeService never reads
      // one) left the user's Cancel hanging forever — the request neither finished nor timed out.
      // Reject instead, and let translateSingle turn it into the user-abort error.
      onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      abortSignal?.addEventListener('abort', onAbort, { once: true });
    });

    // The race abandons this promise whenever the provider wins; a later abort would then reject
    // it with nothing awaiting. Keep that from surfacing as an unhandled rejection.
    promise.catch(() => {});

    const cancel = () => {
      clearTimeout(timer!);
      if (onAbort) abortSignal?.removeEventListener('abort', onAbort);
    };
    return { promise, cancel };
  }

  getRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

// Singleton instance
export const translator = new Translator();
