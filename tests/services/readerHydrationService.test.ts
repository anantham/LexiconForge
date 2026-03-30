import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAllIntoStore, loadNovelIntoStore } from '../../services/readerHydrationService';
import type { ChapterRenderingRecord } from '../../services/db/operations/rendering';

const {
  mockSetState,
  mockFetchChaptersForNovel,
  mockFetchChaptersForReactRendering,
} = vi.hoisted(() => ({
  mockSetState: vi.fn(),
  mockFetchChaptersForNovel: vi.fn(),
  mockFetchChaptersForReactRendering: vi.fn(),
}));

vi.mock('../../services/db/operations/rendering', () => ({
  fetchChaptersForNovel: mockFetchChaptersForNovel,
  fetchChaptersForReactRendering: mockFetchChaptersForReactRendering,
}));

const makeRenderingRecord = (
  stableId: string,
  {
    novelId,
    chapterNumber,
    url,
    libraryVersionId = null,
  }: {
    novelId: string | null;
    chapterNumber: number;
    url?: string;
    libraryVersionId?: string | null;
  }
): ChapterRenderingRecord => {
  const chapterUrl = url ?? `https://example.com/${stableId}`;

  return {
    stableId,
    id: stableId,
    novelId,
    libraryVersionId,
    url: chapterUrl,
    canonicalUrl: chapterUrl,
    originalUrl: chapterUrl,
    sourceUrls: [chapterUrl],
    title: `Chapter ${chapterNumber}`,
    content: `Content ${chapterNumber}`,
    nextUrl: null,
    prevUrl: null,
    chapterNumber,
    fanTranslation: null,
    suttaStudio: null,
    translationResult: null,
    data: {
      chapter: {
        title: `Chapter ${chapterNumber}`,
        content: `Content ${chapterNumber}`,
        originalUrl: chapterUrl,
        novelId,
        libraryVersionId,
        nextUrl: null,
        prevUrl: null,
        chapterNumber,
        fanTranslation: null,
        suttaStudio: null,
      },
      translationResult: null,
    },
  };
};

describe('readerHydrationService', () => {
  beforeEach(() => {
    mockSetState.mockClear();
    mockFetchChaptersForNovel.mockReset();
    mockFetchChaptersForReactRendering.mockReset();
  });

  it('loadNovelIntoStore hydrates only the requested novel and preserves novelId', async () => {
    mockFetchChaptersForNovel.mockResolvedValue([
      makeRenderingRecord('novel-a-2', { novelId: 'novel-a', chapterNumber: 2, libraryVersionId: 'alice-v1' }),
      makeRenderingRecord('novel-a-1', { novelId: 'novel-a', chapterNumber: 1, libraryVersionId: 'alice-v1' }),
    ]);

    const firstChapterId = await loadNovelIntoStore('novel-a', mockSetState, { versionId: 'alice-v1' });

    expect(mockFetchChaptersForNovel).toHaveBeenCalledWith('novel-a', 'alice-v1');
    expect(firstChapterId).toBe('novel-a-1');
    expect(mockSetState).toHaveBeenCalledTimes(1);

    const payload = mockSetState.mock.calls[0][0];
    expect(Array.from(payload.chapters.keys())).toEqual(['novel-a-1', 'novel-a-2']);
    expect(payload.chapters.get('novel-a-1')?.novelId).toBe('novel-a');
    expect(payload.chapters.get('novel-a-1')?.libraryVersionId).toBe('alice-v1');
    expect(payload.rawUrlIndex.get('https://example.com/novel-a-1')).toBe('novel-a-1');
    expect(payload.urlIndex.get('https://example.com/novel-a-1')).toBe('novel-a-1');
  });

  it('loadNovelIntoStore applies limits after sorting by chapter number', async () => {
    mockFetchChaptersForNovel.mockResolvedValue([
      makeRenderingRecord('novel-a-3', { novelId: 'novel-a', chapterNumber: 3, libraryVersionId: 'alice-v1' }),
      makeRenderingRecord('novel-a-1', { novelId: 'novel-a', chapterNumber: 1, libraryVersionId: 'alice-v1' }),
      makeRenderingRecord('novel-a-2', { novelId: 'novel-a', chapterNumber: 2, libraryVersionId: 'alice-v1' }),
    ]);

    const firstChapterId = await loadNovelIntoStore('novel-a', mockSetState, {
      limit: 2,
      versionId: 'alice-v1',
    });

    expect(firstChapterId).toBe('novel-a-1');
    const payload = mockSetState.mock.calls[0][0];
    expect(Array.from(payload.chapters.keys())).toEqual(['novel-a-1', 'novel-a-2']);
  });

  it('loadAllIntoStore supports full-session imports and preserves null novelId', async () => {
    mockFetchChaptersForReactRendering.mockResolvedValue([
      makeRenderingRecord('ephemeral-2', { novelId: null, chapterNumber: 2 }),
      makeRenderingRecord('ephemeral-1', { novelId: null, chapterNumber: 1 }),
    ]);

    const firstChapterId = await loadAllIntoStore(mockSetState);

    expect(mockFetchChaptersForReactRendering).toHaveBeenCalledTimes(1);
    expect(firstChapterId).toBe('ephemeral-1');

    const payload = mockSetState.mock.calls[0][0];
    expect(payload.chapters.get('ephemeral-1')?.novelId).toBeNull();
    expect(payload.chapters.get('ephemeral-2')?.novelId).toBeNull();
  });
});
