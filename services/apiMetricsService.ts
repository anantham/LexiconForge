/**
 * Centralized API Metrics Tracking Service
 *
 * Tracks ALL API calls across the application:
 * - Translation (OpenRouter, Gemini, DeepSeek, Claude, OpenAI)
 * - Image Generation (Imagen, Gemini, OpenRouter, PiAPI)
 * - Audio Generation (PiAPI)
 * - Diff Analysis (OpenRouter/Gemini)
 *
 * Stores metrics in IndexedDB for:
 * - Session-level aggregation
 * - Lifetime cost tracking
 * - Export to CSV for accounting
 */

export type ApiCallType = 'translation' | 'image' | 'audio' | 'diff_analysis';

export interface ApiCallMetric {
  id: string; // UUID
  timestamp: string; // ISO timestamp
  apiType: ApiCallType;
  provider: string; // e.g., "OpenRouter", "Gemini", "PiAPI"
  model: string; // e.g., "google/gemini-2.5-flash", "imagen-4.0"
  costUsd: number; // Cost in USD
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  duration?: number; // For audio - duration in seconds
  imageCount?: number; // For image generation
  chapterId?: string; // Associated chapter (if applicable)
  success: boolean; // Whether the API call succeeded
  errorMessage?: string; // Error message if failed
}

export interface ApiMetricsSummary {
  // Session-level (since page load)
  session: {
    totalCost: number;
    totalCalls: number;
    byType: Record<ApiCallType, { cost: number; calls: number }>;
    byProvider: Record<string, { cost: number; calls: number }>;
  };
  // Lifetime (from IndexedDB)
  lifetime: {
    totalCost: number;
    totalCalls: number;
    byType: Record<ApiCallType, { cost: number; calls: number }>;
    byProvider: Record<string, { cost: number; calls: number }>;
  };
}

class ApiMetricsService {
  private dbName = 'lexicon-forge-db';
  private storeName = 'api_metrics';
  private sessionMetrics: ApiCallMetric[] = [];

  /**
   * Initialize IndexedDB store for metrics
   */
  async initialize(): Promise<void> {
    // IndexedDB is already initialized by the bootstrap service
    // We just need to ensure the store exists
    console.log('[ApiMetrics] Service initialized');
  }

  /**
   * Record a new API call metric
   */
  async recordMetric(metric: Omit<ApiCallMetric, 'id' | 'timestamp'>): Promise<void> {
    const fullMetric: ApiCallMetric = {
      ...metric,
      id: this.generateUUID(),
      timestamp: new Date().toISOString(),
    };

    // Add to session cache
    this.sessionMetrics.push(fullMetric);

    // Persist to IndexedDB
    try {
      const db = await this.openDatabase();
      const tx = db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.add(fullMetric);

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      console.log(`[ApiMetrics] Recorded ${metric.apiType} call: $${metric.costUsd.toFixed(4)} (${metric.provider}/${metric.model})`);
    } catch (error) {
      console.error('[ApiMetrics] Failed to persist metric:', error);
    }
  }

  /**
   * Get session summary (since page load)
   */
  getSessionSummary(): ApiMetricsSummary['session'] {
    return this.aggregateMetrics(this.sessionMetrics);
  }

  /**
   * Get lifetime summary (all metrics from IndexedDB)
   */
  async getLifetimeSummary(): Promise<ApiMetricsSummary['lifetime']> {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      const allMetrics = await new Promise<ApiCallMetric[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });

      return this.aggregateMetrics(allMetrics);
    } catch (error) {
      console.error('[ApiMetrics] Failed to get lifetime summary:', error);
      return this.getEmptySummary();
    }
  }

  /**
   * Get complete summary (session + lifetime)
   */
  async getCompleteSummary(): Promise<ApiMetricsSummary> {
    const session = this.getSessionSummary();
    const lifetime = await this.getLifetimeSummary();
    return { session, lifetime };
  }

  /**
   * Export metrics to CSV
   */
  async exportToCSV(startDate?: string, endDate?: string): Promise<string> {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      const allMetrics = await new Promise<ApiCallMetric[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });

      // Filter by date range if provided
      let filteredMetrics = allMetrics;
      if (startDate) {
        filteredMetrics = filteredMetrics.filter(m => m.timestamp >= startDate);
      }
      if (endDate) {
        filteredMetrics = filteredMetrics.filter(m => m.timestamp <= endDate);
      }

      // Generate CSV
      const headers = ['Timestamp', 'Type', 'Provider', 'Model', 'Cost (USD)', 'Tokens', 'Success', 'Chapter ID', 'Error'];
      const rows = filteredMetrics.map(m => [
        m.timestamp,
        m.apiType,
        m.provider,
        m.model,
        m.costUsd.toFixed(4),
        m.tokens ? m.tokens.total.toString() : 'N/A',
        m.success ? 'Yes' : 'No',
        m.chapterId || 'N/A',
        m.errorMessage || 'N/A',
      ]);

      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      return csv;
    } catch (error) {
      console.error('[ApiMetrics] Failed to export CSV:', error);
      throw error;
    }
  }

  /**
   * Clear all metrics (for testing or reset)
   */
  async clearAllMetrics(): Promise<void> {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.clear();

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      this.sessionMetrics = [];
      console.log('[ApiMetrics] All metrics cleared');
    } catch (error) {
      console.error('[ApiMetrics] Failed to clear metrics:', error);
    }
  }

  // Private helper methods

  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create api_metrics store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('apiType', 'apiType', { unique: false });
          store.createIndex('provider', 'provider', { unique: false });
          store.createIndex('chapterId', 'chapterId', { unique: false });
        }
      };
    });
  }

  private aggregateMetrics(metrics: ApiCallMetric[]): ApiMetricsSummary['session'] {
    const summary: ApiMetricsSummary['session'] = {
      totalCost: 0,
      totalCalls: metrics.length,
      byType: {
        translation: { cost: 0, calls: 0 },
        image: { cost: 0, calls: 0 },
        audio: { cost: 0, calls: 0 },
        diff_analysis: { cost: 0, calls: 0 },
      },
      byProvider: {},
    };

    for (const metric of metrics) {
      summary.totalCost += metric.costUsd;

      // Aggregate by type
      if (summary.byType[metric.apiType]) {
        summary.byType[metric.apiType].cost += metric.costUsd;
        summary.byType[metric.apiType].calls += 1;
      }

      // Aggregate by provider
      if (!summary.byProvider[metric.provider]) {
        summary.byProvider[metric.provider] = { cost: 0, calls: 0 };
      }
      summary.byProvider[metric.provider].cost += metric.costUsd;
      summary.byProvider[metric.provider].calls += 1;
    }

    return summary;
  }

  private getEmptySummary(): ApiMetricsSummary['session'] {
    return {
      totalCost: 0,
      totalCalls: 0,
      byType: {
        translation: { cost: 0, calls: 0 },
        image: { cost: 0, calls: 0 },
        audio: { cost: 0, calls: 0 },
        diff_analysis: { cost: 0, calls: 0 },
      },
      byProvider: {},
    };
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Calculate average tokens per image for a specific model from historical data.
   * Useful for estimating per-image costs when only per-token pricing is available.
   * @param modelId The model ID (e.g., "openrouter/openai/gpt-5-image")
   * @returns Average tokens per image, or null if no historical data
   */
  async getAverageTokensPerImage(modelId: string): Promise<{
    avgTotal: number;
    avgPrompt: number;
    avgCompletion: number;
    sampleCount: number;
  } | null> {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      const allMetrics = await new Promise<ApiCallMetric[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });

      // Filter to image generation calls for this model that have token data
      const imageMetrics = allMetrics.filter(m =>
        m.apiType === 'image' &&
        m.model === modelId &&
        m.tokens &&
        m.tokens.total > 0 &&
        m.success
      );

      if (imageMetrics.length === 0) {
        console.log(`[ApiMetrics] No historical token data for image model: ${modelId}`);
        return null;
      }

      // Calculate averages
      const totals = imageMetrics.reduce(
        (acc, m) => {
          acc.total += m.tokens!.total;
          acc.prompt += m.tokens!.prompt;
          acc.completion += m.tokens!.completion;
          return acc;
        },
        { total: 0, prompt: 0, completion: 0 }
      );

      const result = {
        avgTotal: totals.total / imageMetrics.length,
        avgPrompt: totals.prompt / imageMetrics.length,
        avgCompletion: totals.completion / imageMetrics.length,
        sampleCount: imageMetrics.length,
      };

      console.log(`[ApiMetrics] Token averages for ${modelId}:`, result);
      return result;
    } catch (error) {
      console.error('[ApiMetrics] Failed to get average tokens per image:', error);
      return null;
    }
  }

  /**
   * Get all image generation models that have historical token data.
   * Useful for building estimated pricing for OpenRouter models.
   */
  async getImageModelsWithTokenData(): Promise<string[]> {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      const allMetrics = await new Promise<ApiCallMetric[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });

      // Get unique models with token data
      const modelsWithTokens = new Set<string>();
      for (const m of allMetrics) {
        if (m.apiType === 'image' && m.tokens && m.tokens.total > 0 && m.success) {
          modelsWithTokens.add(m.model);
        }
      }

      return Array.from(modelsWithTokens);
    } catch (error) {
      console.error('[ApiMetrics] Failed to get image models with token data:', error);
      return [];
    }
  }
}

// Singleton instance
export const apiMetricsService = new ApiMetricsService();

// Initialize on module load
apiMetricsService.initialize().catch(console.error);
