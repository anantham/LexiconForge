/**
 * Regression tests for fetchNovelChapterCounts dedup — moved here 2026-08-23
 * from the deleted bookshelf-dedup V3 migration suite (Tier-B #1: the
 * migration itself was removed; these four count-behavior cases guard live
 * behavior used by NovelLibrary and were ruled preserved).
 *
 * Original incident (2026-05-06): inflated chapter counts from duplicate
 * summary rows (FMC showing 6528 instead of 3521).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MaintenanceOps } from '../../services/db/operations';
import { fetchNovelChapterCounts } from '../../services/db/operations/summaries';
import { withWriteTxn, promisifyRequest } from '../../services/db/core/txn';
import { STORE_NAMES } from '../../services/db/core/schema';
import type { ChapterSummaryRecord } from '../../services/db/types';

const NOVEL = 'forty-millenniums-of-cultivation';
const VERSION = 'v1-st-enhanced';

const seedSummary = async (
  stableId: string,
  novelId: string,
  versionId: string | null,
  chapterNumber: number,
  hasTranslation: boolean
) => {
  await withWriteTxn(
    [STORE_NAMES.CHAPTER_SUMMARIES],
    async (_txn, stores) => {
      const store = stores[STORE_NAMES.CHAPTER_SUMMARIES];
      const summary: ChapterSummaryRecord = {
        stableId,
        novelId,
        libraryVersionId: versionId,
        title: `Chapter ${chapterNumber}`,
        chapterNumber,
        hasTranslation,
        hasImages: false,
      };
      await promisifyRequest(store.put(summary));
    }
  );
};

describe('fetchNovelChapterCounts dedup', () => {
  beforeEach(async () => {
    await MaintenanceOps.clearAllData();
  });

  afterEach(async () => {
    await MaintenanceOps.clearAllData();
  });

  it('counts each chapter once even when multiple summary rows exist for the same chapterNumber', async () => {
    // Two rows for chapter 1 (different scope), one row for chapter 2
    await seedSummary('stable-1-scope-a', NOVEL, VERSION, 1, true);
    await seedSummary('stable-1-scope-b', NOVEL, null, 1, false);
    await seedSummary('stable-2', NOVEL, VERSION, 2, true);

    const counts = await fetchNovelChapterCounts();

    // Pre-fix would report totalCount=3 (one per row); post-fix reports 2 unique chapterNumbers
    expect(counts[NOVEL]?.totalCount).toBe(2);
    // Chapter 1 has hasTranslation=true on at least one row → counts as translated.
    // Chapter 2 has hasTranslation=true. Both count.
    expect(counts[NOVEL]?.translatedCount).toBe(2);
  });

  it('ORs translation status across duplicate rows for the same chapter', async () => {
    // Three rows for chapter 1, only one of which has hasTranslation=true
    await seedSummary('stable-1-a', NOVEL, VERSION, 1, false);
    await seedSummary('stable-1-b', NOVEL, null, 1, true);
    await seedSummary('stable-1-c', NOVEL, 'legacy-version', 1, false);

    const counts = await fetchNovelChapterCounts();
    expect(counts[NOVEL]?.totalCount).toBe(1);
    // hasTranslation OR'd across rows → translated count should include this chapter
    expect(counts[NOVEL]?.translatedCount).toBe(1);
  });

  it('falls back to stableId when chapterNumber is missing (preserves distinct unnumbered chapters)', async () => {
    await seedSummary('stable-x', NOVEL, VERSION, undefined as any, false);
    await seedSummary('stable-y', NOVEL, VERSION, undefined as any, true);

    const counts = await fetchNovelChapterCounts();
    expect(counts[NOVEL]?.totalCount).toBe(2);
    expect(counts[NOVEL]?.translatedCount).toBe(1);
  });

  it('keeps separate counts per novel', async () => {
    await seedSummary('a-1', 'novel-a', null, 1, true);
    await seedSummary('a-2', 'novel-a', null, 2, true);
    await seedSummary('b-1', 'novel-b', null, 1, false);

    const counts = await fetchNovelChapterCounts();
    expect(counts['novel-a']).toEqual({ totalCount: 2, translatedCount: 2 });
    expect(counts['novel-b']).toEqual({ totalCount: 1, translatedCount: 0 });
  });
});
