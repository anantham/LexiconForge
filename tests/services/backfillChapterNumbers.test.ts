import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/db/operations', () => ({
  fetchChapterSummaries: vi.fn(),
  ChapterOps: {
    setChapterNumberByStableId: vi.fn(),
    getByStableId: vi.fn(),
  },
}));
vi.mock('../../services/db/operations/chapters', () => ({
  recomputeChapterSummary: vi.fn().mockResolvedValue(undefined),
}));

import { fetchChapterSummaries, ChapterOps } from '../../services/db/operations';
import { recomputeChapterSummary } from '../../services/db/operations/chapters';
import { backfillChapterNumbers } from '../../scripts/backfillChapterNumbers';

const mockFetch = vi.mocked(fetchChapterSummaries);
const mockSet = vi.mocked(ChapterOps.setChapterNumberByStableId);
const mockGet = vi.mocked(ChapterOps.getByStableId);

const summary = (stableId: string | null, title: string, chapterNumber?: number) => ({
  stableId,
  title,
  chapterNumber,
});

describe('backfillChapterNumbers completion semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ stableId: 'x' } as any);
  });

  it('classifies unparseable titles as terminal and write errors as retryable', async () => {
    mockFetch.mockResolvedValue([
      summary('a', 'Chapter 1 — The Beginning'),
      summary('b', 'Already Numbered', 7) as any,
      summary('c', '无编号标题'),
      summary('d', 'Chapter 4 — Fails'),
    ] as any);
    mockSet
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new DOMException('QuotaExceededError'));

    const result = await backfillChapterNumbers();

    expect(result.updatedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.unparseableTitleCount).toBe(1);
    expect(result.writeFailureCount).toBe(1);
    expect(mockSet).toHaveBeenCalledTimes(2);
    expect(recomputeChapterSummary).toHaveBeenCalledTimes(1);
  });

  it('reports zero write failures when only unparseable titles remain (terminal does not block)', async () => {
    mockFetch.mockResolvedValue([summary(null, '无编号'), summary('e', '第X章')] as any);

    const result = await backfillChapterNumbers();

    expect(result.unparseableTitleCount).toBe(2);
    expect(result.writeFailureCount).toBe(0);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('counts a missing stableId on an extractable title as a write failure', async () => {
    mockFetch.mockResolvedValue([summary(null, 'Chapter 9 — No Stable Id')] as any);

    const result = await backfillChapterNumbers();

    expect(result.writeFailureCount).toBe(1);
    expect(result.updatedCount).toBe(0);
  });
});
