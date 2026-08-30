import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChapterOps, MaintenanceOps } from '../../../services/db/operations';

describe('ChapterOps.findByNumber', () => {
  beforeEach(async () => {
    await MaintenanceOps.clearAllData();
  });

  afterEach(async () => {
    await MaintenanceOps.clearAllData();
  });

  it('finds an unversioned scoped chapter without constructing a null compound key', async () => {
    await ChapterOps.store({
      stableId: 'unversioned-chapter-12',
      novelId: 'unversioned-novel',
      libraryVersionId: null,
      originalUrl: 'https://example.test/unversioned/12',
      canonicalUrl: 'lexiconforge://unversioned-novel/chapter/12',
      title: 'Chapter 12',
      content: 'Readable unversioned chapter.',
      chapterNumber: 12,
    });

    const found = await ChapterOps.findByNumber(12, 'unversioned-novel', null);

    expect(found?.stableId).toBe('unversioned-chapter-12');
    expect(found?.novelId).toBe('unversioned-novel');
    expect(found?.libraryVersionId).toBeNull();
  });

  it('keeps versioned chapter-number lookup scoped to the compound index', async () => {
    await ChapterOps.store({
      stableId: 'version-one-chapter-12',
      novelId: 'versioned-novel',
      libraryVersionId: 'v1',
      originalUrl: 'https://example.test/version-one/12',
      canonicalUrl: 'lexiconforge://versioned-novel/chapter/12',
      title: 'Version one chapter 12',
      content: 'Version one.',
      chapterNumber: 12,
    });
    await ChapterOps.store({
      stableId: 'version-two-chapter-12',
      novelId: 'versioned-novel',
      libraryVersionId: 'v2',
      originalUrl: 'https://example.test/version-two/12',
      canonicalUrl: 'lexiconforge://versioned-novel/chapter/12',
      title: 'Version two chapter 12',
      content: 'Version two.',
      chapterNumber: 12,
    });

    const found = await ChapterOps.findByNumber(12, 'versioned-novel', 'v2');

    expect(found?.stableId).toBe('version-two-chapter-12');
    expect(found?.libraryVersionId).toBe('v2');
  });
});
