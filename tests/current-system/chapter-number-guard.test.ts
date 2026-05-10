import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { ChapterOps, MaintenanceOps } from '../../services/db/operations';
import { buildScopedStableId } from '../../services/libraryScope';

const novelId = 'forty-millenniums-of-cultivation';
const versionId = 'v1-st-enhanced';
const sid = (bare: string) => buildScopedStableId(bare, novelId, versionId);

describe('setChapterNumberByStableId guard (issue #20)', () => {
  beforeEach(async () => {
    await MaintenanceOps.clearAllData();
  });
  afterEach(async () => {
    await MaintenanceOps.clearAllData();
  });

  it('refuses write when argument disagrees with stableId baseHash', async () => {
    const bare = 'ch339_60hkvy_65g6';
    await ChapterOps.store({
      stableId: sid(bare),
      novelId,
      libraryVersionId: versionId,
      originalUrl: 'https://example.com/339',
      canonicalUrl: 'https://example.com/339',
      title: 'Chapter 339',
      content: 'body',
      chapterNumber: 339,
    });

    // The corrupting call: ch339_* but try to set 341
    await ChapterOps.setChapterNumberByStableId(sid(bare), 341);

    const ch = await ChapterOps.getByStableId(sid(bare));
    expect(ch?.chapterNumber).toBe(339); // untouched, write refused
  });

  it('allows write when argument matches stableId baseHash', async () => {
    const bare = 'ch500_xxxx_yyyy';
    await ChapterOps.store({
      stableId: sid(bare),
      novelId,
      libraryVersionId: versionId,
      originalUrl: 'https://example.com/500',
      canonicalUrl: 'https://example.com/500',
      title: 'Chapter 500',
      content: 'body',
      chapterNumber: undefined,
    });

    await ChapterOps.setChapterNumberByStableId(sid(bare), 500);

    const ch = await ChapterOps.getByStableId(sid(bare));
    expect(ch?.chapterNumber).toBe(500);
  });

  it('allows write when stableId does not match chN_ pattern (legacy/non-FMC)', async () => {
    const legacyId = 'some-legacy-stable-id-no-pattern';
    await ChapterOps.store({
      stableId: legacyId,
      novelId,
      libraryVersionId: versionId,
      originalUrl: 'https://example.com/legacy',
      canonicalUrl: 'https://example.com/legacy',
      title: 'Legacy Chapter',
      content: 'body',
      chapterNumber: 1,
    });

    // No baseHash to compare against — write proceeds
    await ChapterOps.setChapterNumberByStableId(legacyId, 42);

    const ch = await ChapterOps.getByStableId(legacyId);
    expect(ch?.chapterNumber).toBe(42);
  });
});
