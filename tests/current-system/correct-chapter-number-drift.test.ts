import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import {
  ChapterOps,
  MaintenanceOps,
  SettingsOps,
} from '../../services/db/operations';
import {
  buildScopedStableId,
  buildScopedStorageUrl,
} from '../../services/libraryScope';
import { getConnection } from '../../services/db/core/connection';
import { STORE_NAMES } from '../../services/db/core/schema';
import { promisifyRequest } from '../../services/db/core/txn';
import type { ChapterSummaryRecord } from '../../services/db/types';

const novelId = 'forty-millenniums-of-cultivation';
const versionId = 'v1-st-enhanced';

const sid = (bare: string) => buildScopedStableId(bare, novelId, versionId);
const url = (bare: string) => buildScopedStorageUrl(bare, novelId, versionId);

const insertSummary = async (record: ChapterSummaryRecord) => {
  const conn = await getConnection();
  await new Promise<void>((resolve, reject) => {
    const tx = conn.transaction([STORE_NAMES.CHAPTER_SUMMARIES], 'readwrite');
    const req = tx.objectStore(STORE_NAMES.CHAPTER_SUMMARIES).put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

describe('correctChapterNumberDrift (V5, issue #20)', () => {
  beforeEach(async () => {
    await MaintenanceOps.clearAllData();
  });
  afterEach(async () => {
    await MaintenanceOps.clearAllData();
  });

  it('dry-run: identifies drift, does not write', async () => {
    const bare = 'ch339_60hkvy_65g6';
    await ChapterOps.store({
      stableId: sid(bare),
      novelId,
      libraryVersionId: versionId,
      originalUrl: 'https://example.com/339',
      canonicalUrl: 'https://example.com/339',
      title: 'Chapter 339: First-degree State of War',
      content: 'body',
      chapterNumber: 341, // <- drifted
    });

    const report = await MaintenanceOps.correctChapterNumberDrift({ dryRun: true });
    expect(report.dryRun).toBe(true);
    expect(report.totals.driftedRows).toBe(1);
    expect(report.totals.corrected).toBe(0);
    expect(report.correctionSample[0]).toMatchObject({
      bareN: 339,
      titleN: 339,
      previousChapterNumber: 341,
    });

    // Not written
    const ch = await ChapterOps.getByStableId(sid(bare));
    expect(ch?.chapterNumber).toBe(341);
  });

  it('commit: corrects drift and updates matching summary', async () => {
    const bare = 'ch339_60hkvy_65g6';
    await ChapterOps.store({
      stableId: sid(bare),
      novelId,
      libraryVersionId: versionId,
      originalUrl: 'https://example.com/339',
      canonicalUrl: 'https://example.com/339',
      title: 'Chapter 339: First-degree State of War',
      content: 'body',
      chapterNumber: 341,
    });
    await insertSummary({
      stableId: sid(bare),
      novelId,
      libraryVersionId: versionId,
      canonicalUrl: 'https://example.com/339',
      title: 'Chapter 339: First-degree State of War',
      chapterNumber: 341,
      hasTranslation: false,
      hasImages: false,
    });

    const report = await MaintenanceOps.correctChapterNumberDrift({
      dryRun: false,
      force: true,
    });
    expect(report.dryRun).toBe(false);
    expect(report.totals.corrected).toBe(1);
    expect(report.totals.summariesUpdated).toBe(1);

    const ch = await ChapterOps.getByStableId(sid(bare));
    expect(ch?.chapterNumber).toBe(339);

    const conn = await getConnection();
    const tx = conn.transaction([STORE_NAMES.CHAPTER_SUMMARIES], 'readonly');
    const summary = (await promisifyRequest(
      tx.objectStore(STORE_NAMES.CHAPTER_SUMMARIES).get(sid(bare))
    )) as ChapterSummaryRecord | undefined;
    expect(summary?.chapterNumber).toBe(339);

    const flag = await SettingsOps.getKey<boolean>('chapterNumberCorrectedV5');
    expect(flag).toBe(true);
  });

  it('skips when title has no Chapter N reference (insufficient triangulation)', async () => {
    const bare = 'ch5_xxxx_yyyy';
    await ChapterOps.store({
      stableId: sid(bare),
      novelId,
      libraryVersionId: versionId,
      originalUrl: 'https://example.com/5',
      canonicalUrl: 'https://example.com/5',
      title: 'Untitled', // no "Chapter N" pattern
      content: 'body',
      chapterNumber: 7,
    });

    const report = await MaintenanceOps.correctChapterNumberDrift({
      dryRun: false,
      force: true,
    });
    expect(report.totals.driftedRows).toBe(0);
    expect(report.totals.skipped_titleMissingNumber).toBe(1);

    const ch = await ChapterOps.getByStableId(sid(bare));
    expect(ch?.chapterNumber).toBe(7); // untouched
  });

  it('skips when bareN and titleN disagree (multi-source/ambiguous)', async () => {
    const bare = 'ch1_uo070x_2xjw';
    await ChapterOps.store({
      stableId: sid(bare),
      novelId,
      libraryVersionId: versionId,
      originalUrl: 'https://example.com/1',
      canonicalUrl: 'https://example.com/1',
      title: 'Chapter 5: Different Number In Title',
      content: 'body',
      chapterNumber: 99,
    });

    const report = await MaintenanceOps.correctChapterNumberDrift({
      dryRun: false,
      force: true,
    });
    expect(report.totals.driftedRows).toBe(0);
    expect(report.totals.skipped_bareTitleDisagree).toBe(1);

    const ch = await ChapterOps.getByStableId(sid(bare));
    expect(ch?.chapterNumber).toBe(99); // untouched
  });

  it('clean rows untouched (chapterNumber matches bareN)', async () => {
    const bare = 'ch10_xxxx_yyyy';
    await ChapterOps.store({
      stableId: sid(bare),
      novelId,
      libraryVersionId: versionId,
      originalUrl: 'https://example.com/10',
      canonicalUrl: 'https://example.com/10',
      title: 'Chapter 10: Already Correct',
      content: 'body',
      chapterNumber: 10,
    });

    const report = await MaintenanceOps.correctChapterNumberDrift({
      dryRun: false,
      force: true,
    });
    expect(report.totals.driftedRows).toBe(0);
    expect(report.totals.corrected).toBe(0);

    const ch = await ChapterOps.getByStableId(sid(bare));
    expect(ch?.chapterNumber).toBe(10);
  });

  it('flag prevents re-runs unless force=true', async () => {
    const bare = 'ch50_xxxx_yyyy';
    await ChapterOps.store({
      stableId: sid(bare),
      novelId,
      libraryVersionId: versionId,
      originalUrl: 'https://example.com/50',
      canonicalUrl: 'https://example.com/50',
      title: 'Chapter 50: Test',
      content: 'body',
      chapterNumber: 51,
    });

    await MaintenanceOps.correctChapterNumberDrift({ dryRun: false, force: true });
    expect((await ChapterOps.getByStableId(sid(bare)))?.chapterNumber).toBe(50);

    // Re-introduce drift
    await ChapterOps.store({
      stableId: sid(bare),
      novelId,
      libraryVersionId: versionId,
      originalUrl: 'https://example.com/50',
      canonicalUrl: 'https://example.com/50',
      title: 'Chapter 50: Test',
      content: 'body',
      chapterNumber: 99,
    });

    const skipped = await MaintenanceOps.correctChapterNumberDrift({ dryRun: false });
    expect(skipped.flagAlreadySet).toBe(true);
    expect(skipped.totals.corrected).toBe(0);
    // Drift still present
    expect((await ChapterOps.getByStableId(sid(bare)))?.chapterNumber).toBe(99);
  });
});
