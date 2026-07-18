import { ChapterOps } from './chapters';
import { TranslationOps } from './translations';
import { apiMetricsService } from '../../apiMetricsService';

/**
 * Sums cumulative translation spend for a novel + version, in USD. Two disjoint sources:
 *
 *   1. Successfully-persisted translation versions (estimatedCost). Every paid version counts —
 *      the previous active-version-only sum let retranslations spend past the cap invisibly
 *      (TECH-DEBT P0.4).
 *   2. FAILED / truncated translation calls from the api_metrics ledger (P1.4). These are billed
 *      by the provider but never become a version, so they escaped the cap; they are disjoint from
 *      (1) — a call is either a persisted success or a recorded failure, never both — so adding
 *      them never double-counts.
 *
 * Still imperfect: a successful version the user DELETED escapes both sums (its metric is a
 * success, not a failure, and its version is gone). That is a narrower gap than before, when every
 * failed call was invisible.
 */
export async function getNovelTranslationCost(
  novelId: string,
  versionId: string
): Promise<number> {
  const chapters = await ChapterOps.getByNovelAndVersion(novelId, versionId);

  let totalCost = 0;
  const chapterStableIds = new Set<string>();

  for (const ch of chapters) {
    const stableId = ch.stableId || undefined;
    const canonicalUrl = ch.canonicalUrl || ch.url;
    if (stableId) chapterStableIds.add(stableId);

    const versions = stableId
      ? await TranslationOps.getVersionsByStableId(stableId)
      : await TranslationOps.getVersionsByUrl(canonicalUrl);

    for (const version of versions) {
      totalCost += version.estimatedCost || 0;
    }
  }

  // Add spend from calls that were billed but never became a version (failed/truncated).
  totalCost += await apiMetricsService.getFailedTranslationCostForChapters(chapterStableIds);

  return totalCost;
}
