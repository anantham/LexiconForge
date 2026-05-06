import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChapterRecord } from '../../../services/db/types';

const mockChapters: ChapterRecord[] = [];

// Mock the transaction layer to avoid needing a real DB connection
vi.mock('../../../services/db/core/txn', () => ({
  withReadTxn: vi.fn(async (_storeName: string, callback: Function, ..._rest: any[]) => {
    const fakeIndex = {
      getAll: (novelId: string) =>
        ({ result: mockChapters.filter(ch => ch.novelId === novelId) }),
    };
    const fakeStore = {
      indexNames: { contains: () => true },
      index: () => fakeIndex,
      getAll: () => ({ result: mockChapters }),
    };
    return callback(null, { chapters: fakeStore });
  }),
  withWriteTxn: vi.fn(),
  promisifyRequest: vi.fn((request: any) => Promise.resolve(request.result)),
}));

// Mock other imports that chapters.ts pulls in
vi.mock('../../../services/stableIdService', () => ({
  generateStableChapterId: vi.fn(),
  normalizeUrlAggressively: vi.fn((url: string) => url),
}));

vi.mock('../../../services/libraryScope', () => ({
  buildScopedStorageUrl: vi.fn((url: string) => url),
}));

import { ChapterOps } from '../../../services/db/operations/chapters';

describe('ChapterOps.getByNovelAndVersion', () => {
  beforeEach(() => {
    mockChapters.length = 0;
    mockChapters.push(
      { stableId: 'ch-1', novelId: 'novel-1', libraryVersionId: 'v1', chapterNumber: 1 } as ChapterRecord,
      { stableId: 'ch-2', novelId: 'novel-1', libraryVersionId: 'v1', chapterNumber: 2 } as ChapterRecord,
      { stableId: 'ch-3', novelId: 'novel-2', libraryVersionId: 'v1', chapterNumber: 1 } as ChapterRecord,
    );
  });

  it('returns only chapters matching novelId and versionId', async () => {
    const result = await ChapterOps.getByNovelAndVersion('novel-1', 'v1');
    expect(result).toHaveLength(2);
    expect(result.every(ch => ch.novelId === 'novel-1')).toBe(true);
  });

  it('returns empty array when no chapters match', async () => {
    const result = await ChapterOps.getByNovelAndVersion('nonexistent', 'v1');
    expect(result).toEqual([]);
  });

  it('filters by versionId when novelId matches but versionId differs', async () => {
    const result = await ChapterOps.getByNovelAndVersion('novel-1', 'other-version');
    expect(result).toEqual([]);
  });
});
