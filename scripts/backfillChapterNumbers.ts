/**
 * One-time migration script to backfill missing chapter numbers
 *
 * Problem: Chapters 1-5 have chapterNumber: undefined or 0, causing
 * dropdown to show "Ch #0" instead of proper numbers.
 *
 * Solution: Extract chapter numbers from titles using regex patterns
 * and update both CHAPTERS and CHAPTER_SUMMARIES stores.
 *
 * Run from browser console:
 * ```
 * import('./scripts/backfillChapterNumbers.ts').then(m => m.backfillChapterNumbers())
 * ```
 */

import type { ChapterSummaryRecord } from '../services/db/types';
import { ChapterOps, fetchChapterSummaries } from '../services/db/operations';
import { recomputeChapterSummary } from '../services/db/operations/chapters';

/**
 * Extract chapter number from title using multiple patterns
 */
function extractChapterNumber(title: string): number | null {
  if (!title) return null;

  // Pattern 1: "Chapter 123" or "Ch 123" or "Ch. 123"
  let match = title.match(/(?:Chapter|Ch\.?)\s+(\d+)/i);
  if (match) return parseInt(match[1], 10);

  // Pattern 2: Chinese "第123章" or "第一二三章"
  match = title.match(/第(\d+)章/);
  if (match) return parseInt(match[1], 10);

  // Pattern 3: Numbers at start "123. Title" or "123 - Title"
  match = title.match(/^(\d+)[\.\-\s]/);
  if (match) return parseInt(match[1], 10);

  // Pattern 4: Chinese number characters at end "第一章", "第二章" etc
  const chineseNumbers: { [key: string]: number } = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  };
  match = title.match(/第([一二三四五六七八九十]+)章/);
  if (match) {
    const cn = match[1];
    if (chineseNumbers[cn]) return chineseNumbers[cn];
  }

  // There is deliberately NO URL fallback: site URL numbers (e.g. kanunu8's
  // /72829.html) are absolute ids, not chapter positions, so they were judged
  // too unreliable. Chapters whose titles carry no number stay unmigrated and
  // are counted in failedCount below. (A dead extractChapterNumberFromUrl that
  // always returned null — and a comment promising the caller would use it —
  // lived here for 9 months; integrity scan 2026-07-26.)

  return null;
}

export async function backfillChapterNumbers(): Promise<void> {
  console.log('[Migration] Starting chapter number backfill...');

  try {
    // Get all chapter summaries (flat structure with title directly accessible)
    const summaries = await fetchChapterSummaries();
    console.log(`[Migration] Found ${summaries.length} chapters to process`);

    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const summary of summaries as ChapterSummaryRecord[]) {
      const currentNumber = summary.chapterNumber;

      // Skip if already has a valid chapter number (> 0)
      if (currentNumber && currentNumber > 0) {
        skippedCount++;
        continue;
      }

      // Try to extract from title
      const extractedNumber = extractChapterNumber(summary.title);

      if (extractedNumber && extractedNumber > 0) {
        console.log(`[Migration] Updating ${summary.stableId}: "${summary.title}" → Ch #${extractedNumber}`);

        try {
          if (!summary.stableId) {
            throw new Error('Missing stableId on summary record');
          }

          await ChapterOps.setChapterNumberByStableId(summary.stableId, extractedNumber);
          const updatedChapter = await ChapterOps.getByStableId(summary.stableId);
          if (updatedChapter) {
            await recomputeChapterSummary(updatedChapter);
          }
          updatedCount++;
        } catch (err) {
          console.error(`[Migration] Failed to update ${summary.stableId}:`, err);
          failedCount++;
        }
      } else {
        console.warn(`[Migration] Could not extract chapter number for: "${summary.title}" (${summary.stableId})`);
        failedCount++;
      }
    }

    console.log(`[Migration] Backfill complete!`);
    console.log(`[Migration]   Updated: ${updatedCount} chapters`);
    console.log(`[Migration]   Skipped: ${skippedCount} chapters (already had numbers)`);
    console.log(`[Migration]   Failed: ${failedCount} chapters`);

    // Suggest reload
    console.log(`[Migration] Please reload the page to see updated chapter numbers`);

  } catch (error) {
    console.error('[Migration] Backfill failed:', error);
    throw error;
  }
}

