import { ChapterOps } from './chapters';
import { TranslationOps } from './translations';

/**
 * Sums estimatedCost from active translation records for all chapters
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

    if (versions.length > 0) {
      const activeVersion = versions.find(v => v.isActive) || versions[0];
      totalCost += activeVersion.estimatedCost || 0;
    }
  }

  return totalCost;
}
