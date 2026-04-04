/**
 * Telemetry Service - Lightweight error and memory monitoring
 *
 * Captures unhandled errors, memory pressure warnings, and custom events
 * for debugging without external dependencies.
 */

type TelemetryPayload = Record<string, unknown>;

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface StoreChapter {
  translationResult?: {
    suggestedIllustrations?: unknown[];
  } & Record<string, unknown>;
  fanTranslation?: string | null;
  [key: string]: unknown;
}

type ChapterCollection = Map<string, StoreChapter> | Record<string, StoreChapter>;

interface GeneratedImageEntry {
  data?: string;
  [key: string]: unknown;
}

interface StoreState {
  chapters?: ChapterCollection;
  generatedImages?: Record<string, GeneratedImageEntry>;
  translationHistory?: Record<string, unknown>;
}

interface WindowAugments {
  __APP_STORE__?: {
    getState?: () => StoreState;
  };
  exportTelemetry?: () => string;
  telemetrySummary?: () => unknown;
}

interface ImagesBreakdown {
  total: number;
  base64Stored: number;
  base64DataSizeMB: string;
  avgImageSizeKB: string | number;
}

interface ChaptersBreakdown {
  total: number;
  withTranslations: number;
  withImages: number;
  translationDataSizeKB: string;
}

interface MemoryBreakdown {
  chapters: ChaptersBreakdown;
  images: ImagesBreakdown;
  translationHistory: {
    entriesCount: number;
  };
}

type MemoryBreakdownResult = MemoryBreakdown | { error: string };

const getPerformanceMemory = (): PerformanceMemory | undefined => {
  if (typeof performance === 'undefined') return undefined;
  const perf = performance as Performance & { memory?: PerformanceMemory };
  return perf.memory;
};

const toRecord = <T>(collection: Map<string, T> | Record<string, T> | undefined): Record<string, T> | undefined => {
  if (!collection) return undefined;
  if (collection instanceof Map) {
    return Object.fromEntries(collection.entries());
  }
  return collection;
};

declare global {
  interface Window extends WindowAugments {}
}

interface TelemetryEvent {
  type: 'error' | 'warning' | 'memory' | 'performance';
  category: string;
  message: string;
  data?: TelemetryPayload;
  timestamp: number;
  sessionId: string;
}

interface MemoryStats {
  usedMB: string;
  limitMB: string;
  percentUsed: string;
}

class TelemetryService {
  private sessionId: string;
  private events: TelemetryEvent[] = [];
  private maxEvents = 500;
  private isInitialized = false;
  private memoryCheckInterval?: number;
  private errorHandler?: (event: ErrorEvent) => void;
  private rejectionHandler?: (event: PromiseRejectionEvent) => void;

  constructor() {
    this.sessionId = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  /**
   * Initialize global error handlers
   * Safe to call multiple times (guards against hot-reload)
   */
  initialize() {
    if (this.isInitialized) {
      console.log('[Telemetry] Already initialized, skipping duplicate setup');
      return;
    }

    this.setupGlobalHandlers();
    this.setupMemoryMonitoring();
    this.isInitialized = true;

    console.log(`[Telemetry] Initialized (session: ${this.sessionId.substring(0, 8)})`);
  }

  private setupGlobalHandlers() {
    this.errorHandler = (event: ErrorEvent) => {
      const context: TelemetryPayload = {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      };
      this.captureError('uncaught', event.error ?? event.message, context);
    };

    this.rejectionHandler = (event: PromiseRejectionEvent) => {
      this.captureError('unhandledRejection', event.reason, {
        promise: String(event.promise),
      });
    };

    window.addEventListener('error', this.errorHandler);
    window.addEventListener('unhandledrejection', this.rejectionHandler);
  }

  private setupMemoryMonitoring() {
    const perfMemory = getPerformanceMemory();

    if (!perfMemory) {
      console.log('[Telemetry] performance.memory not available (not Chromium)');
      return;
    }

    // Check memory every 30 seconds
    this.memoryCheckInterval = window.setInterval(() => {
      try {
        const stats = this.getMemoryStats();
        const percentUsed = parseFloat(stats.percentUsed);

        if (percentUsed > 90) {
          // Get detailed memory breakdown
          const breakdown = this.getMemoryBreakdown();

          this.captureWarning('memory', 'High memory usage detected', {
            ...stats,
            threshold: '90%',
            breakdown,
            recommendations: this.getMemoryRecommendations(breakdown)
          });
        }
      } catch (error) {
        console.warn('[Telemetry] Memory check failed:', error);
      }
    }, 30000);
  }

  /**
   * Get detailed breakdown of what's consuming memory
   */
  private getMemoryBreakdown(): MemoryBreakdownResult {
    if (typeof window === 'undefined') {
      return { error: 'Window not available' };
    }

    try {
      const storeState = (window as WindowAugments).__APP_STORE__?.getState?.();
      if (!storeState) {
        return { error: 'Store not accessible' };
      }

      const chapters = storeState.chapters;
      const generatedImages = storeState.generatedImages ?? {};
      const translationHistory = storeState.translationHistory ?? {};

      let chapterCount = 0;
      let chaptersWithTranslations = 0;
      let chaptersWithImages = 0;
      let totalTranslationSize = 0;

      if (chapters instanceof Map) {
        chapterCount = chapters.size;
        chapters.forEach((chapter) => {
          if (chapter.translationResult) {
            chaptersWithTranslations += 1;
            totalTranslationSize += JSON.stringify(chapter.translationResult).length;
            if (Array.isArray(chapter.translationResult.suggestedIllustrations)) {
              chaptersWithImages += chapter.translationResult.suggestedIllustrations.length;
            }
          }
        });
      } else if (chapters) {
        const chapterEntries = Object.values(chapters);
        chapterCount = chapterEntries.length;
        chapterEntries.forEach((chapter) => {
          if (chapter.translationResult) {
            chaptersWithTranslations += 1;
            totalTranslationSize += JSON.stringify(chapter.translationResult).length;
            if (Array.isArray(chapter.translationResult.suggestedIllustrations)) {
              chaptersWithImages += chapter.translationResult.suggestedIllustrations.length;
            }
          }
        });
      }

      const imageEntries = Object.values(generatedImages);
      const imageCount = imageEntries.length;
      let base64ImageCount = 0;
      let totalImageDataSize = 0;

      imageEntries.forEach((image) => {
        if (typeof image?.data === 'string' && image.data.startsWith('data:')) {
          base64ImageCount += 1;
          totalImageDataSize += image.data.length;
        }
      });

      return {
        chapters: {
          total: chapterCount,
          withTranslations: chaptersWithTranslations,
          withImages: chaptersWithImages,
          translationDataSizeKB: (totalTranslationSize / 1024).toFixed(1),
        },
        images: {
          total: imageCount,
          base64Stored: base64ImageCount,
          base64DataSizeMB: (totalImageDataSize / 1024 / 1024).toFixed(2),
          avgImageSizeKB:
            base64ImageCount > 0
              ? ((totalImageDataSize / base64ImageCount) / 1024).toFixed(1)
              : '0',
        },
        translationHistory: {
          entriesCount: Object.keys(translationHistory).length,
        },
      };
    } catch (error) {
      return { error: String(error) };
    }
  }

  /**
   * Generate actionable recommendations based on memory breakdown
   */
  private getMemoryRecommendations(breakdown: MemoryBreakdownResult): string[] {
    const recommendations: string[] = [];

    if ('error' in breakdown) {
      return ['Unable to analyze memory usage'];
    }

    // Check for base64 images in memory
    if (breakdown.images.base64Stored > 0) {
      const sizeMB = parseFloat(breakdown.images.base64DataSizeMB);
      if (sizeMB > 50) {
        recommendations.push(
          `⚠️ ${breakdown.images.base64Stored} base64 images consuming ${sizeMB}MB - consider clearing old chapters`
        );
      } else if (sizeMB > 20) {
        recommendations.push(
          `📊 ${breakdown.images.base64Stored} base64 images using ${sizeMB}MB of memory`
        );
      }
    }

    // Check chapter count
    if (breakdown.chapters.total > 50) {
      recommendations.push(
        `📚 ${breakdown.chapters.total} chapters loaded - consider clearing old chapters from session`
      );
    }

    // Check translation data size
    const translationKB = parseFloat(breakdown.chapters.translationDataSizeKB || '0');
    if (translationKB > 5000) {
      recommendations.push(
        `💬 Translation data: ${translationKB}KB - this is normal for many chapters`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Memory usage high but no obvious large consumers found');
      recommendations.push('Try refreshing the page to clear memory');
    }

    return recommendations;
  }

  /**
   * Get current memory stats (Chromium only)
   */
  private getMemoryStats(): MemoryStats {
    const perfMemory = getPerformanceMemory();

    if (!perfMemory) {
      return {
        usedMB: 'N/A',
        limitMB: 'N/A',
        percentUsed: 'N/A'
      };
    }

    const usedMB = (perfMemory.usedJSHeapSize / 1024 / 1024).toFixed(2);
    const limitMB = (perfMemory.jsHeapSizeLimit / 1024 / 1024).toFixed(2);
    const percentUsed = ((perfMemory.usedJSHeapSize / perfMemory.jsHeapSizeLimit) * 100).toFixed(1);

    return { usedMB, limitMB, percentUsed };
  }

  /**
   * Capture an error with context
   */
  captureError(category: string, error: unknown, data?: TelemetryPayload) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    const name = error instanceof Error ? error.name : undefined;

    const event: TelemetryEvent = {
      type: 'error',
      category,
      message,
      data: {
        ...data,
        stack,
        name,
      },
      timestamp: Date.now(),
      sessionId: this.sessionId
    };

    this.addEvent(event);
    console.error('[Telemetry]', event);
  }

  /**
   * Capture a warning
   */
  captureWarning(category: string, message: string, data?: TelemetryPayload) {
    const event: TelemetryEvent = {
      type: 'warning',
      category,
      message,
      data,
      timestamp: Date.now(),
      sessionId: this.sessionId
    };

    this.addEvent(event);
    console.warn('[Telemetry]', event);
  }

  /**
   * Capture a memory snapshot with custom data
   */
  captureMemorySnapshot(label: string, data: TelemetryPayload) {
    const event: TelemetryEvent = {
      type: 'memory',
      category: 'snapshot',
      message: label,
      data: {
        ...data,
        ...this.getMemoryStats()
      },
      timestamp: Date.now(),
      sessionId: this.sessionId
    };

    this.addEvent(event);
  }

  /**
   * Capture a performance metric
   */
  capturePerformance(label: string, durationMs: number, data?: TelemetryPayload) {
    const event: TelemetryEvent = {
      type: 'performance',
      category: 'timing',
      message: label,
      data: {
        ...data,
        durationMs,
        durationSeconds: (durationMs / 1000).toFixed(2)
      },
      timestamp: Date.now(),
      sessionId: this.sessionId
    };

    this.addEvent(event);
  }

  private addEvent(event: TelemetryEvent) {
    this.events.push(event);

    // Keep only last N events to prevent unbounded growth
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  /**
   * Get all events or filter by type
   */
  getEvents(type?: TelemetryEvent['type']): TelemetryEvent[] {
    return type
      ? this.events.filter(e => e.type === type)
      : this.events;
  }

  /**
   * Get event summary statistics
   */
  getSummary() {
    const errors = this.events.filter(e => e.type === 'error').length;
    const warnings = this.events.filter(e => e.type === 'warning').length;
    const memoryEvents = this.events.filter(e => e.type === 'memory').length;
    const perfEvents = this.events.filter(e => e.type === 'performance').length;

    return {
      sessionId: this.sessionId,
      totalEvents: this.events.length,
      errors,
      warnings,
      memoryEvents,
      perfEvents,
      sessionDurationMs: this.events.length > 0
        ? Date.now() - this.events[0].timestamp
        : 0,
      currentMemory: this.getMemoryStats()
    };
  }

  /**
   * Export all telemetry data as JSON
   */
  exportTelemetry(): string {
    return JSON.stringify({
      summary: this.getSummary(),
      events: this.events
    }, null, 2);
  }

  /**
   * Clear all events (for testing)
   */
  clear() {
    this.events = [];
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }

    // Remove event listeners if we stored them
    if (this.errorHandler) {
      window.removeEventListener('error', this.errorHandler);
      this.errorHandler = undefined;
    }
    if (this.rejectionHandler) {
      window.removeEventListener('unhandledrejection', this.rejectionHandler);
      this.rejectionHandler = undefined;
    }

    this.isInitialized = false;
  }
}

// Singleton instance
export const telemetryService = new TelemetryService();

// Auto-initialize and expose debugging tools (only in browser)
if (typeof window !== 'undefined') {
  telemetryService.initialize();
  const browserWindow = window as Window & WindowAugments;
  browserWindow.exportTelemetry = () => telemetryService.exportTelemetry();
  browserWindow.telemetrySummary = () => telemetryService.getSummary();
}
