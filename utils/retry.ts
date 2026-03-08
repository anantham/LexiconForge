/**
 * Centralized retry utility with exponential backoff.
 *
 * Supports:
 *  - Configurable max attempts, initial delay, max delay
 *  - Custom retryable-error predicate
 *  - AbortSignal support
 *  - onRetry callback for logging/progress
 */

export interface RetryOptions {
  /** Maximum number of attempts (default 4 = 1 initial + 3 retries) */
  maxAttempts?: number;
  /** Initial delay in ms before first retry (default 2000) */
  initialDelay?: number;
  /** Maximum delay cap in ms (default 60000) */
  maxDelay?: number;
  /** Predicate: return true if the error should trigger a retry */
  isRetryable?: (error: unknown) => boolean;
  /** Optional abort signal */
  signal?: AbortSignal;
  /** Called before each retry with attempt index and delay */
  onRetry?: (attempt: number, delay: number, error: unknown) => void;
}

/** Default network-error predicate reusable across consumers */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  const message = (error as any)?.message?.toLowerCase?.() ?? '';
  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('429')
  );
}

/**
 * Execute an async function with retry + exponential backoff.
 *
 * @example
 * const data = await withRetry(() => fetch(url), {
 *   maxAttempts: 4,
 *   initialDelay: 2000,
 *   isRetryable: isNetworkError,
 * });
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 4,
    initialDelay = 2000,
    maxDelay = 60_000,
    isRetryable = isNetworkError,
    signal,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      const retriesLeft = attempt < maxAttempts - 1;
      if (!retriesLeft || !isRetryable(error)) {
        throw error;
      }

      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      onRetry?.(attempt + 1, delay, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but satisfy TS
  throw lastError;
}
