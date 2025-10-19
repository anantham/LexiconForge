/**
 * Telemetry Service - Lightweight error and memory monitoring
 *
 * Captures unhandled errors, memory pressure warnings, and custom events
 * for debugging without external dependencies.
 */

interface TelemetryEvent {
  type: 'error' | 'warning' | 'memory' | 'performance';
  category: string;
  message: string;
  data?: any;
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

  constructor() {
    this.sessionId = crypto.randomUUID();
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
    // Capture unhandled errors
    const errorHandler = (event: ErrorEvent) => {
      this.captureError('uncaught', event.error || event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    };

    // Capture unhandled promise rejections
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      this.captureError('unhandledRejection', event.reason, {
        promise: String(event.promise)
      });
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);

    // Store handlers for potential cleanup
    (this as any)._errorHandler = errorHandler;
    (this as any)._rejectionHandler = rejectionHandler;
  }

  private setupMemoryMonitoring() {
    // Feature detection: performance.memory only exists in Chromium
    const perfMemory = (performance as any).memory;

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
  private getMemoryBreakdown(): any {
    try {
      // Access the store to check data sizes
      const storeState = (window as any).__APP_STORE__?.getState?.();

      if (!storeState) {
        return { error: 'Store not accessible' };
      }

      const chapters = storeState.chapters || new Map();
      const generatedImages = storeState.generatedImages || {};
      const translationHistory = storeState.translationHistory || {};

      // Count chapters and estimate size
      const chapterCount = chapters instanceof Map ? chapters.size : Object.keys(chapters).length;
      let chaptersWithTranslations = 0;
      let chaptersWithImages = 0;
      let totalTranslationSize = 0;

      if (chapters instanceof Map) {
        chapters.forEach((chapter: any) => {
          if (chapter.translationResult) {
            chaptersWithTranslations++;
            // Rough estimate of translation size
            totalTranslationSize += JSON.stringify(chapter.translationResult).length;
          }
          if (chapter.translationResult?.suggestedIllustrations) {
            chaptersWithImages += chapter.translationResult.suggestedIllustrations.length;
          }
        });
      }

      // Count generated images (base64 strings are memory-heavy)
      const imageCount = Object.keys(generatedImages).length;
      let base64ImageCount = 0;
      let totalImageDataSize = 0;

      Object.values(generatedImages).forEach((img: any) => {
        if (img?.data && typeof img.data === 'string' && img.data.startsWith('data:')) {
          base64ImageCount++;
          totalImageDataSize += img.data.length;
        }
      });

      return {
        chapters: {
          total: chapterCount,
          withTranslations: chaptersWithTranslations,
          withImages: chaptersWithImages,
          translationDataSizeKB: (totalTranslationSize / 1024).toFixed(1)
        },
        images: {
          total: imageCount,
          base64Stored: base64ImageCount,
          base64DataSizeMB: (totalImageDataSize / 1024 / 1024).toFixed(2),
          avgImageSizeKB: base64ImageCount > 0 ? ((totalImageDataSize / base64ImageCount) / 1024).toFixed(1) : 0
        },
        translationHistory: {
          entriesCount: Object.keys(translationHistory).length
        }
      };
    } catch (error) {
      return { error: String(error) };
    }
  }

  /**
   * Generate actionable recommendations based on memory breakdown
   */
  private getMemoryRecommendations(breakdown: any): string[] {
    const recommendations: string[] = [];

    if (breakdown.error) {
      return ['Unable to analyze memory usage'];
    }

    // Check for base64 images in memory
    if (breakdown.images?.base64Stored > 0) {
      const sizeMB = parseFloat(breakdown.images.base64DataSizeMB);
      if (sizeMB > 50) {
        recommendations.push(`⚠️ ${breakdown.images.base64Stored} base64 images consuming ${sizeMB}MB - consider clearing old chapters`);
      } else if (sizeMB > 20) {
        recommendations.push(`📊 ${breakdown.images.base64Stored} base64 images using ${sizeMB}MB of memory`);
      }
    }

    // Check chapter count
    if (breakdown.chapters?.total > 50) {
      recommendations.push(`📚 ${breakdown.chapters.total} chapters loaded - consider clearing old chapters from session`);
    }

    // Check translation data size
    const translationKB = parseFloat(breakdown.chapters?.translationDataSizeKB || '0');
    if (translationKB > 5000) {
      recommendations.push(`💬 Translation data: ${translationKB}KB - this is normal for many chapters`);
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
    const perfMemory = (performance as any).memory;

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
  captureError(category: string, error: any, data?: any) {
    const event: TelemetryEvent = {
      type: 'error',
      category,
      message: error?.message || String(error),
      data: {
        ...data,
        stack: error?.stack,
        name: error?.name
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
  captureWarning(category: string, message: string, data?: any) {
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
  captureMemorySnapshot(label: string, data: any) {
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
  capturePerformance(label: string, durationMs: number, data?: any) {
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
    if ((this as any)._errorHandler) {
      window.removeEventListener('error', (this as any)._errorHandler);
    }
    if ((this as any)._rejectionHandler) {
      window.removeEventListener('unhandledrejection', (this as any)._rejectionHandler);
    }

    this.isInitialized = false;
  }
}

// Singleton instance
export const telemetryService = new TelemetryService();

// Auto-initialize and expose debugging tools (only in browser)
if (typeof window !== 'undefined') {
  telemetryService.initialize();
  (window as any).exportTelemetry = () => telemetryService.exportTelemetry();
  (window as any).telemetrySummary = () => telemetryService.getSummary();
}
