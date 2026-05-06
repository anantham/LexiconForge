/**
 * Chapter catalog — virtual list of all chapters in a novel, derived from
 * the library registry's metadata (chapterCount + version chapterRange).
 *
 * Why this exists:
 *   The chapter dropdown was bounded by `chapter_summaries` rows in IDB.
 *   Summaries are written only after a chapter is fetched/imported, so the
 *   dropdown only ever showed "chapters ever visited" — not "chapters in
 *   this novel." For a 3500-chapter novel where you've read 13, the
 *   dropdown showed 13 entries, which defeats the purpose. Likewise the
 *   oscilloscope graph couldn't navigate to unloaded chapters.
 *
 *   This service projects the full novel range from the registry, so the
 *   dropdown / graph / "jump to chapter N" surfaces always know about
 *   every chapter, with virtual placeholders for unloaded ones. Click a
 *   virtual entry → handleNavigate(canonicalUrl) → existing fetch path.
 *
 * Design notes:
 *   - Virtual entries match the ChapterSummary shape with a synthetic
 *     stableId of the form `virtual:${novelId}:${chapterNumber}`. Real
 *     summaries from IDB never collide with that prefix.
 *   - Module-level cache by (novelId, versionId) so repeated dropdown
 *     opens don't re-fetch the registry. Cache cleared via
 *     `clearCatalogCache()` on novel switch / settings change if needed.
 *   - URL pattern `lexiconforge://${novelId}/chapter/${N}` matches what
 *     `scripts/lib/library-session-builder.ts` produces, so canonicalUrl
 *     resolution downstream stays consistent.
 *
 * NOT done here (Phase 3 / issue #20 territory):
 *   - DOM cost of rendering 3500 <option>s. For typical novels this is
 *     fine. Very large novels (>10K chapters) would want virtualized
 *     dropdowns or chunked rendering. Defer until empirical signal.
 */

import type { ChapterSummary } from '../types';
import type { NovelEntry } from '../types/novel';
import { RegistryService } from './registryService';

export const VIRTUAL_STABLE_ID_PREFIX = 'virtual:';

/**
 * Returns true if a given stableId is a synthetic virtual placeholder
 * (i.e., the chapter is in the registry-projected catalog but has not
 * yet been fetched/imported into IDB).
 */
export const isVirtualStableId = (stableId: string): boolean =>
  typeof stableId === 'string' && stableId.startsWith(VIRTUAL_STABLE_ID_PREFIX);

/**
 * Build the synthetic stableId for a virtual catalog entry.
 */
export const buildVirtualStableId = (novelId: string, chapterNumber: number): string =>
  `${VIRTUAL_STABLE_ID_PREFIX}${novelId}:${chapterNumber}`;

/**
 * Build the canonical URL for a chapter number in a registry novel.
 * Matches `scripts/lib/library-session-builder.ts:354` so downstream URL
 * resolution behaves identically for virtual and real entries.
 */
export const buildCanonicalUrl = (novelId: string, chapterNumber: number): string =>
  `lexiconforge://${novelId}/chapter/${chapterNumber}`;

/**
 * Inputs that determine the catalog. We cache on these.
 */
interface CatalogKey {
  novelId: string;
  versionId: string | null;
}

/**
 * Module-level cache. Survives for the page session.
 * Keyed by `${novelId}::${versionId ?? 'null'}`.
 */
const cache = new Map<string, ChapterSummary[]>();

const cacheKey = (key: CatalogKey): string =>
  `${key.novelId}::${key.versionId ?? 'null'}`;

/**
 * Compute the inclusive chapter range to project, given a registry novel
 * and an optional resolved version. Prefers the version's chapterRange
 * (specific to the translation); falls back to the novel-level chapterCount.
 */
const resolveRange = (
  novel: NovelEntry,
  versionId: string | null
): { from: number; to: number } | null => {
  // Resolve the version (handles legacy aliases + single-version fallback)
  const resolution = RegistryService.resolveCompatibleVersion(novel, versionId);
  const version = resolution.version;

  if (version?.chapterRange?.from && version?.chapterRange?.to) {
    return {
      from: version.chapterRange.from,
      to: version.chapterRange.to,
    };
  }

  // Fall back to the novel's declared chapterCount, projected as 1..N.
  const count = novel.metadata?.chapterCount;
  if (typeof count === 'number' && count > 0) {
    return { from: 1, to: count };
  }

  return null;
};

/**
 * Project a virtual catalog: one ChapterSummary placeholder per chapter
 * number in the novel's declared range. Returns [] if the registry has
 * no usable range (caller falls back to IDB-only dropdown behavior).
 */
export const buildVirtualCatalog = async (
  novelId: string,
  versionId: string | null
): Promise<ChapterSummary[]> => {
  const key = cacheKey({ novelId, versionId });
  const cached = cache.get(key);
  if (cached) return cached;

  const novel = await RegistryService.fetchNovelById(novelId).catch((error) => {
    // Registry can fail in offline mode or when the novel isn't published
    // there yet (e.g., a session imported from JSON but never registered).
    // Don't throw — just return null and let the caller fall back to IDB.
    console.warn('[chapterCatalog] fetchNovelById failed', { novelId, error });
    return null;
  });
  if (!novel) {
    cache.set(key, []);
    return [];
  }

  const range = resolveRange(novel, versionId);
  if (!range) {
    cache.set(key, []);
    return [];
  }

  const entries: ChapterSummary[] = [];
  for (let n = range.from; n <= range.to; n++) {
    entries.push({
      stableId: buildVirtualStableId(novelId, n),
      canonicalUrl: buildCanonicalUrl(novelId, n),
      title: `Chapter ${n}`,
      chapterNumber: n,
      hasTranslation: false,
      hasImages: false,
    });
  }

  cache.set(key, entries);
  return entries;
};

/**
 * Clear the module cache. Called on novel switch or by tests.
 * (At runtime the cache is keyed by (novelId, versionId), so switching
 * novels doesn't actually require a clear — but explicit invalidation
 * helps if registry data changes mid-session.)
 */
export const clearCatalogCache = (): void => {
  cache.clear();
};
