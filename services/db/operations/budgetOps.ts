import { ChapterOps } from './chapters';
import { TranslationOps } from './translations';

/**
 * Sums estimatedCost across ALL translation versions of every chapter in a
 * given novel + version. Returns total USD spent.
 *
 * A budget measures cumulative spend, so every paid version counts — the
 * previous active-version-only sum let retranslations spend past the cap
 * invisibly (TECH-DEBT P0.4). Versions the user deleted still escape the
 * sum; the api_metrics ledger (P1.4) is the eventual complete source.
 */
export async function getNovelTranslationCost(
  novelId: string,
  versionId: string
): Promise<number> {
  const chapters = await ChapterOps.getByNovelAndVersion(novelId, versionId);

  let totalCost = 0;

  for (const ch of chapters) {
    const stableId = ch.stableId || undefined;
    const canonicalUrl = ch.canonicalUrl || ch.url;

    const versions = stableId
      ? await TranslationOps.getVersionsByStableId(stableId)
      : await TranslationOps.getVersionsByUrl(canonicalUrl);

    for (const version of versions) {
      totalCost += version.estimatedCost || 0;
    }
  }

  return totalCost;
}
