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

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`[Translator] Attempt ${attempt + 1}/${maxRetries} with ${request.settings.provider} (${request.settings.model})...`);
        
        // Early abort check
        if (request.abortSignal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        const result = await provider.translate(request);
        
        // Post-process translation result
        return this.sanitizeResult(result);

      } catch (error: any) {
        lastError = error;
        
        // Handle rate limiting
        const isRateLimitError = error.message?.includes('429') || error.status === 429;
        if (isRateLimitError && attempt < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, attempt);
          console.warn(`[Translator] Rate limit hit for ${request.settings.provider}. Retrying in ${delay / 1000}s...`);
          await this.delay(delay);
          continue;
        }

        // Handle abort errors
        if (error.name === 'AbortError' || request.abortSignal?.aborted) {
          console.log(`[Translator] Translation aborted for ${request.settings.provider}`);
          throw new DOMException('Translation was aborted by user', 'AbortError');
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