import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOOKSHELF_STATE_KEY,
  BookshelfStateService,
  type BookshelfEntry,
} from '../../services/bookshelfStateService';
import { createMockEnhancedChapter } from '../utils/test-data';

const settingsOpsMock = vi.hoisted(() => ({
  getKey: vi.fn(),
  set: vi.fn(),
}));

vi.mock('../../services/db/operations', async () => {
  const actual = await vi.importActual<typeof import('../../services/db/operations')>(
    '../../services/db/operations'
  );
  return {
    ...actual,
    SettingsOps: settingsOpsMock,
  };
});

describe('BookshelfStateService', () => {
  beforeEach(() => {
    settingsOpsMock.getKey.mockReset();
    settingsOpsMock.set.mockReset();
  });

  it('normalizes persisted bookshelf state', async () => {
    settingsOpsMock.getKey.mockResolvedValue({
      'orv::alice-v1': {
        novelId: 'orv',
        versionId: 'alice-v1',
        lastChapterId: 'ch-10',
        lastChapterNumber: 10,
        lastReadAtIso: '2026-03-29T18:00:00.000Z',
      },
      broken: {
        novelId: 'broken',
      },
    });

    const state = await BookshelfStateService.getState();

    expect(state).toEqual({
      'orv::alice-v1': {
        novelId: 'orv',
        versionId: 'alice-v1',
        lastChapterId: 'ch-10',
        lastChapterNumber: 10,
        lastReadAtIso: '2026-03-29T18:00:00.000Z',
      },
    });
  });

  it('upserts a bookshelf entry under the settings key', async () => {
    const entry: BookshelfEntry = {
      novelId: 'orv',
      versionId: 'alice-v1',
      lastChapterId: 'ch-5',
      lastChapterNumber: 5,
      lastReadAtIso: '2026-03-29T18:05:00.000Z',
    };
    settingsOpsMock.getKey.mockResolvedValue({});

    await BookshelfStateService.upsertEntry(entry);

    expect(settingsOpsMock.set).toHaveBeenCalledWith(BOOKSHELF_STATE_KEY, {
      'orv::alice-v1': entry,
    });
  });

  it('keeps separate bookshelf slots per version of the same novel', async () => {
    settingsOpsMock.getKey.mockResolvedValue({
      'orv::alice-v1': {
        novelId: 'orv',
        versionId: 'alice-v1',
        lastChapterId: 'ch-5',
        lastChapterNumber: 5,
        lastReadAtIso: '2026-03-29T18:05:00.000Z',
      },
    });

    await BookshelfStateService.upsertEntry({
      novelId: 'orv',
      versionId: 'bob-v2',
      lastChapterId: 'ch-8',
      lastChapterNumber: 8,
      lastReadAtIso: '2026-03-29T18:15:00.000Z',
    });

    expect(settingsOpsMock.set).toHaveBeenCalledWith(BOOKSHELF_STATE_KEY, {
      'orv::alice-v1': {
        novelId: 'orv',
        versionId: 'alice-v1',
        lastChapterId: 'ch-5',
        lastChapterNumber: 5,
        lastReadAtIso: '2026-03-29T18:05:00.000Z',
      },
      'orv::bob-v2': {
        novelId: 'orv',
        versionId: 'bob-v2',
        lastChapterId: 'ch-8',
        lastChapterNumber: 8,
        lastReadAtIso: '2026-03-29T18:15:00.000Z',
      },
    });
  });

  it('falls back from missing lastChapterId to chapter number, then to the provided fallback', () => {
    const chapters = new Map([
      ['ch-1', createMockEnhancedChapter({ id: 'ch-1', chapterNumber: 1, novelId: 'orv' })],
      ['ch-3', createMockEnhancedChapter({ id: 'ch-3', chapterNumber: 3, novelId: 'orv' })],
    ]);

    expect(
      BookshelfStateService.resolveResumeChapterId(
        {
          novelId: 'orv',
          lastChapterId: 'missing',
          lastChapterNumber: 3,
          lastReadAtIso: '2026-03-29T18:05:00.000Z',
        },
        chapters,
        'ch-1'
      )
    ).toBe('ch-3');

    expect(
      BookshelfStateService.resolveResumeChapterId(
        {
          novelId: 'orv',
          lastChapterId: 'missing',
          lastChapterNumber: 99,
          lastReadAtIso: '2026-03-29T18:05:00.000Z',
        },
        chapters,
        'ch-1'
      )
    ).toBe('ch-1');
  });
});
