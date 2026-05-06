/**
 * Regression tests for MaintenanceOps.consolidateBookshelfDuplicates and
 * fetchNovelChapterCounts dedup. Both fix the symptoms the user reported on
 * 2026-05-06: duplicate "Continue Reading" cards and inflated chapter counts
 * (FMC showing 6528 instead of 3521 due to duplicate summary rows).
 *
 * The earlier V2 migration (repairScopedStableIdDuplicates) is gated on a
 * one-time flag and won't run again on databases where it already executed.
 * This V3 migration reapplies the bookshelf-dedup logic against current
 * state, no chapter-table dependency.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MaintenanceOps,
  SettingsOps,
} from '../../services/db/operations';
import { fetchNovelChapterCounts } from '../../services/db/operations/summaries';
import { buildLibraryBookshelfKey } from '../../services/libraryScope';
import { withWriteTxn, promisifyRequest } from '../../services/db/core/txn';
import { STORE_NAMES } from '../../services/db/core/schema';
import type { ChapterSummaryRecord } from '../../services/db/types';

const NOVEL = 'forty-millenniums-of-cultivation';
const VERSION = 'v1-st-enhanced';
const KEY_FLAG = 'bookshelfDedupedV3';

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

const clearV3Flag = async () => {
  // SettingsOps.set is the public surface; using it to reset the flag
  // so the migration runs again in tests.
  await SettingsOps.set(KEY_FLAG, false as any);
};

describe('MaintenanceOps.consolidateBookshelfDuplicates (V3)', () => {
  beforeEach(async () => {
    await MaintenanceOps.clearAllData();
  });

  afterEach(async () => {
    await MaintenanceOps.clearAllData();
  });

  it('keeps a single bookshelf entry untouched (idempotent on clean state)', async () => {
    const scopedKey = buildLibraryBookshelfKey(NOVEL, VERSION);
    await SettingsOps.set('bookshelf-state', {
      [scopedKey]: {
        novelId: NOVEL,
        versionId: VERSION,
        lastChapterId: 'ch-1-id',
        lastChapterNumber: 1,
        lastReadAtIso: '2026-05-01T10:00:00.000Z',
      },
    });

    const result = await MaintenanceOps.consolidateBookshelfDuplicates();
    expect(result.duplicateGroupsCollapsed).toBe(0);
    expect(result.entriesRemoved).toBe(0);

    const state = await SettingsOps.getKey<Record<string, any>>('bookshelf-state');
    expect(Object.keys(state ?? {})).toHaveLength(1);
    expect(state?.[scopedKey]?.lastChapterNumber).toBe(1);
  });

  it('collapses duplicate entries (legacy unscoped + scoped) into the most-recent one with a scoped key', async () => {
    const scopedKey = buildLibraryBookshelfKey(NOVEL, VERSION);
    await SettingsOps.set('bookshelf-state', {
      // Legacy entry (no version in key) — matches the user's screenshot pattern
      [NOVEL]: {
        novelId: NOVEL,
        // Legacy entries often lacked versionId or had it omitted
        lastChapterId: 'old-ch-2-id',
        lastChapterNumber: 2,
        lastReadAtIso: '2026-04-01T10:00:00.000Z',
      },
      [scopedKey]: {
        novelId: NOVEL,
        versionId: VERSION,
        lastChapterId: 'new-ch-338-id',
        lastChapterNumber: 338,
        lastReadAtIso: '2026-05-06T18:00:00.000Z',
      },
    });

    const result = await MaintenanceOps.consolidateBookshelfDuplicates();
    expect(result.duplicateGroupsCollapsed).toBe(1);
    expect(result.entriesRemoved).toBe(1);

    const state = await SettingsOps.getKey<Record<string, any>>('bookshelf-state');
    const keys = Object.keys(state ?? {});
    expect(keys).toHaveLength(1);
    // Winner is the most-recent (Chapter 338), keyed under the scoped form.
    expect(keys[0]).toBe(scopedKey);
    expect(state?.[scopedKey]?.lastChapterNumber).toBe(338);
    expect(state?.[scopedKey]?.versionId).toBe(VERSION);
  });

  it('promotes a legacy unscoped winner to the scoped key by pulling forward versionId from a sibling', async () => {
    const scopedKey = buildLibraryBookshelfKey(NOVEL, VERSION);
    await SettingsOps.set('bookshelf-state', {
      [NOVEL]: {
        novelId: NOVEL,
        // No versionId on the winning legacy entry
        lastChapterId: 'old-ch-500-id',
        lastChapterNumber: 500,
        lastReadAtIso: '2026-05-06T18:00:00.000Z', // newer
      },
      [scopedKey]: {
        novelId: NOVEL,
        versionId: VERSION,
        lastChapterId: 'new-ch-100-id',
        lastChapterNumber: 100,
        lastReadAtIso: '2026-04-01T10:00:00.000Z', // older
      },
    });

    const result = await MaintenanceOps.consolidateBookshelfDuplicates();
    expect(result.duplicateGroupsCollapsed).toBe(1);

    const state = await SettingsOps.getKey<Record<string, any>>('bookshelf-state');
    const keys = Object.keys(state ?? {});
    expect(keys).toHaveLength(1);
    // The legacy entry won (more recent), but we re-key it under the scoped key
    // by pulling forward versionId from the sibling.
    expect(keys[0]).toBe(scopedKey);
    expect(state?.[scopedKey]?.lastChapterNumber).toBe(500);
    expect(state?.[scopedKey]?.versionId).toBe(VERSION);
  });

  it('preserves entries for different novels (only collapses within a novelId)', async () => {
    const fmcKey = buildLibraryBookshelfKey(NOVEL, VERSION);
    const otherNovel = 'eternal-life';
    const otherKey = buildLibraryBookshelfKey(otherNovel, 'v1');
    await SettingsOps.set('bookshelf-state', {
      [fmcKey]: {
        novelId: NOVEL,
        versionId: VERSION,
        lastChapterId: 'fmc-ch-1',
        lastChapterNumber: 1,
        lastReadAtIso: '2026-05-01T10:00:00.000Z',
      },
      [otherKey]: {
        novelId: otherNovel,
        versionId: 'v1',
        lastChapterId: 'el-ch-1',
        lastChapterNumber: 1,
        lastReadAtIso: '2026-05-02T10:00:00.000Z',
      },
    });

    const result = await MaintenanceOps.consolidateBookshelfDuplicates();
    expect(result.duplicateGroupsCollapsed).toBe(0);

    const state = await SettingsOps.getKey<Record<string, any>>('bookshelf-state');
    expect(Object.keys(state ?? {})).toHaveLength(2);
  });

  it('is gated on the V3 flag — second call is a no-op even with duplicates present', async () => {
    await SettingsOps.set('bookshelf-state', {
      [NOVEL]: {
        novelId: NOVEL,
        lastChapterId: 'a',
        lastChapterNumber: 1,
        lastReadAtIso: '2026-05-01T10:00:00.000Z',
      },
      [buildLibraryBookshelfKey(NOVEL, VERSION)]: {
        novelId: NOVEL,
        versionId: VERSION,
        lastChapterId: 'b',
        lastChapterNumber: 2,
        lastReadAtIso: '2026-05-02T10:00:00.000Z',
      },
    });

    // First call: cleans up
    const r1 = await MaintenanceOps.consolidateBookshelfDuplicates();
    expect(r1.duplicateGroupsCollapsed).toBe(1);

    // Manually re-add a duplicate (simulating drift)
    const state = await SettingsOps.getKey<Record<string, any>>('bookshelf-state');
    await SettingsOps.set('bookshelf-state', {
      ...state,
      [NOVEL]: {
        novelId: NOVEL,
        lastChapterId: 'c',
        lastChapterNumber: 3,
        lastReadAtIso: '2026-05-03T10:00:00.000Z',
      },
    });

    // Second call: no-op (flag is set). Render-side dedup is the safety net
    // for duplicates that appear after the migration runs.
    const r2 = await MaintenanceOps.consolidateBookshelfDuplicates();
    expect(r2.duplicateGroupsCollapsed).toBe(0);
  });
});

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
