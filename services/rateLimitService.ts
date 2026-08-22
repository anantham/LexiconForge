/**
 * Rate limiting service to respect OpenRouter's per_request_limits
 * Prevents hitting API rate limits and ensures respectful usage
 */

import { getModelLimits } from './capabilityService';

interface RateLimitState {
  requests: number;
  resetTime: number;
  lastRequest: number;
}

export interface AcquireSlotOptions {
  /** Aborting while parked removes the caller from the queue and rejects with an AbortError. */
  signal?: AbortSignal;
}

interface QueuedRequest {
  modelId: string;
  resolve: () => void;
  reject: (error: Error) => void;
  timestamp: number;
  /** Detaches the abort listener once the entry leaves the queue by any path. */
  detachAbort?: () => void;
}

class RateLimitService {
  private limits = new Map<string, RateLimitState>();
  private queues = new Map<string, QueuedRequest[]>();
  private processing = new Set<string>();

  /**
   * Acquire a slot under the model's rate limit. CONSUMES a slot on success,
   * or parks the caller in a queue until one frees (possibly minutes).
   *
   * This was previously named canMakeRequest and returned Promise<boolean> —
   * a "check" that spent a slot as a side effect of asking and had no
   * resolve(false) on any path, so `if (!await canMakeRequest())` branches
   * were dead code. The name and signature now say what it does: backpressure
   * is the wait, not a boolean.
   *
   * Parked callers always settle: an optional AbortSignal pulls them out of
   * the queue, and clearing/losing rate-limit state rejects the remaining
   * queue instead of stranding it.
   */
  async acquireRequestSlot(modelId: string, options?: AcquireSlotOptions): Promise<void> {
    const signal = options?.signal;
    if (signal?.aborted) {
      throw this.createAbortError();
    }
    return new Promise(async (resolve, reject) => {
      try {
        const modelLimits = await getModelLimits(modelId);

        // If no limits are defined, allow the request
        if (!modelLimits) {
          resolve();
          return;
        }

        const now = Date.now();
        const state = this.limits.get(modelId) || {
          requests: 0,
          resetTime: now + 60000, // Default 1-minute window
          lastRequest: 0
        };

        // Determine rate limit from model limits
        const requestsPerMinute = this.extractRateLimit(modelLimits);
        if (!requestsPerMinute) {
          resolve();
          return;
        }

        // Reset counter if window has passed
        if (now >= state.resetTime) {
          state.requests = 0;
          state.resetTime = now + 60000;
        }

        // Check if we're under the limit
        if (state.requests < requestsPerMinute) {
          state.requests++;
          state.lastRequest = now;
          this.limits.set(modelId, state);
          resolve();
          return;
        }

        // Need to queue the request
        const queue = this.queues.get(modelId) || [];
        const entry: QueuedRequest = { modelId, resolve, reject, timestamp: now };

        if (signal) {
          const onAbort = () => {
            this.removeQueued(modelId, entry);
            reject(this.createAbortError());
          };
          entry.detachAbort = () => signal.removeEventListener('abort', onAbort);
          signal.addEventListener('abort', onAbort, { once: true });
        }

        queue.push(entry);
        this.queues.set(modelId, queue);

        // Start processing queue if not already processing
        if (!this.processing.has(modelId)) {
          void this.processQueue(modelId);
        }

      } catch (error) {
        reject(error instanceof Error ? error : new Error('Rate limit check failed'));
      }
    });
  }

  /**
   * Process queued requests for a model
   */
  private async processQueue(modelId: string): Promise<void> {
    if (this.processing.has(modelId)) return;

    this.processing.add(modelId);

    try {
      const queue = this.queues.get(modelId) || [];

      while (queue.length > 0) {
        const state = this.limits.get(modelId);
        if (!state) {
          // State vanished (e.g. clearLimits) — reject the remainder loudly
          // instead of leaving parked callers waiting forever.
          throw new Error(`Rate limit state for "${modelId}" was cleared while ${queue.length} request(s) were queued`);
        }

        const now = Date.now();

        // Reset counter if window has passed
        if (now >= state.resetTime) {
          state.requests = 0;
          state.resetTime = now + 60000;
        }

        const modelLimits = await getModelLimits(modelId);
        const requestsPerMinute = this.extractRateLimit(modelLimits || {});

        if (!requestsPerMinute || state.requests < requestsPerMinute) {
          // Can process next request
          const request = queue.shift();
          if (request) {
            state.requests++;
            state.lastRequest = now;
            this.limits.set(modelId, state);
            request.resolve();
            request.detachAbort?.();
          }
        } else {
          // Need to wait
          const waitTime = state.resetTime - now;
          await this.sleep(Math.max(1000, waitTime));
        }
      }

      // Clean up empty queue
      if (queue.length === 0) {
        this.queues.delete(modelId);
      }

    } catch (error) {
      this.failQueue(
        modelId,
        error instanceof Error ? error : new Error(`Rate limit queue processing failed: ${String(error)}`)
      );
    } finally {
      this.processing.delete(modelId);
    }
  }

  /**
   * Reject every queued request for a model and drop its queue.
   */
  private failQueue(modelId: string, error: Error): void {
    const queue = this.queues.get(modelId);
    if (!queue) return;
    this.queues.delete(modelId);
    for (const entry of queue) {
      entry.reject(error);
      entry.detachAbort?.();
    }
  }

  /**
   * Remove one entry from a model's queue (abort path).
   */
  private removeQueued(modelId: string, entry: QueuedRequest): void {
    const queue = this.queues.get(modelId);
    if (!queue) return;
    const index = queue.indexOf(entry);
    if (index !== -1) {
      queue.splice(index, 1);
    }
    if (queue.length === 0) {
      this.queues.delete(modelId);
    }
  }

  /**
   * Extract rate limit from model limits object
   */
  private extractRateLimit(limits: { [key: string]: number }): number | null {
    // Look for common rate limit keys
    const rateKeys = ['requests_per_minute', 'rpm', 'rate_limit', 'requests'];

    for (const key of rateKeys) {
      if (typeof limits[key] === 'number' && limits[key] > 0) {
        return limits[key];
      }
    }

    return null;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear rate limit state. Parked callers are rejected with a descriptive
   * error rather than stranded.
   */
  clearLimits(): void {
    const parked: QueuedRequest[] = [];
    for (const queue of this.queues.values()) {
      parked.push(...queue);
    }
    this.limits.clear();
    this.queues.clear();
    this.processing.clear();
    for (const entry of parked) {
      entry.reject(new Error('Rate limit state was cleared while the request was queued'));
      entry.detachAbort?.();
    }
  }

  /**
   * Get current rate limit status for debugging
   */
  getStatus(modelId: string): RateLimitState | null {
    return this.limits.get(modelId) || null;
  }

  private createAbortError(): Error {
    return new DOMException('Aborted while waiting for a rate limit slot', 'AbortError');
  }
}

export const rateLimitService = new RateLimitService();
