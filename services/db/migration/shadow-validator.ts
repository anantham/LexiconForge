/**
 * Shadow Validation Framework - Hybrid Safety
 * 
 * Implements GPT-5's shadow reads pattern with Claude's service-aware validation.
 * Runs operations on both backends and compares results for safety.
 */

import type { Repo } from '../../../adapters/repo/Repo';
import { makeLegacyRepo } from '../../../legacy/indexeddb-compat';
import { makeRepo } from '../index';
import { DbError } from '../core/errors';
import type { ServiceName } from './phase-controller';
import { debugLog } from '../../../utils/debug';

export interface ShadowReadResult<T> {
  legacyResult: T;
  newResult: T;
  identical: boolean;
  differences: string[];
  executionTimes: {
    legacy: number;
    new: number;
  };
  error?: DbError;
}

export interface ValidationMetrics {
  totalOperations: number;
  identicalResults: number;
  differences: number;
  errors: number;
  avgLegacyTime: number;
  avgNewTime: number;
  errorRate: number;
  differenceRate: number;
}

export class ShadowValidator {
  private metrics = new Map<ServiceName, ValidationMetrics>();
  private legacyRepo: Repo;
  private newRepo: Repo;
  private isEnabled = false;

  constructor() {
    this.legacyRepo = makeLegacyRepo();
    this.newRepo = makeRepo('idb');
  }

  /**
   * Enable shadow reads for validation
   */
  enable(): void {
    this.isEnabled = true;
    debugLog('indexeddb', 'summary', '[ShadowValidator] Shadow validation enabled');
  }

  /**
   * Disable shadow reads
   */
  disable(): void {
    this.isEnabled = false;
    debugLog('indexeddb', 'summary', '[ShadowValidator] Shadow validation disabled');
  }

  /**
   * Check if shadow validation is enabled
   */
  get enabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Run a read operation on both backends and compare results
   */
  async validateRead<T>(
    operation: string,
    service: ServiceName,
    legacyOp: () => Promise<T>,
    newOp: () => Promise<T>,
    compareFn?: (legacy: T, new_: T) => { identical: boolean; differences: string[] }
  ): Promise<ShadowReadResult<T>> {
    if (!this.isEnabled) {
      // If shadow validation is disabled, just run the legacy operation
      return {
        legacyResult: await legacyOp(),
        newResult: {} as T, // Empty placeholder
        identical: true,
        differences: [],
        executionTimes: { legacy: 0, new: 0 }
      };
    }

    try {
      // Run both operations concurrently
      const [legacyMeasurement, newMeasurement] = await Promise.all([
        this.timeOperation(legacyOp),
        this.timeOperation(newOp),
      ]);

      const legacyResult = legacyMeasurement.result;
      const legacyTime = legacyMeasurement.duration;
      const newResult = newMeasurement.result;
      const newTime = newMeasurement.duration;

      // Compare results
      const comparison = compareFn 
        ? compareFn(legacyResult, newResult)
        : this.defaultCompare(legacyResult, newResult);

      const shadowResult: ShadowReadResult<T> = {
        legacyResult,
        newResult,
        identical: comparison.identical,
        differences: comparison.differences,
        executionTimes: {
          legacy: legacyTime,
          new: newTime,
        },
      };

      // Update metrics
      this.updateMetrics(service, shadowResult);

      // Log differences for investigation
      if (!comparison.identical) {
        console.warn(`[ShadowValidator] Difference detected in ${service}.${operation}:`, {
          differences: comparison.differences,
          legacyResult: this.sanitizeForLog(legacyResult),
          newResult: this.sanitizeForLog(newResult),
        });
      }

      return shadowResult;

    } catch (error) {
      const dbError = error instanceof DbError 
        ? error 
        : new DbError('Transient', 'shadow', service, `Shadow validation failed for ${operation}`, error);

      console.error(`[ShadowValidator] Error in ${service}.${operation}:`, error);

      // Update error metrics
      const metrics = this.getOrCreateMetrics(service);
      metrics.totalOperations++;
      metrics.errors++;

      return {
        legacyResult: {} as T,
        newResult: {} as T,
        identical: false,
        differences: [`Shadow validation error: ${dbError.message}`],
        executionTimes: { legacy: 0, new: 0 },
        error: dbError,
      };
    }
  }

  /**
   * Time an async operation
   */
  private async timeOperation<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await operation();
    const duration = performance.now() - start;
    return { result, duration };
  }

  /**
   * Default comparison function for results
   */
  private defaultCompare<T>(legacy: T, new_: T): { identical: boolean; differences: string[] } {
    const differences: string[] = [];

    // Handle null/undefined cases
    if (legacy === null && new_ === null) {
      return { identical: true, differences: [] };
    }

    if (legacy === null || new_ === null) {
      differences.push(`Null mismatch: legacy=${legacy}, new=${new_}`);
      return { identical: false, differences };
    }

    // For objects, do deep comparison of key fields
    if (typeof legacy === 'object' && typeof new_ === 'object') {
      return this.compareObjects(legacy as any, new_ as any);
    }

    // For primitives, direct comparison
    const identical = legacy === new_;
    if (!identical) {
      differences.push(`Value mismatch: legacy=${legacy}, new=${new_}`);
    }

    return { identical, differences };
  }

  /**
   * Compare two objects field by field
   */
  private compareObjects(legacy: any, new_: any): { identical: boolean; differences: string[] } {
    const differences: string[] = [];

    // Compare critical fields (customize based on your data structures)
    const criticalFields = [
      'id', 'url', 'stableId', 'version', 'isActive',
      'translatedContent', 'provider', 'model', 'cost',
      'title', 'content', 'metadata'
    ];

    for (const field of criticalFields) {
      if (field in legacy || field in new_) {
        if (legacy[field] !== new_[field]) {
          differences.push(`Field ${field}: legacy=${legacy[field]}, new=${new_[field]}`);
        }
      }
    }

    // Check for array length differences
    if (Array.isArray(legacy) && Array.isArray(new_)) {
      if (legacy.length !== new_.length) {
        differences.push(`Array length: legacy=${legacy.length}, new=${new_.length}`);
      }
    }

    return { identical: differences.length === 0, differences };
  }

  /**
   * Sanitize data for logging (remove sensitive info)
   */
  private sanitizeForLog(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = { ...data };
    
    // Remove sensitive fields
    const sensitiveFields = ['apiKey', 'token', 'password', 'secret'];
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Update metrics for a service
   */
  private updateMetrics<T>(service: ServiceName, result: ShadowReadResult<T>): void {
    const metrics = this.getOrCreateMetrics(service);

    metrics.totalOperations++;
    
    if (result.identical) {
      metrics.identicalResults++;
    } else {
      metrics.differences++;
    }

    if (result.error) {
      metrics.errors++;
    }

    // Update timing averages
    const totalOps = metrics.totalOperations;
    metrics.avgLegacyTime = ((metrics.avgLegacyTime * (totalOps - 1)) + result.executionTimes.legacy) / totalOps;
    metrics.avgNewTime = ((metrics.avgNewTime * (totalOps - 1)) + result.executionTimes.new) / totalOps;

    // Update rates
    metrics.errorRate = metrics.errors / metrics.totalOperations;
    metrics.differenceRate = metrics.differences / metrics.totalOperations;
  }

  /**
   * Get or create metrics for a service
   */
  private getOrCreateMetrics(service: ServiceName): ValidationMetrics {
    if (!this.metrics.has(service)) {
      this.metrics.set(service, {
        totalOperations: 0,
        identicalResults: 0,
        differences: 0,
        errors: 0,
        avgLegacyTime: 0,
        avgNewTime: 0,
        errorRate: 0,
        differenceRate: 0,
      });
    }
    return this.metrics.get(service)!;
  }

  /**
   * Get validation metrics for a service
   */
  getMetrics(service: ServiceName): ValidationMetrics | undefined {
    return this.metrics.get(service);
  }

  /**
   * Get validation metrics for all services
   */
  getAllMetrics(): Record<ServiceName, ValidationMetrics> {
    const result: any = {};
    for (const [service, metrics] of this.metrics.entries()) {
      result[service] = metrics;
    }
    return result;
  }

  /**
   * Reset metrics for a service
   */
  resetMetrics(service: ServiceName): void {
    this.metrics.delete(service);
  }

  /**
   * Check if a service passes validation thresholds
   */
  isServiceValid(service: ServiceName, thresholds: {
    maxErrorRate?: number;
    maxDifferenceRate?: number;
    minOperations?: number;
  } = {}): boolean {
    const metrics = this.getMetrics(service);
    if (!metrics) return false;

    const {
      maxErrorRate = 0.01, // 1%
      maxDifferenceRate = 0.01, // 1%
      minOperations = 10,
    } = thresholds;

    return metrics.totalOperations >= minOperations &&
           metrics.errorRate <= maxErrorRate &&
           metrics.differenceRate <= maxDifferenceRate;
  }

  /**
   * Generate validation report
   */
  generateReport(): string {
    const lines: string[] = [
      '=== Shadow Validation Report ===',
      `Status: ${this.isEnabled ? 'ENABLED' : 'DISABLED'}`,
      '',
    ];

    for (const [service, metrics] of this.metrics.entries()) {
      const isValid = this.isServiceValid(service);
      lines.push(`Service: ${service} ${isValid ? '✅' : '❌'}`);
      lines.push(`  Operations: ${metrics.totalOperations}`);
      lines.push(`  Identical: ${metrics.identicalResults} (${(metrics.identicalResults / metrics.totalOperations * 100).toFixed(1)}%)`);
      lines.push(`  Differences: ${metrics.differences} (${(metrics.differenceRate * 100).toFixed(2)}%)`);
      lines.push(`  Errors: ${metrics.errors} (${(metrics.errorRate * 100).toFixed(2)}%)`);
      lines.push(`  Avg Times: Legacy ${metrics.avgLegacyTime.toFixed(1)}ms, New ${metrics.avgNewTime.toFixed(1)}ms`);
      lines.push('');
    }

    return lines.join('\n');
  }
}

// Export singleton instance
export const shadowValidator = new ShadowValidator();

/**
 * Convenience function to wrap operations with shadow validation
 */
export async function withShadowValidation<T>(
  operation: string,
  service: ServiceName,
  legacyOp: () => Promise<T>,
  newOp: () => Promise<T>,
  compareFn?: (legacy: T, new_: T) => { identical: boolean; differences: string[] }
): Promise<T> {
  const result = await shadowValidator.validateRead(operation, service, legacyOp, newOp, compareFn);
  
  // Always return the legacy result for safety
  // (New backend is not trusted yet during shadow phase)
  return result.legacyResult;
}
