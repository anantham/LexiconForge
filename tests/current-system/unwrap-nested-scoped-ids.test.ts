import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import {
  ChapterOps,
  MaintenanceOps,
  SettingsOps,
  TranslationOps,
} from '../../services/db/operations';
import {
  buildLibraryBookshelfKey,
  buildScopedStableId,
} from '../../services/libraryScope';
import { getConnection } from '../../services/db/core/connection';
import { STORE_NAMES } from '../../services/db/core/schema';
import { promisifyRequest } from '../../services/db/core/txn';
import type { TranslationRecord } from '../../services/db/types';

const insertTranslation = async (record: TranslationRecord) => {
  const conn = await getConnection();
  await new Promise<void>((resolve, reject) => {
    const tx = conn.transaction([STORE_NAMES.TRANSLATIONS], 'readwrite');
    const req = tx.objectStore(STORE_NAMES.TRANSLATIONS).put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

const novelId = 'forty-millenniums-of-cultivation';
const canonicalVersion = 'v1-st-enhanced';
const legacyVersion = 'v1-composite';

const cleanStableId = (bare: string, version: string) =>
  `lf-library:${encodeURIComponent(`${novelId}::${version}`)}:${bare}`;

const nestedTwoLayer = (bare: string, outerVersion: string, innerVersion: string) =>
  `lf-library:${encodeURIComponent(`${novelId}::${outerVersion}`)}:${cleanStableId(
    bare,
    innerVersion
  )}`;

const cleanUrl = (bare: string, version: string) =>
  `lf-library://${encodeURIComponent(`${novelId}::${version}`)}/${encodeURIComponent(bare)}`;

const nestedUrl = (bare: string, outerVersion: string, innerVersion: string) =>
  `lf-library://${encodeURIComponent(`${novelId}::${outerVersion}`)}/${encodeURIComponent(
    cleanStableId(bare, innerVersion)
  )}`;

describe('unwrapNestedScopedIds (V4)', () => {
  beforeEach(async () => {
    await MaintenanceOps.clearAllData();
  });

  afterEach(async () => {
    await MaintenanceOps.clearAllData();
  });

  it('dry-run produces a plan without writing anything', async () => {
    const bare = 'ch1000_clji3_3qll';
    const oldId = nestedTwoLayer(bare, canonicalVersion, legacyVersion);

    await ChapterOps.store({
      stableId: oldId,
      novelId,
      libraryVersionId: canonicalVersion,
      originalUrl: 'lexiconforge://forty-millenniums-of-cultivation/chapter/1000',
      canonicalUrl: 'lexiconforge://forty-millenniums-of-cultivation/chapter/1000',
      title: 'Chapter 1000',
      content: 'content body',
      chapterNumber: 1000,
    });

    const report = await MaintenanceOps.unwrapNestedScopedIds({
      dryRun: true,
      canonicalVersions: { [novelId]: canonicalVersion },
    });

    expect(report.dryRun).toBe(true);
    expect(report.totals.chaptersScanned).toBe(1);
    expect(report.totals.chaptersWithNestedIds).toBe(1);
    expect(report.totals.chaptersToRewrite).toBe(1);
    expect(report.rewriteSample[0]?.bareHash).toBe(bare);
    expect(report.rewriteSample[0]?.newStableId).toBe(cleanStableId(bare, canonicalVersion));

    // No writes happened
    const chapters = await ChapterOps.getAll();
    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.stableId).toBe(oldId);
    const flag = await SettingsOps.getKey<boolean>('chapterIdsUnwrappedV4');
    expect(flag).toBeFalsy();
  });

  it('commit unwraps double-scoped row and re-keys references', async () => {
    const bare = 'ch1000_clji3_3qll';
    const oldId = nestedTwoLayer(bare, canonicalVersion, legacyVersion);
    const oldUrl = nestedUrl(bare, canonicalVersion, legacyVersion);
    const expectedNewId = cleanStableId(bare, canonicalVersion);
    const expectedNewUrl = cleanUrl(bare, canonicalVersion);

    await ChapterOps.store({
      stableId: oldId,
      novelId,
      libraryVersionId: canonicalVersion,
      originalUrl: 'lexiconforge://forty-millenniums-of-cultivation/chapter/1000',
      canonicalUrl: 'lexiconforge://forty-millenniums-of-cultivation/chapter/1000',
      title: 'Chapter 1000: Five',
      content: 'long content',
      chapterNumber: 1000,
    });

    await SettingsOps.set('navigation-history', { stableIds: [oldId] });
    await SettingsOps.set('lastActiveChapter', { id: oldId, url: oldUrl });
    await SettingsOps.set('bookshelf-state', {
      [`${novelId}::${legacyVersion}`]: {
        novelId,
        versionId: legacyVersion,
        lastChapterId: oldId,
        lastChapterNumber: 1000,
        lastReadAtIso: '2026-04-09T03:11:27.750Z',
      },
    });

    const report = await MaintenanceOps.unwrapNestedScopedIds({
      dryRun: false,
      force: true,
      canonicalVersions: { [novelId]: canonicalVersion },
    });

    expect(report.dryRun).toBe(false);
    expect(report.totals.chaptersToRewrite).toBe(1);

    const chapters = await ChapterOps.getAll();
    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.stableId).toBe(expectedNewId);
    expect(chapters[0]?.url).toBe(expectedNewUrl);
    expect(chapters[0]?.libraryVersionId).toBe(canonicalVersion);

    const nav = await SettingsOps.getKey<{ stableIds: string[] }>('navigation-history');
    expect(nav?.stableIds).toEqual([expectedNewId]);

    const last = await SettingsOps.getKey<{ id: string }>('lastActiveChapter');
    expect(last?.id).toBe(expectedNewId);

    const shelf = await SettingsOps.getKey<Record<string, any>>('bookshelf-state');
    const expectedKey = buildLibraryBookshelfKey(novelId, canonicalVersion);
    expect(Object.keys(shelf || {})).toEqual([expectedKey]);
    expect(shelf?.[expectedKey]?.lastChapterId).toBe(expectedNewId);

    const flag = await SettingsOps.getKey<boolean>('chapterIdsUnwrappedV4');
    expect(flag).toBe(true);
  });

  it('regression: pre-existing canonical translation does not collide on stableId_version index', async () => {
    // Real-world failure mode: chapter has 3 translations across 3 stableIds,
    // one of which is ALREADY canonical. Bug: bucket missed the canonical row,
    // remapped rows got version=1, collided with existing canonical version=1
    // on the unique index.
    const bare = 'ch1_uo070x_2xjw';
    const legacyId = cleanStableId(bare, legacyVersion);                                  // v1-composite
    const nestedCanonical = nestedTwoLayer(bare, canonicalVersion, legacyVersion);        // v1-st-enhanced(v1-composite)
    const cleanCanonical = cleanStableId(bare, canonicalVersion);                         // already canonical

    await ChapterOps.store({
      stableId: cleanCanonical,
      novelId,
      libraryVersionId: canonicalVersion,
      originalUrl: 'https://hetushu.com/book/2991/2051039.html',
      canonicalUrl: 'https://hetushu.com/book/2991/2051039.html',
      title: '第1章 新的冲突',
      content: 'chinese raw',
      chapterNumber: 1,
    });
    await ChapterOps.store({
      stableId: legacyId,
      novelId,
      libraryVersionId: legacyVersion,
      originalUrl: 'https://hetushu.com/book/2991/2051039.html',
      canonicalUrl: 'https://hetushu.com/book/2991/2051039.html',
      title: '第1章 新的冲突',
      content: 'chinese raw',
      chapterNumber: 1,
    });
    await ChapterOps.store({
      stableId: nestedCanonical,
      novelId,
      libraryVersionId: canonicalVersion,
      originalUrl: 'https://hetushu.com/book/2991/2051039.html',
      canonicalUrl: 'https://hetushu.com/book/2991/2051039.html',
      title: '第1章 新的冲突',
      content: 'chinese raw',
      chapterNumber: 1,
    });

    // 3 translations, all version=1, distributed across the 3 stableIds
    await insertTranslation({
      id: 'tr-already-canonical',
      stableId: cleanCanonical,
      chapterUrl: cleanUrl(bare, canonicalVersion),
      version: 1,
      translatedTitle: 'Chapter 1 — Canonical (newest)',
      translation: 'newest', footnotes: [], suggestedIllustrations: [],
      provider: 'OpenRouter', model: 'm', temperature: 0.5, systemPrompt: 's',
      totalTokens: 1, promptTokens: 1, completionTokens: 0, estimatedCost: 0, requestTime: 1,
      createdAt: '2026-04-09T15:42:23.897Z', isActive: true,
    });
    await insertTranslation({
      id: 'tr-from-legacy',
      stableId: legacyId,
      chapterUrl: cleanUrl(bare, legacyVersion),
      version: 1,
      translatedTitle: 'Chapter 1 — From Legacy',
      translation: 'legacy', footnotes: [], suggestedIllustrations: [],
      provider: 'OpenRouter', model: 'm', temperature: 0.5, systemPrompt: 's',
      totalTokens: 1, promptTokens: 1, completionTokens: 0, estimatedCost: 0, requestTime: 1,
      createdAt: '2026-04-05T10:00:00.000Z', isActive: true,
    });
    await insertTranslation({
      id: 'tr-from-nested',
      stableId: nestedCanonical,
      chapterUrl: nestedUrl(bare, canonicalVersion, legacyVersion),
      version: 1,
      translatedTitle: 'Chapter 1 — From Nested',
      translation: 'nested', footnotes: [], suggestedIllustrations: [],
      provider: 'OpenRouter', model: 'm', temperature: 0.5, systemPrompt: 's',
      totalTokens: 1, promptTokens: 1, completionTokens: 0, estimatedCost: 0, requestTime: 1,
      createdAt: '2026-04-06T19:00:00.000Z', isActive: true,
    });

    // Pre-fix this would throw ConstraintError
    const report = await MaintenanceOps.unwrapNestedScopedIds({
      dryRun: false,
      force: true,
      canonicalVersions: { [novelId]: canonicalVersion },
    });

    expect(report.dryRun).toBe(false);
    const all = await TranslationOps.getAll();
    const forBare = all.filter(t => t.stableId === cleanCanonical);
    expect(forBare).toHaveLength(3);
    expect(forBare.map(t => t.id).sort()).toEqual([
      'tr-already-canonical', 'tr-from-legacy', 'tr-from-nested',
    ]);
    // All on canonical stableId, distinct versions (no index collision)
    const versions = forBare.map(t => t.version).sort();
    expect(versions).toEqual([1, 2, 3]);
    // Most recent createdAt wins active
    const active = forBare.find(t => t.isActive);
    expect(active?.id).toBe('tr-already-canonical');
  });

  it('collision: legacy scope and canonical scope merge, translations preserved', async () => {
    const bare = 'ch500_xxxx_yyyy';
    const legacyId = cleanStableId(bare, legacyVersion);
    const canonicalNestedId = nestedTwoLayer(bare, canonicalVersion, legacyVersion);

    // Two rows: same bare hash, one in legacy scope, one nested in canonical wrapping legacy
    await ChapterOps.store({
      stableId: legacyId,
      novelId,
      libraryVersionId: legacyVersion,
      originalUrl: 'lexiconforge://forty-millenniums-of-cultivation/chapter/500',
      canonicalUrl: 'lexiconforge://forty-millenniums-of-cultivation/chapter/500',
      title: 'Chapter 500',
      content: 'longer content here for legacy row',
      chapterNumber: 500,
    });
    await ChapterOps.store({
      stableId: canonicalNestedId,
      novelId,
      libraryVersionId: canonicalVersion,
      originalUrl: 'lexiconforge://forty-millenniums-of-cultivation/chapter/500',
      canonicalUrl: 'lexiconforge://forty-millenniums-of-cultivation/chapter/500',
      title: 'Chapter 500',
      content: 'shorter',
      chapterNumber: 500,
    });

    // Translation under each
    await insertTranslation({
      id: 'tr-legacy',
      stableId: legacyId,
      chapterUrl: cleanUrl(bare, legacyVersion),
      version: 1,
      translatedTitle: 'Chapter 500 — From Legacy',
      translation: 'legacy translation body',
      footnotes: [],
      suggestedIllustrations: [],
      provider: 'OpenRouter',
      model: 'm',
      temperature: 0.5,
      systemPrompt: 's',
      totalTokens: 1,
      promptTokens: 1,
      completionTokens: 0,
      estimatedCost: 0,
      requestTime: 1,
      createdAt: '2026-04-08T00:00:00.000Z',
      isActive: true,
    });
    await insertTranslation({
      id: 'tr-canonical',
      stableId: canonicalNestedId,
      chapterUrl: nestedUrl(bare, canonicalVersion, legacyVersion),
      version: 1,
      translatedTitle: 'Chapter 500 — From Canonical Nested',
      translation: 'canonical translation body',
      footnotes: [],
      suggestedIllustrations: [],
      provider: 'OpenRouter',
      model: 'm',
      temperature: 0.5,
      systemPrompt: 's',
      totalTokens: 1,
      promptTokens: 1,
      completionTokens: 0,
      estimatedCost: 0,
      requestTime: 1,
      createdAt: '2026-04-09T00:00:00.000Z',
      isActive: true,
    });

    const report = await MaintenanceOps.unwrapNestedScopedIds({
      dryRun: false,
      force: true,
      canonicalVersions: { [novelId]: canonicalVersion },
    });

    expect(report.totals.collisionGroups).toBe(1);
    expect(report.totals.chaptersDeleted).toBe(1);

    const chapters = await ChapterOps.getAll();
    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.stableId).toBe(cleanStableId(bare, canonicalVersion));

    // Both translations preserved, both re-keyed onto canonical, both kept (versions deduped)
    const all = await TranslationOps.getAll();
    const forBare = all.filter(t => t.stableId === cleanStableId(bare, canonicalVersion));
    expect(forBare).toHaveLength(2);
    expect(forBare.map(t => t.id).sort()).toEqual(['tr-canonical', 'tr-legacy']);
    const versions = forBare.map(t => t.version).sort();
    expect(versions).toEqual([1, 2]); // renumbered to avoid collision
    // Most recent createdAt becomes active
    const active = forBare.find(t => t.isActive);
    expect(active?.id).toBe('tr-canonical');
  });

  it('does not merge rows with different bare baseHashes (multi-source pollution)', async () => {
    const bareEnglish = 'ch1_bn2z8g_3q2o';
    const bareChinese = 'ch1_uo070x_2xjw';
    const idEnglish = cleanStableId(bareEnglish, legacyVersion);
    const idChinese = nestedTwoLayer(bareChinese, legacyVersion, legacyVersion);

    await ChapterOps.store({
      stableId: idEnglish,
      novelId,
      libraryVersionId: legacyVersion,
      originalUrl: 'lexiconforge://forty-millenniums-of-cultivation/chapter/1',
      canonicalUrl: 'lexiconforge://forty-millenniums-of-cultivation/chapter/1',
      title: 'Chapter 1: Artifact Graveyard',
      content: 'english content',
      chapterNumber: 1,
    });
    await ChapterOps.store({
      stableId: idChinese,
      novelId,
      libraryVersionId: legacyVersion,
      originalUrl: 'https://hetushu.com/book/2991/2051039.html',
      canonicalUrl: 'https://hetushu.com/book/2991/2051039.html',
      title: '第1章 新的冲突',
      content: 'chinese raw content',
      chapterNumber: 1,
    });

    const report = await MaintenanceOps.unwrapNestedScopedIds({
      dryRun: false,
      force: true,
      canonicalVersions: { [novelId]: canonicalVersion },
    });

    // Both rows rewritten to canonical scope, but bare hashes differ → no collision
    expect(report.totals.collisionGroups).toBe(0);
    expect(report.totals.chaptersDeleted).toBe(0);

    const chapters = await ChapterOps.getAll();
    expect(chapters).toHaveLength(2);
    const stableIds = chapters.map(c => c.stableId).sort();
    expect(stableIds).toEqual(
      [
        cleanStableId(bareChinese, canonicalVersion),
        cleanStableId(bareEnglish, canonicalVersion),
      ].sort()
    );
  });

  it('rows whose novelId is not in canonicalVersions are reported as orphans', async () => {
    const bare = 'ch1_xxxx_yyyy';
    const otherNovel = 'unknown-novel';
    await ChapterOps.store({
      stableId: cleanStableId(bare, canonicalVersion).replace(novelId, otherNovel),
      novelId: otherNovel,
      libraryVersionId: canonicalVersion,
      originalUrl: 'https://example.com/1',
      canonicalUrl: 'https://example.com/1',
      title: 'foo',
      content: 'bar',
      chapterNumber: 1,
    });

    const report = await MaintenanceOps.unwrapNestedScopedIds({
      dryRun: true,
      canonicalVersions: { [novelId]: canonicalVersion },
    });

    expect(report.orphans.novelsNotInCanonicalMap).toEqual([otherNovel]);
    expect(report.totals.chaptersToRewrite).toBe(0);
  });

  it('flag gates re-runs unless force=true', async () => {
    const bare = 'ch99_xxxx_yyyy';
    const oldId = nestedTwoLayer(bare, canonicalVersion, legacyVersion);
    await ChapterOps.store({
      stableId: oldId,
      novelId,
      libraryVersionId: canonicalVersion,
      originalUrl: 'u',
      canonicalUrl: 'u',
      title: 't',
      content: 'c',
      chapterNumber: 99,
    });

    await MaintenanceOps.unwrapNestedScopedIds({
      dryRun: false,
      force: true,
      canonicalVersions: { [novelId]: canonicalVersion },
    });
    const flag = await SettingsOps.getKey<boolean>('chapterIdsUnwrappedV4');
    expect(flag).toBe(true);

    // Add another problematic row, run without force — should be skipped
    const bare2 = 'ch100_xxxx_yyyy';
    const oldId2 = nestedTwoLayer(bare2, canonicalVersion, legacyVersion);
    await ChapterOps.store({
      stableId: oldId2,
      novelId,
      libraryVersionId: canonicalVersion,
      originalUrl: 'u2',
      canonicalUrl: 'u2',
      title: 't2',
      content: 'c2',
      chapterNumber: 100,
    });

    const skipped = await MaintenanceOps.unwrapNestedScopedIds({
      dryRun: false,
      canonicalVersions: { [novelId]: canonicalVersion },
    });
    expect(skipped.flagAlreadySet).toBe(true);
    // Row 2 should still have the nested id
    const ch2 = await ChapterOps.getByStableId(oldId2);
    expect(ch2).toBeTruthy();
  });
});
