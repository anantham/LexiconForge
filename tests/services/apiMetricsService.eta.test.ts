/**
 * Regression tests for issue #13 — ETA is generic, not model-specific.
 *
 * Bug pre-fix (services/apiMetricsService.ts:457-503):
 *   - Used arithmetic mean (sensitive to outlier translation stalls)
 *   - Required ≥2 samples to engage the per-model path; below that, fell
 *     through to provider/global aggregate. First-use of any new model
 *     produced misleading aggregates.
 *   - No confidence field. UI could not distinguish "1 sample" from "100
 *     samples" or "no data at all."
 *
 * Fix (issue #13):
 *   - Switched mean → median (matches Illustration.tsx pattern).
 *   - Lowered model-match threshold from ≥2 → ≥1.
 *   - Added `confidence: 'high' | 'low' | 'unknown'`.
 *   - Extracted `estimateTranslationTime` + `median` as pure helpers so
 *     this test can exercise them without an IDB connection.
 *
 * Verified to FAIL on pre-fix code via `git stash`.
 */
import { describe, expect, it } from 'vitest';
import {
  estimateTranslationTime,
  median,
  type TranslationTimeEstimate,
} from '../../services/apiMetricsService';
import type { ApiCallMetric } from '../../services/apiMetricsService';

const mkMetric = (
  model: string,
  provider: string,
  duration: number,
  overrides: Partial<ApiCallMetric> = {},
): ApiCallMetric => ({
  id: `t-${Math.random()}`,
  timestamp: new Date().toISOString(),
  apiType: 'translation',
  provider,
  model,
  costUsd: 0,
  duration,
  success: true,
  ...overrides,
});

describe('median()', () => {
  it('returns 0 for empty input', () => {
    expect(median([])).toBe(0);
  });

  it('returns the middle value for odd-length arrays', () => {
    expect(median([5, 1, 9, 3, 7])).toBe(5);
  });

  it('returns the mean of the two middle values for even-length arrays', () => {
    expect(median([1, 3, 5, 7])).toBe(4); // (3+5)/2
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('is robust to outliers (the whole point of using median over mean)', () => {
    // mean(10,10,100) = 40; median = 10
    expect(median([10, 10, 100])).toBe(10);
    // mean(5,5,5,5,500) = 104; median = 5
    expect(median([5, 5, 5, 5, 500])).toBe(5);
  });
});

describe('estimateTranslationTime — issue #13', () => {
  it('returns source=default + confidence=unknown when no metrics exist', () => {
    const r = estimateTranslationTime([], 'gemini-2.5-flash', 'Gemini');
    expect(r.source).toBe('default');
    expect(r.confidence).toBe('unknown');
    expect(r.sampleCount).toBe(0);
    expect(r.avgTimeSeconds).toBe(30);
  });

  it('engages model-specific path with 1 sample (was ≥2 pre-fix)', () => {
    const r = estimateTranslationTime(
      [
        mkMetric('gemini-2.5-flash', 'Gemini', 7),
        // Other-provider noise — pre-fix this caused fallback to global mean
        mkMetric('claude-sonnet-4-0', 'Claude', 100),
        mkMetric('gpt-5', 'OpenAI', 80),
      ],
      'gemini-2.5-flash',
      'Gemini',
    );
    expect(r.source).toBe('model');
    expect(r.sampleCount).toBe(1);
    expect(r.confidence).toBe('low');
    expect(r.avgTimeSeconds).toBe(7);
  });

  it('returns confidence=high when sampleCount ≥ 3', () => {
    const r = estimateTranslationTime(
      [
        mkMetric('gemini-2.5-flash', 'Gemini', 5),
        mkMetric('gemini-2.5-flash', 'Gemini', 7),
        mkMetric('gemini-2.5-flash', 'Gemini', 9),
      ],
      'gemini-2.5-flash',
      'Gemini',
    );
    expect(r.source).toBe('model');
    expect(r.sampleCount).toBe(3);
    expect(r.confidence).toBe('high');
    expect(r.avgTimeSeconds).toBe(7); // median
  });

  it('uses MEDIAN (robust to outliers) not MEAN', () => {
    // 10, 10, 100. Mean = 40, median = 10.
    const r = estimateTranslationTime(
      [
        mkMetric('claude-sonnet-4-0', 'Claude', 10),
        mkMetric('claude-sonnet-4-0', 'Claude', 10),
        mkMetric('claude-sonnet-4-0', 'Claude', 100), // outlier (timeout)
      ],
      'claude-sonnet-4-0',
      'Claude',
    );
    // CRITICAL ASSERTION — pre-fix would return 40, post-fix returns 10
    expect(r.avgTimeSeconds).toBe(10);
    expect(r.source).toBe('model');
  });

  it('falls back to provider when model has 0 samples but provider has ≥2', () => {
    const r = estimateTranslationTime(
      [
        mkMetric('gemini-2.5-flash', 'Gemini', 5),
        mkMetric('gemini-2.0-flash', 'Gemini', 15),
      ],
      'gemini-3.0-pro',
      'Gemini',
    );
    expect(r.source).toBe('provider');
    expect(r.sampleCount).toBe(2);
    expect(r.avgTimeSeconds).toBe(10); // median(5,15) = (5+15)/2 = 10
  });

  it('falls back to global when neither model nor provider matches', () => {
    const r = estimateTranslationTime(
      [mkMetric('gemini-2.5-flash', 'Gemini', 5)],
      'gpt-5',
      'OpenAI',
    );
    expect(r.source).toBe('global');
    expect(r.sampleCount).toBe(1);
    expect(r.confidence).toBe('low');
    expect(r.avgTimeSeconds).toBe(5);
  });

  it('ignores failed and non-translation metrics', () => {
    const r = estimateTranslationTime(
      [
        mkMetric('gemini-2.5-flash', 'Gemini', 7),
        mkMetric('gemini-2.5-flash', 'Gemini', 999, { success: false }),
        mkMetric('gemini-2.5-flash', 'Gemini', 999, { apiType: 'image' }),
        mkMetric('gemini-2.5-flash', 'Gemini', 999, { duration: undefined as any }),
      ],
      'gemini-2.5-flash',
      'Gemini',
    );
    expect(r.sampleCount).toBe(1);
    expect(r.avgTimeSeconds).toBe(7);
  });
});
