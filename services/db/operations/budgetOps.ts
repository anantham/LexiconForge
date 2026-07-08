import { ChapterOps } from './chapters';
import { TranslationOps } from './translations';

/**
 * Sums estimatedCost from all translation records for all chapters
 * in a given novel + version. Returns total USD spent.
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

    totalCost += versions.reduce((sum, version) => sum + (version.estimatedCost || 0), 0);
  }

  return totalCost;
}
