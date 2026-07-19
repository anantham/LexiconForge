/**
 * @vitest-environment node
 *
 * Money-honesty guards for the paid fleet run (2026-07-19 audit-tail: B2, B3/B5).
 *
 * B2 — the leaderboard's displayed cost/tokens/duration summed BOTH the skeleton's per-chunk
 * rows and its stage:'aggregate' rollup (whose numbers are the sum of those chunks), so every
 * skeleton was double-charged in the human-read money column.
 *
 * B3/B5 — cost resolution: OpenRouter's own accounting (usage.cost, requested via
 * usage:{include:true}) must win over local token math when present, because it includes
 * reasoning tokens and per-request charges token math misses; 0 is a real price for free
 * models and must NOT fall through to the unpriced estimate.
 */
import { describe, it, expect } from 'vitest';
import { sumRunMetrics } from '../../../scripts/sutta-studio/generate-leaderboard';
import { resolveCostUsd } from '../../../scripts/sutta-studio/spend-guard';

describe('sumRunMetrics (B2: skeleton aggregate rows must not double-count)', () => {
  const rows = [
    { runId: 'm1', stage: 'chunk', costUsd: 0.1, tokensTotal: 1000, durationMs: 500 },
    { runId: 'm1', stage: 'chunk', costUsd: 0.1, tokensTotal: 1000, durationMs: 500 },
    // the rollup of the two chunks above — counting it doubles the skeleton
    { runId: 'm1', stage: 'aggregate', costUsd: 0.2, tokensTotal: 2000, durationMs: 1000 },
    { runId: 'm1', stage: 'pass', costUsd: 0.05, tokensTotal: 400, durationMs: 200 },
    // another model's row must not leak in
    { runId: 'm2', stage: 'pass', costUsd: 9.99, tokensTotal: 99999, durationMs: 9999 },
  ];

  it('sums chunks + passes but excludes the aggregate rollup', () => {
    const m = sumRunMetrics(rows, 'm1');
    expect(m.costUsd).toBeCloseTo(0.25, 10);
    expect(m.tokensTotal).toBe(2400);
    expect(m.durationMs).toBe(1200);
  });

  it('returns null cost when no row carries a price', () => {
    const m = sumRunMetrics(
      [{ runId: 'm1', stage: 'pass', costUsd: null, tokensTotal: 100, durationMs: 50 }],
      'm1',
    );
    expect(m.costUsd).toBeNull();
    expect(m.tokensTotal).toBe(100);
  });

  it('tolerates legacy rows without a stage field', () => {
    const m = sumRunMetrics(
      [{ runId: 'm1', costUsd: 0.3, tokensTotal: 10, durationMs: 5 }],
      'm1',
    );
    expect(m.costUsd).toBeCloseTo(0.3, 10);
  });
});

describe('resolveCostUsd (B5: provider accounting beats token math)', () => {
  const pricing = { input: 1, output: 2 }; // $ per 1M tokens

  it('prefers usage.cost even when token math disagrees', () => {
    expect(
      resolveCostUsd({ cost: 0.0123, prompt_tokens: 1_000_000, completion_tokens: 1_000_000 }, pricing),
    ).toBe(0.0123);
  });

  it('accepts 0 as a real price (free models must not be charged the unpriced estimate)', () => {
    expect(resolveCostUsd({ cost: 0, prompt_tokens: 5, completion_tokens: 5 }, pricing)).toBe(0);
  });

  it('falls back to token math without usage.cost', () => {
    expect(
      resolveCostUsd({ prompt_tokens: 1_000_000, completion_tokens: 1_000_000 }, pricing),
    ).toBeCloseTo(3, 10);
  });

  it('returns null (→ SpendGuard unpriced estimate) when neither is available', () => {
    expect(resolveCostUsd({ prompt_tokens: 10, completion_tokens: 10 }, null)).toBeNull();
    expect(resolveCostUsd(undefined, pricing)).toBeNull();
    expect(resolveCostUsd({ cost: Number.NaN }, null)).toBeNull();
  });
});
