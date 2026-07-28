/**
 * Lazily fetches a *lightweight* chapter index (chapterNumber + title only)
 * for a library version's session.json, so the detail modal's nested section
 * picker can show which verses exist per group without importing the whole
 * session into IndexedDB first.
 *
 * The modal only ever holds version metadata (a `chapterRange`), never a
 * per-chapter list — so a groupable novel's verse structure has to come from
 * somewhere. We fetch the session JSON once, on first expand, keep only
 * `{ chapterNumber, title }`, and cache the result by URL for the lifetime of
 * the tab. This is bounded work: it runs only for GROUPABLE novels (a rare,
 * curated shape), and their per-verse text is short.
 */

import type { ChapterIndexItem } from './sectionGrouping';

const GIT_LFS_POINTER_PREFIX = 'version https://git-lfs';

const cache = new Map<string, Promise<ChapterIndexItem[]>>();

/**
 * The registry already normalises `sessionJsonUrl` to a fetchable media URL
 * (see RegistryService.normalizeSessionArtifactUrl), so we fetch it directly
 * and only guard against an un-hydrated Git-LFS pointer being served.
 */
async function fetchIndexUncached(sessionJsonUrl: string): Promise<ChapterIndexItem[]> {
  const response = await fetch(sessionJsonUrl);
  if (!response.ok) {
    throw new Error(`Failed to load chapter list (HTTP ${response.status})`);
  }

  const text = await response.text();
  if (text.trimStart().startsWith(GIT_LFS_POINTER_PREFIX)) {
    throw new Error('Chapter list is a Git-LFS pointer, not the session content.');
  }

  const data = JSON.parse(text);
  const chapters = Array.isArray(data?.chapters) ? data.chapters : [];

  return chapters
    .map((c: any): ChapterIndexItem | null => {
      const chapterNumber = typeof c?.chapterNumber === 'number' ? c.chapterNumber : Number(c?.chapterNumber);
      if (!Number.isFinite(chapterNumber)) return null;
      const title = typeof c?.title === 'string' ? c.title : undefined;
      return { chapterNumber, ...(title ? { title } : {}) };
    })
    .filter((c: ChapterIndexItem | null): c is ChapterIndexItem => c !== null);
}

/**
 * Fetch + cache the chapter index for a session URL. Concurrent callers share
 * the in-flight promise; a rejection is evicted so a later call can retry.
 */
export function fetchChapterIndex(sessionJsonUrl: string): Promise<ChapterIndexItem[]> {
  const existing = cache.get(sessionJsonUrl);
  if (existing) return existing;

  const pending = fetchIndexUncached(sessionJsonUrl).catch((err) => {
    cache.delete(sessionJsonUrl);
    throw err;
  });
  cache.set(sessionJsonUrl, pending);
  return pending;
}

/** Test/maintenance hook. */
export function clearChapterIndexCache(): void {
  cache.clear();
}
