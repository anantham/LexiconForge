import type { AppSettings, HistoricalChapter, TranslationResult } from '../../types';
import { sanitizeHtml } from './HtmlSanitizer';

// Pure translation coordination logic (no I/O operations)

export interface TranslationRequest {
  title: string;
  content: string;
  settings: AppSettings;
  history: HistoricalChapter[];
  fanTranslation?: string | null;
  abortSignal?: AbortSignal;
}

export interface TranslationProvider {
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

export interface TranslationOptions {
  maxRetries?: number;
  initialDelay?: number;
}

/**
 * Pure translation orchestrator - handles retry logic and result processing
 * without performing any I/O operations directly
 */
export class Translator {
  private providers = new Map<string, TranslationProvider>();

  registerProvider(name: string, provider: TranslationProvider): void {
    this.providers.set(name, provider);
  }

  /**
   * Main translation method with retry logic and result sanitization
   */
  async translate(request: TranslationRequest, options: TranslationOptions = {}): Promise<TranslationResult> {
    const provider = this.providers.get(request.settings.provider);
    if (!provider) {
      throw new Error(`Provider not registered: ${request.settings.provider}`);
    }

    const maxRetries = options.maxRetries ?? request.settings.retryMax ?? 3;
    const initialDelay = options.initialDelay ?? request.settings.retryInitialDelayMs ?? 2000;
    
    let lastError: Error | null = null;

    // Work on a local copy of the request so we can adjust settings per-attempt without mutating caller state
    const workingRequest: TranslationRequest = { ...request, settings: { ...request.settings } };

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`[Translator] Attempt ${attempt + 1}/${maxRetries} with ${workingRequest.settings.provider} (${workingRequest.settings.model})...`);
        
        // Early abort check
        if (workingRequest.abortSignal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        const result = await provider.translate(workingRequest);
        
        // Post-process translation result
        return this.sanitizeResult(result);

      } catch (error: any) {
        lastError = error;
        
        // Handle abort errors first
        if (error.name === 'AbortError' || workingRequest.abortSignal?.aborted) {
          console.log(`[Translator] Translation aborted for ${workingRequest.settings.provider}`);
          throw new DOMException('Translation was aborted by user', 'AbortError');
        }

        // Check if this is a JSON parsing error - don't retry these to avoid wasting API costs
        const isJsonParsingError = error.message?.includes('Could not parse translation') || 
                                 error.message?.includes('JSON Syntax Error') ||
                                 error.message?.includes('malformed response') ||
                                 error.message?.includes('Failed to parse JSON response');
        
        if (isJsonParsingError) {
          console.error(`[Translator] JSON parsing error detected - failing immediately to avoid wasting API costs:`, error.message);
          throw error;
        }

        // Handle length-cap (model hit max tokens) by doubling maxOutputTokens for next attempt, if any
        const isLengthCap = typeof error.message === 'string' && (
          error.message.includes('length_cap') ||
          error.message.includes('MAX_TOKENS') ||
          error.message.includes('finish reason') && error.message.includes('length')
        );
        if (isLengthCap && attempt < maxRetries - 1) {
          const currentMax = workingRequest.settings.maxOutputTokens ?? 16384;
          const nextMax = Math.min(currentMax * 2, 32768);
          if (nextMax > currentMax) {
            console.warn(`[Translator] Hit model token cap. Increasing maxOutputTokens from ${currentMax} to ${nextMax} and retrying...`);
            workingRequest.settings = { ...workingRequest.settings, maxOutputTokens: nextMax } as AppSettings;
            continue;
          }
        }

        // Handle rate limiting
        const isRateLimitError = error.message?.includes('429') || error.status === 429;
        if (isRateLimitError && attempt < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, attempt);
          console.warn(`[Translator] Rate limit hit for ${workingRequest.settings.provider}. Retrying in ${delay / 1000}s...`);
          await this.delay(delay);
          continue;
        }

        // If not retryable or max retries reached, throw
        if (attempt === maxRetries - 1) {
          break;
        }
      }
    }

    // All retries failed
    console.error(`[Translator] All ${maxRetries} attempts failed for ${request.settings.provider}:`, lastError);
    throw lastError || new Error('Translation failed after all retries');
  }

  /**
   * Sanitizes and validates translation results
   */
  private sanitizeResult(result: TranslationResult): TranslationResult {
    return {
      ...result,
      translatedTitle: result.translatedTitle?.trim() || '',
      translation: sanitizeHtml(result.translation || ''),
      // Preserve other fields as-is
      illustrations: result.illustrations || [],
      amendments: result.amendments || [],
      costUsd: result.costUsd,
      tokensUsed: result.tokensUsed,
      model: result.model,
      provider: result.provider,
      translationSettings: result.translationSettings
    };
  }

  /**
   * Promise-based delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get list of registered providers
   */
  getRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

// Singleton instance
export const translator = new Translator();
