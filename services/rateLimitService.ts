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

interface QueuedRequest {
  modelId: string;
  resolve: (value: boolean) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

class RateLimitService {
  private limits = new Map<string, RateLimitState>();
  private queues = new Map<string, QueuedRequest[]>();
  private processing = new Set<string>();

  /**
   * Check if a request can proceed or needs to wait
   */
  async canMakeRequest(modelId: string): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      try {
        const modelLimits = await getModelLimits(modelId);
        
        // If no limits are defined, allow the request
        if (!modelLimits) {
          resolve(true);
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
          resolve(true);
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
          resolve(true);
          return;
        }

        // Need to queue the request
        const queue = this.queues.get(modelId) || [];
        queue.push({ modelId, resolve, reject, timestamp: now });
        this.queues.set(modelId, queue);

        // Start processing queue if not already processing
        if (!this.processing.has(modelId)) {
          this.processQueue(modelId);
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
        if (!state) break;

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
            request.resolve(true);
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
      
    } finally {
      this.processing.delete(modelId);
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
   * Clear rate limit state (useful for testing)
   */
  clearLimits(): void {
    this.limits.clear();
    this.queues.clear();
    this.processing.clear();
  }

  /**
   * Get current rate limit status for debugging
   */
  getStatus(modelId: string): RateLimitState | null {
    return this.limits.get(modelId) || null;
  }
}

export const rateLimitService = new RateLimitService();