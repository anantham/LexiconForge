import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import {
  ChapterOps,
  MaintenanceOps,
  SettingsOps,
} from '../../services/db/operations';
import {
  buildLibraryBookshelfKey,
  buildScopedStableId,
} from '../../services/libraryScope';

describe('scoped identity repair', () => {
  const novelId = 'forty-millenniums-of-cultivation';
  const versionId = 'v1-st-enhanced';
  const baseStableId = 'ch2_vtcb2d_td5t';
  const cleanStableId = buildScopedStableId(baseStableId, novelId, versionId);
  const nestedStableId = `lf-library:${encodeURIComponent(`${novelId}::${versionId}`)}:${cleanStableId}`;

  beforeEach(async () => {
    await MaintenanceOps.clearAllData();
  });

  afterEach(async () => {
    await MaintenanceOps.clearAllData();
  });

  it('collapses duplicate chapter identities and dedupes bookshelf state', async () => {
    await ChapterOps.store({
      stableId: cleanStableId,
      novelId,
      libraryVersionId: versionId,
      originalUrl: 'https://hetushu.com/book/2991/2051040.html',
      canonicalUrl: 'https://hetushu.com/book/2991/2051040.html',
      title: 'Chapter 2',
      content: 'Clean chapter content',
      chapterNumber: 2,
    });

    await ChapterOps.store({
      stableId: nestedStableId,
      novelId,
      libraryVersionId: versionId,
      originalUrl: 'https://hetushu.com/book/2991/2051040.html',
      canonicalUrl: 'https://hetushu.com/book/2991/2051040.html',
      title: 'Chapter 2',
      content: 'Nested duplicate content',
      chapterNumber: 2,
    });

    await SettingsOps.set('navigation-history', { stableIds: [nestedStableId, cleanStableId] });
    await SettingsOps.set('lastActiveChapter', { id: nestedStableId, url: 'https://hetushu.com/book/2991/2051040.html' });
    await SettingsOps.set('bookshelf-state', {
      [novelId]: {
        novelId,
        versionId,
        lastChapterId: nestedStableId,
        lastChapterNumber: 2,
        lastReadAtIso: '2026-04-09T11:00:00.000Z',
      },
      [buildLibraryBookshelfKey(novelId, versionId)]: {
        novelId,
        versionId,
        lastChapterId: cleanStableId,
        lastChapterNumber: 2,
        lastReadAtIso: '2026-04-09T11:10:00.000Z',
      },
    });

    const result = await MaintenanceOps.repairScopedStableIdDuplicates();

    expect(result.groupsRepaired).toBeGreaterThanOrEqual(1);
    expect(result.chaptersDeleted).toBeGreaterThanOrEqual(1);
    expect(result.bookshelfEntriesUpdated).toBeGreaterThanOrEqual(1);

    const chapters = await ChapterOps.getAll();
    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.stableId).toBe(cleanStableId);

    const clean = await ChapterOps.getByStableId(cleanStableId);
    const nested = await ChapterOps.getByStableId(nestedStableId);
    expect(clean).toBeTruthy();
    expect(nested).toBeNull();

    const navigationHistory = await SettingsOps.getKey<{ stableIds: string[] }>('navigation-history');
    expect(navigationHistory?.stableIds).toEqual([cleanStableId]);

    const lastActive = await SettingsOps.getKey<{ id: string }>('lastActiveChapter');
    expect(lastActive?.id).toBe(cleanStableId);

    const bookshelfState = await SettingsOps.getKey<Record<string, any>>('bookshelf-state');
    expect(Object.keys(bookshelfState || {})).toEqual([buildLibraryBookshelfKey(novelId, versionId)]);
    expect(bookshelfState?.[buildLibraryBookshelfKey(novelId, versionId)]?.lastChapterId).toBe(cleanStableId);
  });

  it('merges unscoped and scoped bookshelf entries correctly', async () => {
    // Scenario: User has an old unscoped entry and a newer scoped entry for the same novel
    const oldUnscopedEntry = {
      novelId,
      lastChapterId: 'unscoped-id',
      lastChapterNumber: 1,
      lastReadAtIso: '2026-04-09T10:00:00.000Z',
    };
    const newScopedEntry = {
      novelId,
      versionId,
      lastChapterId: cleanStableId,
      lastChapterNumber: 2,
      lastReadAtIso: '2026-04-09T11:00:00.000Z',
    };

    await SettingsOps.set('bookshelf-state', {
      [novelId]: oldUnscopedEntry,
      [buildLibraryBookshelfKey(novelId, versionId)]: newScopedEntry,
    });

    const result = await MaintenanceOps.repairScopedStableIdDuplicates();
    expect(result.bookshelfEntriesUpdated).toBeGreaterThanOrEqual(1);

    const bookshelfState = await SettingsOps.getKey<Record<string, any>>('bookshelf-state');
    const keys = Object.keys(bookshelfState || {});
    expect(keys).toHaveLength(1);
    expect(keys[0]).toBe(buildLibraryBookshelfKey(novelId, versionId));
    
    const winner = bookshelfState?.[keys[0]];
    expect(winner.lastChapterId).toBe(cleanStableId);
    expect(winner.versionId).toBe(versionId);
  });
});
