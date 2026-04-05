import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChapterRecord, TranslationRecord } from '../../../services/db/types';

vi.mock('../../../services/db/operations/chapters');
vi.mock('../../../services/db/operations/translations');

import { getNovelTranslationCost } from '../../../services/db/operations/budgetOps';
import { ChapterOps } from '../../../services/db/operations/chapters';
import { TranslationOps } from '../../../services/db/operations/translations';

describe('getNovelTranslationCost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sums estimatedCost from active translations across chapters', async () => {
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
    expect(cost).toBeCloseTo(0.08); // 0.05 + 0.03 (active versions only)
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
});
