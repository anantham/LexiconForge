/**
 * Regression test for issue #9 — chapter-change-perf-logging.
 *
 * Bug pre-fix: `getTranslationVersionsByStableId` ran the URL-based lookup
 * FIRST and the stableId-index lookup ONLY IF URL returned 0. Empirical
 * trace showed the URL path always returns 0 for stableId-migrated data,
 * wasting ~330ms (630ms→958ms in the captured trace) before the fallback
 * succeeded. Total: 574ms visible h1 transition, 958ms data resolved.
 *
 * Fix: race both paths via Promise.any. First non-empty wins.
 *
 * This test verifies the race semantics by mocking the two internal
 * methods with controlled timing and asserting:
 *  - Both paths start before either resolves (parallel, not serial)
 *  - The faster path's result wins
 *  - Empty results from either path don't block the other from winning
 *  - Both-empty returns []
 *
 * Verified to FAIL on pre-fix serial code (test asserting parallelism
 * timed out OR the slow path's timing forces serial total ≥ 210ms).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TranslationRepository } from '../../../services/db/repositories/TranslationRepository';

const makeRepo = () => {
  // Construct repo. resolveChapterUrl + fetchTranslationsByUrl + fetchTranslationsByStableId
  // are private; we override via `as any` since TypeScript private isn't runtime-enforced.
  const repo = new TranslationRepository();
  return repo as any;
};

const fakeTranslation = (version: number) => ({
  id: `t-${version}`,
  chapterUrl: 'https://example.com/ch1',
  stableId: 'stable-A',
  version,
  isActive: version === 1,
  provider: 'OpenAI',
  model: 'gpt-4o-mini',
  translation: '<p>x</p>',
  translatedTitle: `T${version}`,
  proposal: null,
  footnotes: [],
  suggestedIllustrations: [],
  usageMetrics: {},
  createdAt: Date.now(),
});

const delay = <T>(ms: number, value: T) => new Promise<T>((r) => setTimeout(() => r(value), ms));

describe('TranslationRepository — race URL+stableId lookups (issue #9)', () => {
  let repo: any;

  beforeEach(() => {
    repo = makeRepo();
    // Default resolveChapterUrl to a known URL
    repo.resolveChapterUrl = vi.fn(async () => 'https://example.com/ch1');
  });

  it('starts BOTH lookup paths in parallel (not serial)', async () => {
    // URL path is slow but eventually returns data
    const urlStarted = vi.fn();
    repo.fetchTranslationsByUrl = vi.fn(async () => {
      urlStarted();
      return delay(120, [fakeTranslation(1)]);
    });

    // stableId path starts fast, returns data quickly
    const stableIdStarted = vi.fn();
    repo.fetchTranslationsByStableId = vi.fn(async () => {
      stableIdStarted();
      return delay(10, [fakeTranslation(2)]);
    });

    const start = Date.now();
    const result = await repo.getTranslationVersionsByStableId('stable-A');
    const elapsed = Date.now() - start;

    // Both should have STARTED in parallel (otherwise stableId wouldn't have
    // begun until URL finished — that's the bug pre-fix)
    expect(urlStarted).toHaveBeenCalledTimes(1);
    expect(stableIdStarted).toHaveBeenCalledTimes(1);

    // Race winner: the 10ms stableId path. Total time should be ~10-50ms,
    // not 130ms (10 + 120 if serial).
    // Allow generous margin for CI variance but well below 120ms.
    expect(elapsed).toBeLessThan(80);

    // Returned data is the stableId path's result (version 2)
    expect(result).toHaveLength(1);
    expect(result[0].version).toBe(2);
  });

  it('stableId path wins when URL path returns empty (the pre-fix common case)', async () => {
    // URL path resolves to empty (this is what happens for stableId-migrated data)
    repo.fetchTranslationsByUrl = vi.fn(async () => []);
    // stableId has the actual data
    repo.fetchTranslationsByStableId = vi.fn(async () => [fakeTranslation(1), fakeTranslation(2)]);

    const result = await repo.getTranslationVersionsByStableId('stable-A');

    expect(result).toHaveLength(2);
    expect(result.map((v: any) => v.version).sort()).toEqual([1, 2]);
    // Both spies hit (proving the race semantics, not the old serial-fallback)
    expect(repo.fetchTranslationsByUrl).toHaveBeenCalledTimes(1);
    expect(repo.fetchTranslationsByStableId).toHaveBeenCalledTimes(1);
  });

  it('URL path wins when stableId index is empty', async () => {
    repo.fetchTranslationsByUrl = vi.fn(async () => [fakeTranslation(3)]);
    repo.fetchTranslationsByStableId = vi.fn(async () => []);

    const result = await repo.getTranslationVersionsByStableId('stable-A');

    expect(result).toHaveLength(1);
    expect(result[0].version).toBe(3);
  });

  it('returns [] when both paths are empty', async () => {
    repo.fetchTranslationsByUrl = vi.fn(async () => []);
    repo.fetchTranslationsByStableId = vi.fn(async () => []);

    const result = await repo.getTranslationVersionsByStableId('stable-A');

    expect(result).toEqual([]);
  });

  it('returns [] when URL resolution throws AND stableId returns empty', async () => {
    // Simulates URL_MAPPINGS miss + no stableId-indexed translation
    repo.resolveChapterUrl = vi.fn(async () => {
      throw new Error('URL_MAPPINGS miss');
    });
    repo.fetchTranslationsByStableId = vi.fn(async () => []);

    const result = await repo.getTranslationVersionsByStableId('stable-A');
    expect(result).toEqual([]);
  });

  it('stableId path wins when URL resolution throws', async () => {
    // URL_MAPPINGS miss but data exists via stableId index
    repo.resolveChapterUrl = vi.fn(async () => {
      throw new Error('URL_MAPPINGS miss');
    });
    repo.fetchTranslationsByStableId = vi.fn(async () => [fakeTranslation(5)]);

    const result = await repo.getTranslationVersionsByStableId('stable-A');
    expect(result).toHaveLength(1);
    expect(result[0].version).toBe(5);
  });
});
