import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChapterRecord, TranslationRecord } from '../../../services/db/types';

vi.mock('../../../services/db/operations/chapters');
vi.mock('../../../services/db/operations/translations');

const { failedCostMock } = vi.hoisted(() => ({ failedCostMock: vi.fn().mockResolvedValue(0) }));
vi.mock('../../../services/apiMetricsService', () => ({
  apiMetricsService: { getFailedTranslationCostForChapters: (...a: any[]) => failedCostMock(...a) },
}));

import { getNovelTranslationCost } from '../../../services/db/operations/budgetOps';
import { ChapterOps } from '../../../services/db/operations/chapters';
import { TranslationOps } from '../../../services/db/operations/translations';

describe('getNovelTranslationCost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    failedCostMock.mockResolvedValue(0);
  });

  it('sums estimatedCost across ALL versions of every chapter (budget = cumulative spend)', async () => {
    // P0.4: the active-only sum let retranslations spend past the cap
    // invisibly — a chapter translated three times cost 3x while the budget
    // gate saw 1x. Every paid version counts.
    vi.mocked(ChapterOps.getByNovelAndVersion).mockResolvedValue([
      { stableId: 'ch-1', canonicalUrl: 'url-1' } as ChapterRecord,
      { stableId: 'ch-2', canonicalUrl: 'url-2' } as ChapterRecord,
    ]);
    vi.mocked(TranslationOps.getVersionsByStableId)
      .mockResolvedValueOnce([
        { isActive: true, estimatedCost: 0.05 } as TranslationRecord,
      ])
      .mockResolvedValueOnce([
        { isActive: false, estimatedCost: 0.10 } as TranslationRecord,
        { isActive: true, estimatedCost: 0.03 } as TranslationRecord,
      ]);

    const cost = await getNovelTranslationCost('novel-1', 'v1');
    expect(cost).toBeCloseTo(0.18); // 0.05 + 0.10 + 0.03 — the inactive retranslation was still paid for
  });

  it('returns 0 when no chapters exist', async () => {
    vi.mocked(ChapterOps.getByNovelAndVersion).mockResolvedValue([]);
    const cost = await getNovelTranslationCost('novel-1', 'v1');
    expect(cost).toBe(0);
  });

  it('returns 0 when chapters have no translations', async () => {
    vi.mocked(ChapterOps.getByNovelAndVersion).mockResolvedValue([
      { stableId: 'ch-1', canonicalUrl: 'url-1' } as ChapterRecord,
    ]);
    vi.mocked(TranslationOps.getVersionsByStableId).mockResolvedValue([]);
    const cost = await getNovelTranslationCost('novel-1', 'v1');
    expect(cost).toBe(0);
  });

  it('falls back to URL-based lookup when stableId is missing', async () => {
    vi.mocked(ChapterOps.getByNovelAndVersion).mockResolvedValue([
      { canonicalUrl: 'url-1' } as ChapterRecord, // no stableId
    ]);
    vi.mocked(TranslationOps.getVersionsByUrl).mockResolvedValue([
      { isActive: true, estimatedCost: 0.07 } as TranslationRecord,
    ]);

    const cost = await getNovelTranslationCost('novel-1', 'v1');
    expect(cost).toBeCloseTo(0.07);
    expect(TranslationOps.getVersionsByUrl).toHaveBeenCalledWith('url-1');
  });

  it('adds FAILED/truncated spend from the api_metrics ledger (review #2)', async () => {
    // A failed or truncated call is billed but never becomes a version, so it escaped the cap
    // entirely. The version sum captures successes; api_metrics captures the failures, disjoint.
    vi.mocked(ChapterOps.getByNovelAndVersion).mockResolvedValue([
      { stableId: 'ch-1', canonicalUrl: 'url-1' } as ChapterRecord,
      { stableId: 'ch-2', canonicalUrl: 'url-2' } as ChapterRecord,
    ]);
    vi.mocked(TranslationOps.getVersionsByStableId)
      .mockResolvedValueOnce([{ isActive: true, estimatedCost: 0.05 } as TranslationRecord])
      .mockResolvedValueOnce([{ isActive: true, estimatedCost: 0.03 } as TranslationRecord]);
    failedCostMock.mockResolvedValue(0.12); // two failed retries, billed, never persisted

    const cost = await getNovelTranslationCost('novel-1', 'v1');

    expect(cost).toBeCloseTo(0.20); // 0.05 + 0.03 versions + 0.12 failed spend
    // And it must be queried with the chapters' stableIds.
    const idsArg = failedCostMock.mock.calls[0][0] as Set<string>;
    expect(idsArg.has('ch-1')).toBe(true);
    expect(idsArg.has('ch-2')).toBe(true);
  });
});
