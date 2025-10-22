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

import { indexedDBService } from '../services/indexeddb';

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

  // Pattern 5: Extract from URL if title has no number
  // (This will be handled by caller using URL patterns)

  return null;
}

/**
 * Extract chapter number from URL pattern
 */
function extractChapterNumberFromUrl(url: string): number | null {
  if (!url) return null;

  // Pattern: .../72829.html, .../72830.html, etc.
  // Assumes sequential URLs with increasing numbers
  const match = url.match(/\/(\d+)\.html?$/);
  if (match) {
    const urlNum = parseInt(match[1], 10);
    // If URL is like 72829, 72830, etc., try to extract relative position
    // This is fragile but better than nothing
    // For kanunu8.com, chapter 1 might be 72829, so we can't use absolute numbers
    return null; // Don't use URL numbers - too unreliable
  }

  return null;
}

export async function backfillChapterNumbers(): Promise<void> {
  console.log('[Migration] Starting chapter number backfill...');

  try {
    // Get all chapter summaries (flat structure with title directly accessible)
    const summaries = await indexedDBService.getChapterSummaries();
    console.log(`[Migration] Found ${summaries.length} chapters to process`);

    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // Open database directly for bulk updates
    const db = await (indexedDBService as any).openDatabase();
    const tx = db.transaction(['chapters', 'chapter_summaries'], 'readwrite');
    const chaptersStore = tx.objectStore('chapters');
    const summariesStore = tx.objectStore('chapter_summaries');

    for (const summary of summaries) {
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
          // Update summary with chapter number
          const updatedSummary = { ...summary, chapterNumber: extractedNumber };
          summariesStore.put(updatedSummary);

          // Also try to update the corresponding chapter record if it exists
          const chapterReq = chaptersStore.get(summary.canonicalUrl || '');
          chapterReq.onsuccess = () => {
            const chapter = chapterReq.result;
            if (chapter) {
              chapter.chapterNumber = extractedNumber;
              chaptersStore.put(chapter);
            }
          };

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

    // Wait for transaction to complete
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

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

// Expose to window for easy console access
if (typeof window !== 'undefined') {
  (window as any).backfillChapterNumbers = backfillChapterNumbers;
  console.log('[Migration] To run backfill, execute: backfillChapterNumbers()');
}
