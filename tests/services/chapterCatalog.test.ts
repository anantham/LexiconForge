/**
 * Tests for the virtual chapter catalog — projects the registry's declared
 * chapter range into ChapterSummary placeholders so the dropdown / graph /
 * jump-to-chapter UI know about every chapter, not just the ones ingested
 * into IDB. See services/chapterCatalog.ts header.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildVirtualCatalog,
  buildCanonicalUrl,
  buildVirtualStableId,
  isVirtualStableId,
  clearCatalogCache,
  VIRTUAL_STABLE_ID_PREFIX,
} from '../../services/chapterCatalog';

const { fetchNovelByIdMock, resolveCompatibleVersionMock } = vi.hoisted(() => ({
  fetchNovelByIdMock: vi.fn(),
  resolveCompatibleVersionMock: vi.fn(),
}));

vi.mock('../../services/registryService', () => ({
  RegistryService: {
    fetchNovelById: fetchNovelByIdMock,
    resolveCompatibleVersion: resolveCompatibleVersionMock,
  },
}));

const noVersion = (novelId: string, chapterCount: number) => ({
  id: novelId,
  title: `Test ${novelId}`,
  metadata: { chapterCount },
  versions: [],
});

const withVersion = (
  novelId: string,
  versionId: string,
  rangeFrom: number,
  rangeTo: number,
  chapterCount?: number
) => ({
  id: novelId,
  title: `Test ${novelId}`,
  metadata: { chapterCount: chapterCount ?? rangeTo },
  versions: [
    {
      versionId,
      displayName: 'Test Version',
      chapterRange: { from: rangeFrom, to: rangeTo },
    },
  ],
});

describe('chapterCatalog — utility helpers', () => {
  it('buildCanonicalUrl emits the lexiconforge:// scheme used by library-session-builder', () => {
    expect(buildCanonicalUrl('forty-millenniums-of-cultivation', 339)).toBe(
      'lexiconforge://forty-millenniums-of-cultivation/chapter/339'
    );
  });

  it('buildVirtualStableId namespaces with the virtual: prefix and includes novelId + chapterNumber', () => {
    const id = buildVirtualStableId('fmc', 42);
    expect(id).toBe(`${VIRTUAL_STABLE_ID_PREFIX}fmc:42`);
    expect(isVirtualStableId(id)).toBe(true);
  });

  it('isVirtualStableId returns false for normal hash-based stableIds', () => {
    expect(isVirtualStableId('a1b2c3d4')).toBe(false);
    expect(isVirtualStableId('chapter-uuid-xyz')).toBe(false);
    expect(isVirtualStableId('virtual-not-prefixed')).toBe(false);
    expect(isVirtualStableId('')).toBe(false);
  });
});

describe('buildVirtualCatalog', () => {
  beforeEach(() => {
    clearCatalogCache();
    fetchNovelByIdMock.mockReset();
    resolveCompatibleVersionMock.mockReset();
    // Default: no version match
    resolveCompatibleVersionMock.mockReturnValue({
      version: null,
      requestedVersionId: null,
      resolvedVersionId: null,
      warning: null,
    });
  });

  it('projects 1..chapterCount placeholders when no version range is available', async () => {
    fetchNovelByIdMock.mockResolvedValueOnce(noVersion('test-novel', 5));

    const entries = await buildVirtualCatalog('test-novel', null);

    expect(entries).toHaveLength(5);
    expect(entries[0]).toMatchObject({
      stableId: buildVirtualStableId('test-novel', 1),
      canonicalUrl: 'lexiconforge://test-novel/chapter/1',
      title: 'Chapter 1',
      chapterNumber: 1,
      hasTranslation: false,
      hasImages: false,
    });
    expect(entries[4].chapterNumber).toBe(5);
  });

  it('uses the resolved version chapterRange when available (preferred over chapterCount)', async () => {
    const novel = withVersion('fmc', 'v1', 100, 200, /* chapterCount */ 3521);
    fetchNovelByIdMock.mockResolvedValueOnce(novel);
    resolveCompatibleVersionMock.mockReturnValueOnce({
      version: novel.versions[0],
      requestedVersionId: 'v1',
      resolvedVersionId: 'v1',
      warning: null,
    });

    const entries = await buildVirtualCatalog('fmc', 'v1');

    expect(entries).toHaveLength(101);
    expect(entries[0].chapterNumber).toBe(100);
    expect(entries[100].chapterNumber).toBe(200);
    expect(entries[0].canonicalUrl).toBe('lexiconforge://fmc/chapter/100');
  });

  it('returns [] when the registry novel cannot be fetched', async () => {
    fetchNovelByIdMock.mockResolvedValueOnce(null);

    const entries = await buildVirtualCatalog('missing', null);
    expect(entries).toEqual([]);
  });

  it('returns [] when fetchNovelById throws (offline / network error)', async () => {
    fetchNovelByIdMock.mockRejectedValueOnce(new Error('network down'));

    const entries = await buildVirtualCatalog('fmc', null);
    expect(entries).toEqual([]);
  });

  it('returns [] when neither chapterCount nor chapterRange is available', async () => {
    fetchNovelByIdMock.mockResolvedValueOnce({
      id: 'no-data',
      title: 'No Data',
      metadata: {}, // no chapterCount
      versions: [],
    });

    const entries = await buildVirtualCatalog('no-data', null);
    expect(entries).toEqual([]);
  });

  it('caches by (novelId, versionId) — second call does not re-fetch', async () => {
    fetchNovelByIdMock.mockResolvedValue(noVersion('fmc', 3));

    const first = await buildVirtualCatalog('fmc', null);
    const second = await buildVirtualCatalog('fmc', null);

    expect(first).toEqual(second);
    expect(fetchNovelByIdMock).toHaveBeenCalledTimes(1);
  });

  it('clearCatalogCache invalidates the cache', async () => {
    fetchNovelByIdMock.mockResolvedValue(noVersion('fmc', 3));

    await buildVirtualCatalog('fmc', null);
    clearCatalogCache();
    await buildVirtualCatalog('fmc', null);

    expect(fetchNovelByIdMock).toHaveBeenCalledTimes(2);
  });

  it('caches separately for different versionIds of the same novel', async () => {
    fetchNovelByIdMock.mockResolvedValue(noVersion('fmc', 3));

    await buildVirtualCatalog('fmc', 'v1');
    await buildVirtualCatalog('fmc', 'v2');

    expect(fetchNovelByIdMock).toHaveBeenCalledTimes(2);
  });
});
