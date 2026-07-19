import type {
  AmendmentLogRecord,
  ChapterRecord,
  ChapterSummaryRecord,
  FeedbackRecord,
  TranslationRecord,
  UrlMappingRecord,
} from '../types';
import type { DiffResult } from '../../diff/types';
import { generateStableChapterId, normalizeUrlAggressively } from '../../stableIdService';
import { DB_NAME, getConnection, resetConnection } from '../core/connection';
import { STORE_NAMES } from '../core/schema';
import { withWriteTxn, withReadTxn, promisifyRequest } from '../core/txn';
import { SettingsOps } from './settings';
import {
  buildLibraryScopeKey,
  buildScopedStorageUrl,
  isLibraryStorageUrl,
  isScopedStableId,
  parseScopedStableId,
} from '../../libraryScope';
import { debugLog, debugWarn } from '../../../utils/debug';

import {
  recomputeSummary,
  deleteSummary,
  buildSummaryRecord,
  fetchChapterSummaries,
  syncAllChapterSummaries,
} from './summaries';
import { ChapterOps } from './chapters';
import { TranslationOps } from './translations';

const URL_MAPPINGS_BACKFILL_VERSION = 2;
const SETTINGS = {
  URL_BACKFILL_VERSION: 'urlMappingsBackfillVersion',
  URL_BACKFILL_FLAG: 'urlMappingsBackfilled',
  STABLE_ID_NORMALIZED: 'stableIdNormalized',
  ACTIVE_TRANSLATIONS_V2: 'activeTranslationsBackfilledV2',
  TRANSLATION_METADATA_BACKFILLED: 'translationMetadataBackfilled',
  NOVEL_ID_BACKFILLED: 'novelIdBackfilled',
  SUMMARY_NOVEL_ID_BACKFILLED: 'summaryNovelIdBackfilled',
  SCOPED_IDENTITY_REPAIRED_V2: 'scopedStableIdRepairV2',
  SUMMARIES_SYNCED: 'summariesSyncedV2',
  BOOKSHELF_DEDUPED_V3: 'bookshelfDedupedV3',
  CHAPTER_IDS_UNWRAPPED_V4: 'chapterIdsUnwrappedV4',
  CHAPTER_NUMBER_CORRECTED_V5: 'chapterNumberCorrectedV5',
} as const;

const BARE_HASH_PATTERN = /^ch[0-9]+_/;

const nowIso = () => new Date().toISOString();

export interface AuditReferenceCounts {
  summaries: number;
  translations: number;
  feedback: number;
  amendments: number;
  diffResults: number;
  urlMappings: number;
  bookshelfEntries: number;
  navigationHistoryEntries: number;
}

export interface AuditDuplicateMember {
  stableId: string;
  idForm: 'bare' | 'scoped-encoded' | 'scoped-nested' | 'unknown';
  titleSnippet: string;
  titleLength: number;
  contentHash: string;
  contentLength: number;
  hasTranslation: boolean;
  translationCount: number;
  canonicalUrl: string | null;
  originalUrl: string | null;
  novelId: string | null;
  libraryVersionId: string | null;
  lastAccessed: string | null;
  referencedBy: AuditReferenceCounts;
}

export interface AuditDuplicateGroup {
  key: { novelId: string; versionId: string | null; chapterNumber: number };
  stableIds: string[];
  members: AuditDuplicateMember[];
}

export interface AuditOrphanedReferences {
  summariesWithoutChapter: string[];
  translationsWithoutChapter: string[];
  feedbackWithoutChapter: number;
  bookshelfPointingAtMissing: string[];
  navigationPointingAtMissing: string[];
  amendmentsPointingAtMissing: string[];
}

export interface ChapterIdentityAuditReport {
  schemaVersion: '1';
  generatedAt: string;
  totals: {
    chapters: number;
    summaries: number;
    translations: number;
    urlMappings: number;
    feedbackEntries: number;
    amendmentLogs: number;
    diffResults: number;
    bookshelfEntries: number;
    navigationHistoryEntries: number;
    lastActiveChapterPresent: boolean;
  };
  duplicateGroups: AuditDuplicateGroup[];
  categorization: {
    legacyUnscopedPlusScoped: number;
    contentDriftWithinScope: number;
    titleDriftWithinScope: number;
    urlVariation: number;
    nullScopeRows: number;
  };
  orphanedReferences: AuditOrphanedReferences;
  estimatedDuplicateLoad: {
    duplicateGroups: number;
    redundantChapterRows: number;
    redundantSummaryRows: number;
    redundantTranslationRows: number;
  };
}

export interface UnwrapOptions {
  /** Default true. When true, scans IDB and returns a plan without writing. */
  dryRun?: boolean;
  /**
   * Per-novel canonical libraryVersionId. Rows whose novelId is not in this map
   * are reported as orphans and skipped. Example:
   *   { 'forty-millenniums-of-cultivation': 'v1-st-enhanced' }
   */
  canonicalVersions: Record<string, string>;
  /** When true, ignore the CHAPTER_IDS_UNWRAPPED_V4 flag and re-run anyway. */
  force?: boolean;
  /** Limit the number of rewrite rows in the returned sample (default 25). */
  sampleLimit?: number;
}

export interface UnwrapRewrite {
  oldStableId: string;
  newStableId: string;
  bareHash: string;
  novelId: string;
  oldVersionId: string | null;
  newVersionId: string;
  chapterNumber: number | null;
  titleSnippet: string;
  url: string;
  newUrl: string;
  hasNestedScope: boolean;
}

export interface UnwrapCollision {
  newStableId: string;
  bareHash: string;
  novelId: string;
  chapterNumber: number | null;
  members: Array<{
    oldStableId: string;
    contentLength: number;
    titleSnippet: string;
    translationCount: number;
    activeTranslationCount: number;
    lastAccessed: string | null;
  }>;
  chosenSurvivorOldStableId: string;
}

export interface UnwrapReport {
  schemaVersion: '1';
  generatedAt: string;
  dryRun: boolean;
  flagAlreadySet: boolean;
  canonicalVersions: Record<string, string>;
  totals: {
    chaptersScanned: number;
    chaptersWithNestedIds: number;
    chaptersToRewrite: number;
    collisionGroups: number;
    chaptersDeleted: number;
    translationsRekeyed: number;
    summariesRekeyed: number;
    urlMappingsRekeyed: number;
    amendmentsRekeyed: number;
    diffResultsRekeyed: number;
    bookshelfEntriesRekeyed: number;
    navigationEntriesRekeyed: number;
    lastActiveRekeyed: boolean;
  };
  orphans: {
    rowsWithoutNovelId: string[];
    novelsNotInCanonicalMap: string[];
    malformedBareHashes: Array<{ stableId: string; resolvedBare: string | null }>;
    translationsWithoutChapter: Array<{ id: string; stableId: string; chapterUrl: string }>;
    amendmentsWithoutChapter: Array<{ id: string; chapterId: string | null }>;
  };
  rewriteSample: UnwrapRewrite[];
  collisions: UnwrapCollision[];
}

type ScopedIdentityRepairSummary = {
  groupsRepaired: number;
  chaptersDeleted: number;
  translationsMoved: number;
  urlMappingsUpdated: number;
  feedbackUpdated: number;
  amendmentLogsUpdated: number;
  diffResultsUpdated: number;
  navigationEntriesUpdated: number;
  lastActiveUpdated: boolean;
  bookshelfEntriesUpdated: number;
};

type DuplicateChapterGroup = {
  fingerprint: string;
  targetStableId: string;
  targetUrl: string;
  survivor: ChapterRecord;
  duplicates: ChapterRecord[];
  chapterRecords: ChapterRecord[];
};

const summarizeScope = (novelId: string | null | undefined, libraryVersionId: string | null | undefined): string => {
  return novelId ? buildLibraryScopeKey(novelId, libraryVersionId ?? null) : 'unscoped';
};

const getScopedStableIdDepth = (stableId: string | null | undefined): number => {
  // Narrow to a non-null string up front (isScopedStableId is not a type guard),
  // matching peelAllScopes/collapseScopedStableId. isScopedStableId(null) is false,
  // so the added typeof check preserves the return-0 behavior for null/undefined.
  if (typeof stableId !== 'string' || !isScopedStableId(stableId)) {
    return 0;
  }

  let depth = 0;
  let current = stableId;
  const seen = new Set<string>();

  while (isScopedStableId(current) && !seen.has(current)) {
    seen.add(current);
    const parsed = parseScopedStableId(current);
    if (!parsed) break;
    depth += 1;
    current = parsed.baseStableId;
  }

  return depth;
};

/**
 * Strip ALL scope wrappers from a stableId, returning the bare base hash
 * (or the input unchanged if it was already bare). Unlike collapseScopedStableId,
 * this does not require inner/outer scopes to match — it peels regardless.
 *
 * Why: V4 corruption put scoped stableIds inside other scopes, sometimes with
 * mismatched novel/version. We need to find the true bare base so we can
 * re-canonicalize under one scope.
 *
 * Returns null only when input is null/undefined. If unwrap fails partway
 * (malformed scope), returns the deepest reachable string.
 */
const peelAllScopes = (stableId: string | null | undefined): string | null => {
  if (typeof stableId !== 'string' || stableId.length === 0) return null;
  let current = stableId;
  const seen = new Set<string>();
  while (isScopedStableId(current) && !seen.has(current)) {
    seen.add(current);
    try {
      const parsed = parseScopedStableId(current);
      if (!parsed) break;
      current = parsed.baseStableId;
    } catch {
      break;
    }
  }
  return current;
};

const isWellFormedBareHash = (s: string | null | undefined): boolean => {
  return typeof s === 'string' && BARE_HASH_PATTERN.test(s);
};

const collapseScopedStableId = (
  stableId: string | null | undefined,
  novelId: string | null | undefined,
  libraryVersionId: string | null | undefined
): string | null => {
  if (!stableId || !isScopedStableId(stableId) || !novelId) {
    return stableId ?? null;
  }

  const expectedScope = buildLibraryScopeKey(novelId, libraryVersionId ?? null);
  let current = stableId;
  const seen = new Set<string>();

  while (isScopedStableId(current) && !seen.has(current)) {
    seen.add(current);
    const parsed = parseScopedStableId(current);
    if (!parsed) {
      return current;
    }
    if (parsed.scopeKey !== expectedScope) {
      return current;
    }
    if (!isScopedStableId(parsed.baseStableId)) {
      return current;
    }
    current = parsed.baseStableId;
  }

  return current;
};

const buildDuplicateFingerprint = (chapter: ChapterRecord): string | null => {
  if (!chapter.novelId || !chapter.chapterNumber) {
    return null;
  }

  const canonicalSource =
    normalizeUrlAggressively(chapter.canonicalUrl || chapter.originalUrl || chapter.url) ||
    chapter.canonicalUrl ||
    chapter.originalUrl ||
    chapter.url;

  if (!canonicalSource) {
    return null;
  }

  return [
    chapter.novelId,
    chapter.libraryVersionId ?? '',
    String(chapter.chapterNumber),
    canonicalSource,
  ].join('::');
};

const chooseSurvivor = (
  chapters: ChapterRecord[],
  translationCounts: Map<string, number>,
  activeTranslationCounts: Map<string, number>
): ChapterRecord => {
  return [...chapters].sort((left, right) => {
    const leftDepth = getScopedStableIdDepth(left.stableId);
    const rightDepth = getScopedStableIdDepth(right.stableId);
    if (leftDepth !== rightDepth) return leftDepth - rightDepth;

    const leftActive = activeTranslationCounts.get(left.stableId || '') ?? 0;
    const rightActive = activeTranslationCounts.get(right.stableId || '') ?? 0;
    if (leftActive !== rightActive) return rightActive - leftActive;

    const leftTranslations = translationCounts.get(left.stableId || '') ?? 0;
    const rightTranslations = translationCounts.get(right.stableId || '') ?? 0;
    if (leftTranslations !== rightTranslations) return rightTranslations - leftTranslations;

    const leftLength = (left.stableId || '').length;
    const rightLength = (right.stableId || '').length;
    if (leftLength !== rightLength) return leftLength - rightLength;

    return (left.dateAdded || '').localeCompare(right.dateAdded || '');
  })[0];
};

const mergeChapterRecords = (
  targetStableId: string,
  targetUrl: string,
  chapters: ChapterRecord[]
): ChapterRecord => {
  const sorted = [...chapters].sort((left, right) => {
    const leftDepth = getScopedStableIdDepth(left.stableId);
    const rightDepth = getScopedStableIdDepth(right.stableId);
    if (leftDepth !== rightDepth) return leftDepth - rightDepth;
    return (left.dateAdded || '').localeCompare(right.dateAdded || '');
  });
  const primary = sorted[0];
  const longestContent = [...chapters].sort(
    (left, right) => (right.content?.length || 0) - (left.content?.length || 0)
  )[0];

  const canonicalUrl =
    sorted
      .map(chapter => normalizeUrlAggressively(chapter.canonicalUrl || chapter.originalUrl || chapter.url) || chapter.canonicalUrl || chapter.originalUrl || chapter.url)
      .find(Boolean) || primary.canonicalUrl || primary.originalUrl || primary.url;

  const originalUrl =
    sorted
      .map(chapter => chapter.originalUrl || chapter.canonicalUrl || chapter.url)
      .find(Boolean) || canonicalUrl;

  return {
    ...primary,
    url: targetUrl,
    stableId: targetStableId,
    title: sorted.map(chapter => chapter.title).find(title => Boolean(title)) || primary.title,
    content: longestContent?.content || primary.content || '',
    originalUrl,
    canonicalUrl,
    nextUrl: sorted.map(chapter => chapter.nextUrl).find(Boolean),
    prevUrl: sorted.map(chapter => chapter.prevUrl).find(Boolean),
    fanTranslation: sorted.map(chapter => chapter.fanTranslation).find(Boolean),
    suttaStudio: sorted.map(chapter => chapter.suttaStudio).find(value => value != null) ?? null,
    chapterNumber: sorted.map(chapter => chapter.chapterNumber).find(value => typeof value === 'number'),
    dateAdded: sorted
      .map(chapter => chapter.dateAdded)
      .filter(Boolean)
      .sort()[0] || primary.dateAdded || nowIso(),
    lastAccessed: sorted
      .map(chapter => chapter.lastAccessed)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || primary.lastAccessed || nowIso(),
  };
};

const translationCreatedAtValue = (record: TranslationRecord): number => {
  const parsed = Date.parse(record.createdAt || '');
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildDiffResultKey = (record: DiffResult): [string, string, string, string, string] => {
  return [
    record.chapterId,
    record.aiVersionId,
    record.fanVersionId ?? '',
    record.rawVersionId,
    record.algoVersion,
  ];
};

const buildUrlMappingEntries = (record: ChapterRecord): UrlMappingRecord[] => {
  const stableId =
    record.stableId ||
    generateStableChapterId(record.content || '', record.chapterNumber || 0, record.title || '');
  if (!stableId) return [];

  const canonical =
    record.canonicalUrl ||
    normalizeUrlAggressively(record.originalUrl || record.url) ||
    record.url;
  const original = record.originalUrl || record.url;
  const timestamp = nowIso();
  const entries: UrlMappingRecord[] = [];

  if (canonical) {
    entries.push({
      url: canonical,
      stableId,
      novelId: record.novelId ?? null,
      chapterNumber: record.chapterNumber,
      isCanonical: true,
      dateAdded: timestamp,
    });
  }
  if (original && original !== canonical) {
    entries.push({
      url: original,
      stableId,
      novelId: record.novelId ?? null,
      chapterNumber: record.chapterNumber,
      isCanonical: false,
      dateAdded: timestamp,
    });
  }
  return entries;
};

export class MaintenanceOps {
  static async backfillUrlMappingsFromChapters(): Promise<void> {
    const currentVersion = await SettingsOps.getKey<number>(SETTINGS.URL_BACKFILL_VERSION);
    if (currentVersion && currentVersion >= URL_MAPPINGS_BACKFILL_VERSION) {
      return;
    }

    await withWriteTxn(
      [STORE_NAMES.CHAPTERS, STORE_NAMES.URL_MAPPINGS],
      async (_txn, stores) => {
        const chaptersStore = stores[STORE_NAMES.CHAPTERS];
        const mappingsStore = stores[STORE_NAMES.URL_MAPPINGS];
        const chapters = (await promisifyRequest(chaptersStore.getAll())) as ChapterRecord[];

        for (const chapter of chapters) {
          if (!chapter) continue;
          if (!chapter.stableId) {
            chapter.stableId = generateStableChapterId(
              chapter.content || '',
              chapter.chapterNumber || 0,
              chapter.title || ''
            );
          }
          chapter.canonicalUrl =
            chapter.canonicalUrl ||
            normalizeUrlAggressively(chapter.originalUrl || chapter.url) ||
            chapter.url;
          await promisifyRequest(chaptersStore.put(chapter));

          const entries = buildUrlMappingEntries(chapter);
          for (const entry of entries) {
            await promisifyRequest(mappingsStore.put(entry as any));
          }
        }
      },
      'maintenance',
      'backfill',
      'urlMappings'
    );

    await SettingsOps.set(SETTINGS.URL_BACKFILL_FLAG, true);
    await SettingsOps.set(SETTINGS.URL_BACKFILL_VERSION, URL_MAPPINGS_BACKFILL_VERSION);
  }

  static async normalizeStableIds(): Promise<void> {
    const already = await SettingsOps.getKey<boolean>(SETTINGS.STABLE_ID_NORMALIZED);
    if (already) return;

    await withWriteTxn(
      [STORE_NAMES.CHAPTERS, STORE_NAMES.URL_MAPPINGS, STORE_NAMES.TRANSLATIONS],
      async (_txn, stores) => {
        const chaptersStore = stores[STORE_NAMES.CHAPTERS];
        const mappingsStore = stores[STORE_NAMES.URL_MAPPINGS];
        const translationsStore = stores[STORE_NAMES.TRANSLATIONS];

        const chapters = (await promisifyRequest(chaptersStore.getAll())) as ChapterRecord[];

        for (const chapter of chapters) {
          const originalStableId = chapter.stableId;
          if (originalStableId && originalStableId.includes('-')) {
            chapter.stableId = originalStableId.replace(/-/g, '_');
            await promisifyRequest(chaptersStore.put(chapter));
            await updateTranslationsStableId(translationsStore, chapter.url, chapter.stableId);
          }

          if (chapter.stableId) {
            const canonical =
              chapter.canonicalUrl ||
              normalizeUrlAggressively(chapter.originalUrl || chapter.url) ||
              chapter.url;
            const timestamp = nowIso();
            await promisifyRequest(
              mappingsStore.put({
                url: canonical,
                stableId: chapter.stableId,
                novelId: chapter.novelId ?? null,
                chapterNumber: chapter.chapterNumber,
                isCanonical: true,
                dateAdded: timestamp,
              } as UrlMappingRecord)
            );
            const raw = chapter.originalUrl || chapter.url;
            if (raw && raw !== canonical) {
              await promisifyRequest(
                mappingsStore.put({
                  url: raw,
                  stableId: chapter.stableId,
                  novelId: chapter.novelId ?? null,
                  chapterNumber: chapter.chapterNumber,
                  isCanonical: false,
                  dateAdded: timestamp,
                } as UrlMappingRecord)
              );
            }
          }
        }
      },
      'maintenance',
      'normalize',
      'stableIds'
    );

    await SettingsOps.set(SETTINGS.STABLE_ID_NORMALIZED, true);
  }

  static async backfillActiveTranslations(): Promise<void> {
    const already = await SettingsOps.getKey<boolean>(SETTINGS.ACTIVE_TRANSLATIONS_V2);
    if (already) return;

    const urlToStableId = new Map<string, string>();
    await withReadTxn(
      STORE_NAMES.CHAPTERS,
      async (_txn, stores) => {
        const chaptersStore = stores[STORE_NAMES.CHAPTERS];
        const chapters = (await promisifyRequest(chaptersStore.getAll())) as ChapterRecord[];
        for (const chapter of chapters) {
          if (!chapter) continue;
          if (chapter.url && chapter.stableId) {
            urlToStableId.set(chapter.url, chapter.stableId);
          }
          if (chapter.canonicalUrl && chapter.stableId) {
            urlToStableId.set(chapter.canonicalUrl, chapter.stableId);
          }
        }
      },
      'maintenance',
      'backfill',
      'chapterScan'
    );

    await withWriteTxn(
      STORE_NAMES.TRANSLATIONS,
      async (_txn, stores) => {
        const translationsStore = stores[STORE_NAMES.TRANSLATIONS];
        const translations = (await promisifyRequest(translationsStore.getAll())) as TranslationRecord[];

        const grouped = new Map<string, TranslationRecord[]>();
        for (const translation of translations) {
          if (!translation.chapterUrl) continue;
          if (!grouped.has(translation.chapterUrl)) {
            grouped.set(translation.chapterUrl, []);
          }
          grouped.get(translation.chapterUrl)!.push(translation);
        }

        for (const [chapterUrl, versions] of grouped) {
          const stableId = urlToStableId.get(chapterUrl);
          const hasActive = versions.some(v => Boolean(v.isActive));

          let latest: TranslationRecord | null = null;
          for (const record of versions) {
            if (!record.stableId && stableId) {
              record.stableId = stableId;
              await promisifyRequest(translationsStore.put(record));
            }
            if (!latest || (record.version ?? 0) > (latest.version ?? 0)) {
              latest = record;
            }
          }

          if (!hasActive && latest) {
            latest.isActive = true;
            await promisifyRequest(translationsStore.put(latest));
          }
        }
      },
      'maintenance',
      'backfill',
      'activeTranslations'
    );

    await SettingsOps.set(SETTINGS.ACTIVE_TRANSLATIONS_V2, true);
  }

  static async backfillTranslationMetadata(): Promise<void> {
    const already = await SettingsOps.getKey<boolean>(SETTINGS.TRANSLATION_METADATA_BACKFILLED);
    if (already) return;

    await withWriteTxn(
      STORE_NAMES.TRANSLATIONS,
      async (_txn, stores) => {
        const translationsStore = stores[STORE_NAMES.TRANSLATIONS];
        const records = (await promisifyRequest(translationsStore.getAll())) as TranslationRecord[];

        for (const record of records) {
          if (!record) continue;
          let dirty = false;
          const snapshot = record.settingsSnapshot;

          const resolvedProvider = record.provider ?? snapshot?.provider ?? 'unknown';
          const resolvedModel = record.model ?? snapshot?.model ?? 'unknown';

          if (record.provider !== resolvedProvider) {
            record.provider = resolvedProvider;
            dirty = true;
          }

          if (record.model !== resolvedModel) {
            record.model = resolvedModel;
            dirty = true;
          }

          if (record.settingsSnapshot) {
            let snapDirty = false;
            if (!record.settingsSnapshot.provider && resolvedProvider) {
              record.settingsSnapshot.provider = resolvedProvider;
              snapDirty = true;
            }
            if (!record.settingsSnapshot.model && resolvedModel) {
              record.settingsSnapshot.model = resolvedModel;
              snapDirty = true;
            }
            if (snapDirty) {
              dirty = true;
            }
          } else {
            record.settingsSnapshot = {
              provider: resolvedProvider,
              model: resolvedModel,
              temperature: typeof record.temperature === 'number' ? record.temperature : 0.7,
              systemPrompt: record.systemPrompt || '',
              promptId: record.promptId,
              promptName: record.promptName,
            };
            dirty = true;
          }

          if (dirty) {
            await promisifyRequest(translationsStore.put(record));
          }
        }
      },
      'maintenance',
      'backfill',
      'translationMetadata'
    );

    await SettingsOps.set(SETTINGS.TRANSLATION_METADATA_BACKFILLED, true);
  }

  static async backfillSummaryNovelIds(): Promise<void> {
    const already = await SettingsOps.getKey<boolean>(SETTINGS.SUMMARY_NOVEL_ID_BACKFILLED);
    if (already) return;

    debugLog('indexeddb', 'summary', '[MaintenanceOps] Backfilling novelId for chapter summaries...');

    await withWriteTxn(
      STORE_NAMES.CHAPTER_SUMMARIES,
      async (_txn, stores) => {
        const summariesStore = stores[STORE_NAMES.CHAPTER_SUMMARIES];
        const summaries = (await promisifyRequest(summariesStore.getAll())) as ChapterSummaryRecord[];

        let updatedCount = 0;
        for (const summary of summaries) {
          if (summary.novelId) continue;

          // Attempt to extract novelId from stableId
          let novelId: string | null = null;
          if (isScopedStableId(summary.stableId)) {
            // Use a simple split if parseScopedStableId is too strict for corrupted ones
            // Format is lf-library:novelId::versionId:baseId
            const parts = summary.stableId.split(':');
            if (parts.length >= 2) {
              const scopePart = parts[1];
              if (scopePart.includes('::')) {
                novelId = scopePart.split('::')[0];
              }
            }
          }

          if (novelId) {
            summary.novelId = novelId;
            await promisifyRequest(summariesStore.put(summary));
            updatedCount += 1;
          }
        }
        debugLog('indexeddb', 'summary', `[MaintenanceOps] Backfilled novelId for ${updatedCount} summaries.`);
      },
      'maintenance',
      'backfill',
      'summaryNovelId'
    );

    await SettingsOps.set(SETTINGS.SUMMARY_NOVEL_ID_BACKFILLED, true);
  }

  static async backfillNovelIds(): Promise<void> {
    const already = await SettingsOps.getKey<boolean>(SETTINGS.NOVEL_ID_BACKFILLED);
    if (already) return;

    await withWriteTxn(
      [STORE_NAMES.CHAPTERS, STORE_NAMES.URL_MAPPINGS],
      async (_txn, stores) => {
        const chaptersStore = stores[STORE_NAMES.CHAPTERS];
        const mappingsStore = stores[STORE_NAMES.URL_MAPPINGS];

        const chapters = (await promisifyRequest(chaptersStore.getAll())) as ChapterRecord[];
        for (const chapter of chapters) {
          if (typeof chapter.novelId !== 'undefined') continue;
          await promisifyRequest(chaptersStore.put({ ...chapter, novelId: null }));
        }

        const mappings = (await promisifyRequest(mappingsStore.getAll())) as UrlMappingRecord[];
        for (const mapping of mappings) {
          if (typeof mapping.novelId !== 'undefined') continue;
          await promisifyRequest(
            mappingsStore.put({
              ...mapping,
              novelId: null,
            })
          );
        }
      },
      'maintenance',
      'backfill',
      'novelIds'
    );

    await SettingsOps.set(SETTINGS.NOVEL_ID_BACKFILLED, true);
  }

  static async repairScopedStableIdDuplicates(): Promise<ScopedIdentityRepairSummary> {
    const already = await SettingsOps.getKey<number | boolean>(SETTINGS.SCOPED_IDENTITY_REPAIRED_V2);
    if (already) {
      return {
        groupsRepaired: 0,
        chaptersDeleted: 0,
        translationsMoved: 0,
        urlMappingsUpdated: 0,
        feedbackUpdated: 0,
        amendmentLogsUpdated: 0,
        diffResultsUpdated: 0,
        navigationEntriesUpdated: 0,
        lastActiveUpdated: false,
        bookshelfEntriesUpdated: 0,
      };
    }

    const summary: ScopedIdentityRepairSummary = {
      groupsRepaired: 0,
      chaptersDeleted: 0,
      translationsMoved: 0,
      urlMappingsUpdated: 0,
      feedbackUpdated: 0,
      amendmentLogsUpdated: 0,
      diffResultsUpdated: 0,
      navigationEntriesUpdated: 0,
      lastActiveUpdated: false,
      bookshelfEntriesUpdated: 0,
    };

    await withWriteTxn(
      [
        STORE_NAMES.CHAPTERS,
        STORE_NAMES.TRANSLATIONS,
        STORE_NAMES.FEEDBACK,
        STORE_NAMES.URL_MAPPINGS,
        STORE_NAMES.CHAPTER_SUMMARIES,
        STORE_NAMES.AMENDMENT_LOGS,
        STORE_NAMES.DIFF_RESULTS,
        STORE_NAMES.SETTINGS,
      ],
      async (_txn, stores) => {
        const chaptersStore = stores[STORE_NAMES.CHAPTERS];
        const translationsStore = stores[STORE_NAMES.TRANSLATIONS];
        const feedbackStore = stores[STORE_NAMES.FEEDBACK];
        const mappingsStore = stores[STORE_NAMES.URL_MAPPINGS];
        const summariesStore = stores[STORE_NAMES.CHAPTER_SUMMARIES];
        const amendmentsStore = stores[STORE_NAMES.AMENDMENT_LOGS];
        const diffResultsStore = stores[STORE_NAMES.DIFF_RESULTS];
        const settingsStore = stores[STORE_NAMES.SETTINGS];

        const chapters = (await promisifyRequest(chaptersStore.getAll())) as ChapterRecord[];
        const translations = (await promisifyRequest(translationsStore.getAll())) as TranslationRecord[];
        const feedback = (await promisifyRequest(feedbackStore.getAll())) as FeedbackRecord[];
        const mappings = (await promisifyRequest(mappingsStore.getAll())) as UrlMappingRecord[];
        const summaries = (await promisifyRequest(summariesStore.getAll())) as ChapterSummaryRecord[];
        const amendmentLogs = (await promisifyRequest(amendmentsStore.getAll())) as AmendmentLogRecord[];
        const diffResults = (await promisifyRequest(diffResultsStore.getAll())) as DiffResult[];

        const translationCounts = new Map<string, number>();
        const activeTranslationCounts = new Map<string, number>();
        for (const record of translations) {
          const stableId = record.stableId || '';
          if (!stableId) continue;
          translationCounts.set(stableId, (translationCounts.get(stableId) ?? 0) + 1);
          if (record.isActive) {
            activeTranslationCounts.set(stableId, (activeTranslationCounts.get(stableId) ?? 0) + 1);
          }
        }

        const fingerprintGroups = new Map<string, ChapterRecord[]>();
        for (const chapter of chapters) {
          const fingerprint = buildDuplicateFingerprint(chapter);
          if (!fingerprint) continue;
          const current = fingerprintGroups.get(fingerprint) ?? [];
          current.push(chapter);
          fingerprintGroups.set(fingerprint, current);
        }

        const duplicateGroups: DuplicateChapterGroup[] = [];
        for (const [fingerprint, groupChapters] of fingerprintGroups.entries()) {
          const hasDuplicateFingerprint = groupChapters.length > 1;
          const hasNestedStableId = groupChapters.some(chapter => getScopedStableIdDepth(chapter.stableId) > 1);
          if (!hasDuplicateFingerprint && !hasNestedStableId) {
            continue;
          }

          const survivor = chooseSurvivor(groupChapters, translationCounts, activeTranslationCounts);
          const targetStableId =
            collapseScopedStableId(
              survivor.stableId,
              survivor.novelId ?? null,
              survivor.libraryVersionId ?? null
            ) || survivor.stableId || '';
          if (!targetStableId) {
            continue;
          }

          const targetUrl =
            survivor.novelId
              ? buildScopedStorageUrl(targetStableId, survivor.novelId, survivor.libraryVersionId ?? null)
              : survivor.url;

          duplicateGroups.push({
            fingerprint,
            targetStableId,
            targetUrl,
            survivor,
            duplicates: groupChapters.filter(chapter => chapter.url !== survivor.url),
            chapterRecords: groupChapters,
          });
        }

        if (duplicateGroups.length > 0) {
          const stableIdReplacementMap = new Map<string, string>();
          const chapterUrlReplacementMap = new Map<string, string>();
          const mergedChaptersByStableId = new Map<string, ChapterRecord>();

          for (const group of duplicateGroups) {
            summary.groupsRepaired += 1;
            const mergedChapter = mergeChapterRecords(group.targetStableId, group.targetUrl, group.chapterRecords);

            debugLog('indexeddb', 'summary', '[MaintenanceOps] Repairing duplicate chapter identity group', {
              fingerprint: group.fingerprint,
              scope: summarizeScope(mergedChapter.novelId, mergedChapter.libraryVersionId ?? null),
              targetStableId: group.targetStableId,
              targetUrl: group.targetUrl,
              chapterStableIds: group.chapterRecords.map(chapter => chapter.stableId ?? null),
            });

            for (const chapter of group.chapterRecords) {
              if (chapter.stableId && chapter.stableId !== group.targetStableId) {
                stableIdReplacementMap.set(chapter.stableId, group.targetStableId);
              }
              if (chapter.url !== group.targetUrl) {
                chapterUrlReplacementMap.set(chapter.url, group.targetUrl);
              }
            }

            await promisifyRequest(chaptersStore.put(mergedChapter));
            mergedChaptersByStableId.set(group.targetStableId, mergedChapter);

            for (const chapter of group.chapterRecords) {
              if (chapter.url !== group.targetUrl) {
                await promisifyRequest(chaptersStore.delete(chapter.url));
                summary.chaptersDeleted += 1;
              }
            }
          }

          const chapterUrlsInGroups = new Set<string>([
            ...duplicateGroups.flatMap(group => group.chapterRecords.map(chapter => chapter.url)),
            ...chapterUrlReplacementMap.keys(),
          ]);
          const stableIdsInGroups = new Set<string>([
            ...duplicateGroups.flatMap(group => group.chapterRecords.map(chapter => chapter.stableId).filter(Boolean) as string[]),
            ...stableIdReplacementMap.keys(),
          ]);

          const translationsByTargetStableId = new Map<string, TranslationRecord[]>();
          for (const translation of translations) {
            const replacementStableId =
              translation.stableId && stableIdReplacementMap.get(translation.stableId);
            const replacementChapterUrl = chapterUrlReplacementMap.get(translation.chapterUrl);
            const isAffected =
              Boolean(replacementStableId) ||
              Boolean(replacementChapterUrl) ||
              stableIdsInGroups.has(translation.stableId || '') ||
              chapterUrlsInGroups.has(translation.chapterUrl);
            if (!isAffected) continue;

            const targetStableId = replacementStableId || translation.stableId || '';
            const targetChapterUrl = replacementChapterUrl || translation.chapterUrl;
            if (!targetStableId) continue;

            const updated = {
              ...translation,
              stableId: targetStableId,
              chapterUrl: targetChapterUrl,
            };
            const bucket = translationsByTargetStableId.get(targetStableId) ?? [];
            bucket.push(updated);
            translationsByTargetStableId.set(targetStableId, bucket);
          }

          for (const [targetStableId, bucket] of translationsByTargetStableId.entries()) {
            const targetChapterUrl =
              bucket.find(record => record.chapterUrl)?.chapterUrl ||
              duplicateGroups.find(group => group.targetStableId === targetStableId)?.targetUrl;
            if (!targetChapterUrl) continue;

            const sorted = [...bucket].sort((left, right) => {
              const createdAtDelta = translationCreatedAtValue(left) - translationCreatedAtValue(right);
              if (createdAtDelta !== 0) return createdAtDelta;
              return (left.version ?? 0) - (right.version ?? 0);
            });

            let activeTranslationId: string | null = null;
            const activeCandidates = sorted.filter(record => record.isActive);
            if (activeCandidates.length > 0) {
              activeTranslationId = [...activeCandidates].sort(
                (left, right) => translationCreatedAtValue(right) - translationCreatedAtValue(left)
              )[0].id;
            } else if (sorted.length > 0) {
              activeTranslationId = sorted[sorted.length - 1].id;
            }

            const usedVersions = new Set<number>();
            let nextVersion = 1;
            for (const record of sorted) {
              let assignedVersion = record.version ?? nextVersion;
              while (usedVersions.has(assignedVersion)) {
                assignedVersion = nextVersion;
                nextVersion += 1;
              }
              usedVersions.add(assignedVersion);
              nextVersion = Math.max(nextVersion, assignedVersion + 1);

              record.version = assignedVersion;
              record.stableId = targetStableId;
              record.chapterUrl = targetChapterUrl;
              record.isActive = record.id === activeTranslationId;
              await promisifyRequest(translationsStore.put(record));
              summary.translationsMoved += 1;
            }
          }

          for (const record of feedback) {
            const replacementChapterUrl = chapterUrlReplacementMap.get(record.chapterUrl);
            if (!replacementChapterUrl) continue;
            await promisifyRequest(
              feedbackStore.put({
                ...record,
                chapterUrl: replacementChapterUrl,
              })
            );
            summary.feedbackUpdated += 1;
          }

          for (const mapping of mappings) {
            const replacementStableId = stableIdReplacementMap.get(mapping.stableId);
            const isAffected =
              Boolean(replacementStableId) ||
              stableIdsInGroups.has(mapping.stableId) ||
              (isLibraryStorageUrl(mapping.url) && chapterUrlsInGroups.has(mapping.url));
            if (!isAffected) continue;

            if (isLibraryStorageUrl(mapping.url)) {
              await promisifyRequest(mappingsStore.delete(mapping.url));
              summary.urlMappingsUpdated += 1;
              continue;
            }

            const targetStableId = replacementStableId || mapping.stableId;
            const targetChapter = duplicateGroups.find(group => group.targetStableId === targetStableId)?.survivor;
            await promisifyRequest(
              mappingsStore.put({
                ...mapping,
                stableId: targetStableId,
                novelId: targetChapter?.novelId ?? mapping.novelId ?? null,
                libraryVersionId: targetChapter?.libraryVersionId ?? mapping.libraryVersionId ?? null,
                chapterNumber: targetChapter?.chapterNumber ?? mapping.chapterNumber,
              })
            );
            summary.urlMappingsUpdated += 1;
          }

          for (const summaryRecord of summaries) {
            if (stableIdsInGroups.has(summaryRecord.stableId) || stableIdReplacementMap.has(summaryRecord.stableId)) {
              await promisifyRequest(summariesStore.delete(summaryRecord.stableId));
            }
          }

          for (const chapter of mergedChaptersByStableId.values()) {
            const activeTranslations =
              translationsByTargetStableId.get(chapter.stableId || '') ??
              translations.filter(translation => translation.stableId === chapter.stableId);
            const active = activeTranslations.find(translation => translation.isActive) || null;
            const repairedSummary: ChapterSummaryRecord = {
              stableId: chapter.stableId || '',
              novelId: chapter.novelId ?? null,
              libraryVersionId: chapter.libraryVersionId ?? null,
              canonicalUrl: chapter.canonicalUrl,
              title: chapter.title,
              translatedTitle: active?.translatedTitle,
              chapterNumber: chapter.chapterNumber,
              hasTranslation: Boolean(activeTranslations.length),
              hasImages: Boolean(
                active?.suggestedIllustrations?.some(illustration => illustration?.url || illustration?.generatedImage)
              ),
              lastAccessed: chapter.lastAccessed,
              lastTranslatedAt: active?.createdAt,
            };
            await promisifyRequest(summariesStore.put(repairedSummary));
          }

          for (const log of amendmentLogs) {
            const replacementChapterId = log.chapterId ? stableIdReplacementMap.get(log.chapterId) : null;
            if (!replacementChapterId) continue;
            await promisifyRequest(
              amendmentsStore.put({
                ...log,
                chapterId: replacementChapterId,
              })
            );
            summary.amendmentLogsUpdated += 1;
          }

          const affectedDiffResults = diffResults.filter(result => stableIdReplacementMap.has(result.chapterId));
          for (const record of affectedDiffResults) {
            await promisifyRequest(diffResultsStore.delete(buildDiffResultKey(record)));
          }
          const diffResultsByNewKey = new Map<string, DiffResult>();
          for (const record of affectedDiffResults) {
            const updated: DiffResult = {
              ...record,
              chapterId: stableIdReplacementMap.get(record.chapterId) || record.chapterId,
            };
            const key = JSON.stringify(buildDiffResultKey(updated));
            const existing = diffResultsByNewKey.get(key);
            if (!existing || (updated.analyzedAt || 0) > (existing.analyzedAt || 0)) {
              diffResultsByNewKey.set(key, updated);
            }
          }
          for (const record of diffResultsByNewKey.values()) {
            await promisifyRequest(diffResultsStore.put(record));
            summary.diffResultsUpdated += 1;
          }

          const navigationSetting = (await promisifyRequest(settingsStore.get('navigation-history'))) as
            | { key: string; value: { stableIds?: string[] }; updatedAt?: string }
            | undefined;
          const navigationHistory = Array.isArray(navigationSetting?.value?.stableIds)
            ? navigationSetting?.value?.stableIds
            : [];
          const repairedHistory = navigationHistory.map(id => stableIdReplacementMap.get(id) || id);
          const dedupedHistory = [...new Set(repairedHistory)];
          if (navigationHistory.length > 0 && JSON.stringify(navigationHistory) !== JSON.stringify(dedupedHistory)) {
            await promisifyRequest(
              settingsStore.put({
                key: 'navigation-history',
                value: { stableIds: dedupedHistory },
                updatedAt: nowIso(),
              })
            );
            summary.navigationEntriesUpdated = navigationHistory.length;
          }

          const lastActiveSetting = (await promisifyRequest(settingsStore.get('lastActiveChapter'))) as
            | { key: string; value: { id?: string; url?: string }; updatedAt?: string }
            | undefined;
          const lastActiveId = lastActiveSetting?.value?.id;
          if (lastActiveId && stableIdReplacementMap.has(lastActiveId)) {
            await promisifyRequest(
              settingsStore.put({
                key: 'lastActiveChapter',
                value: {
                  ...lastActiveSetting?.value,
                  id: stableIdReplacementMap.get(lastActiveId),
                },
                updatedAt: nowIso(),
              })
            );
            summary.lastActiveUpdated = true;
          }
        } else {
          debugLog('indexeddb', 'summary', '[MaintenanceOps] No scoped stableId duplicates detected.');
        }

        const stableIdReplacementMap = new Map<string, string>(); // Stub for bookshelf logic if duplicateGroups.length === 0

        const bookshelfSetting = (await promisifyRequest(settingsStore.get('bookshelf-state'))) as
          | { key: string; value: Record<string, any>; updatedAt?: string }
          | undefined;
        if (bookshelfSetting?.value && typeof bookshelfSetting.value === 'object') {
          const nextBookshelfState: Record<string, any> = {};
          
          // Group by novelId to detect cross-version or scoped/unscoped duplicates
          const bucketByNovelId = new Map<string, any[]>();

          for (const [rawKey, rawEntry] of Object.entries(bookshelfSetting.value)) {
            if (!rawEntry || typeof rawEntry !== 'object') continue;
            const entry = { ...(rawEntry as Record<string, any>) };
            
            // Fix chapter ID if it was replaced
            if (typeof entry.lastChapterId === 'string' && stableIdReplacementMap.has(entry.lastChapterId)) {
              entry.lastChapterId = stableIdReplacementMap.get(entry.lastChapterId);
            }
            
            // Extract novelId: prioritize explicit field, then key prefix
            const novelId = entry.novelId || rawKey.split('::')[0];
            const bucket = bucketByNovelId.get(novelId) ?? [];
            bucket.push({ ...entry, novelId, rawKey });
            bucketByNovelId.set(novelId, bucket);
          }

          for (const [novelId, entries] of bucketByNovelId.entries()) {
            if (entries.length === 1) {
              const entry = entries[0];
              const scopeKey = buildLibraryScopeKey(novelId, entry.versionId ?? null);
              nextBookshelfState[scopeKey] = entry;
              continue;
            }

            // Multiple entries for the same novel - we need to dedupe
            // Group by versionId to see if they are truly different versions
            const versionBuckets = new Map<string, any[]>();
            for (const entry of entries) {
              const vId = entry.versionId || 'unscoped';
              const vBucket = versionBuckets.get(vId) ?? [];
              vBucket.push(entry);
              versionBuckets.set(vId, vBucket);
            }

            if (versionBuckets.size === 1) {
              // All entries refer to the same version (or all are unscoped)
              // Pick the most recent one
              const winner = [...entries].sort((left, right) => {
                return String(right.lastReadAtIso || '').localeCompare(String(left.lastReadAtIso || ''));
              })[0];
              const scopeKey = buildLibraryScopeKey(novelId, winner.versionId ?? null);
              nextBookshelfState[scopeKey] = winner;
            } else {
              // Multiple versions - check if one is 'unscoped' and can be merged into a scoped one
              const unscoped = versionBuckets.get('unscoped');
              if (unscoped && versionBuckets.size === 2) {
                // One unscoped, one scoped. Merge unscoped into the scoped one if it's older
                const otherVersionId = Array.from(versionBuckets.keys()).find(k => k !== 'unscoped')!;
                
                const allForThisNovel = [...entries].sort((left, right) => {
                  return String(right.lastReadAtIso || '').localeCompare(String(left.lastReadAtIso || ''));
                });
                
                const winner = allForThisNovel[0];
                // Always use the scoped versionId if we are merging
                const finalVersionId = winner.versionId || otherVersionId;
                const scopeKey = buildLibraryScopeKey(novelId, finalVersionId);
                nextBookshelfState[scopeKey] = { ...winner, versionId: finalVersionId };
              } else {
                // Genuinely different versions - keep the best for each version
                for (const [vId, vEntries] of versionBuckets.entries()) {
                  const winner = [...vEntries].sort((left, right) => {
                    return String(right.lastReadAtIso || '').localeCompare(String(left.lastReadAtIso || ''));
                  })[0];
                  const resolvedVersionId = vId === 'unscoped' ? null : vId;
                  const scopeKey = buildLibraryScopeKey(novelId, resolvedVersionId);
                  nextBookshelfState[scopeKey] = winner;
                }
              }
            }
          }

          if (JSON.stringify(bookshelfSetting.value) !== JSON.stringify(nextBookshelfState)) {
            await promisifyRequest(
              settingsStore.put({
                key: 'bookshelf-state',
                value: nextBookshelfState,
                updatedAt: nowIso(),
              })
            );
            summary.bookshelfEntriesUpdated = Object.keys(bookshelfSetting.value).length;
          }
        }
      },
      'maintenance',
      'repair',
      'scopedIdentityDuplicates'
    );

    await SettingsOps.set(SETTINGS.SCOPED_IDENTITY_REPAIRED_V2, 1);
    debugLog('indexeddb', 'summary', '[MaintenanceOps] Scoped stableId repair complete', summary);
    return summary;
  }

  static async syncSummaries(force = false): Promise<void> {
    if (!force) {
      const already = await SettingsOps.getKey<boolean>(SETTINGS.SUMMARIES_SYNCED);
      if (already) return;
    }

    debugLog('indexeddb', 'summary', '[MaintenanceOps] Syncing all chapter summaries...');
    
    await syncAllChapterSummaries({
      openDatabase: () => getConnection(),
      getChapter: (url) => ChapterOps.getByUrl(url),
      getChapterByStableId: (stableId) => ChapterOps.getByStableId(stableId),
      getActiveTranslation: (url) => TranslationOps.getActiveByUrl(url),
      normalizeUrl: (url) => normalizeUrlAggressively(url),
    });

    await SettingsOps.set(SETTINGS.SUMMARIES_SYNCED, true);
    debugLog('indexeddb', 'summary', '[MaintenanceOps] Chapter summaries sync complete.');
  }

  /**
   * Consolidate duplicate bookshelf-state entries for the same novel.
   *
   * Why this exists separately from repairScopedStableIdDuplicates:
   *   That earlier migration is gated on SCOPED_IDENTITY_REPAIRED_V2 and runs
   *   once per database. On databases where it already ran (which is most
   *   of them by now), any bookshelf duplicates created AFTER it ran sit
   *   there forever. The user's 2026-05-06 screenshot showed two "Continue
   *   Reading" cards for FMC (chapter 338 and chapter 2) — concrete evidence
   *   the V2 migration's flag was set but new duplicates accumulated.
   *
   * Strategy:
   *   - Group bookshelf entries by novelId.
   *   - For each group, keep the entry with the most recent `lastReadAtIso`.
   *   - Re-key it under `${novelId}::${versionId}` (scoped) — pulling forward
   *     the winning entry's versionId, or the only versionId among the
   *     duplicates if the winner was unscoped (legacy).
   *   - Discard the rest.
   *   - Persist only if the resulting object differs from the original.
   *
   * Idempotent: a clean state passes through unchanged. The render-side
   * dedup in NovelLibrary.tsx catches duplicates that appear AFTER this
   * migration runs (the migration won't re-run because its flag is set).
   */
  static async consolidateBookshelfDuplicates(): Promise<{
    duplicateGroupsCollapsed: number;
    entriesRemoved: number;
  }> {
    const already = await SettingsOps.getKey<boolean>(SETTINGS.BOOKSHELF_DEDUPED_V3);
    if (already) {
      return { duplicateGroupsCollapsed: 0, entriesRemoved: 0 };
    }

    let duplicateGroupsCollapsed = 0;
    let entriesRemoved = 0;

    await withWriteTxn(
      [STORE_NAMES.SETTINGS],
      async (_txn, stores) => {
        const settingsStore = stores[STORE_NAMES.SETTINGS];

        const bookshelfSetting = (await promisifyRequest(settingsStore.get('bookshelf-state'))) as
          | { key: string; value: Record<string, unknown>; updatedAt?: string }
          | undefined;

        if (!bookshelfSetting?.value || typeof bookshelfSetting.value !== 'object') {
          return;
        }

        const original = bookshelfSetting.value as Record<string, Record<string, unknown>>;
        const originalCount = Object.keys(original).length;

        // Group by novelId
        type Entry = Record<string, unknown> & {
          novelId?: string;
          versionId?: string | null;
          lastReadAtIso?: string;
        };
        const groups = new Map<string, Array<{ rawKey: string; entry: Entry }>>();

        for (const [rawKey, rawEntry] of Object.entries(original)) {
          if (!rawEntry || typeof rawEntry !== 'object') continue;
          const entry = rawEntry as Entry;
          const novelId =
            (typeof entry.novelId === 'string' && entry.novelId) ||
            rawKey.split('::')[0];
          if (!novelId) continue;
          const bucket = groups.get(novelId) ?? [];
          bucket.push({ rawKey, entry });
          groups.set(novelId, bucket);
        }

        const next: Record<string, Entry> = {};

        for (const [novelId, bucket] of groups.entries()) {
          if (bucket.length === 1) {
            // No duplicates — preserve the original key shape.
            const { rawKey, entry } = bucket[0];
            next[rawKey] = entry;
            continue;
          }

          duplicateGroupsCollapsed += 1;
          entriesRemoved += bucket.length - 1;

          // Pick winner by most-recent lastReadAtIso (ISO 8601 sorts lex).
          const winner = [...bucket].sort((a, b) => {
            const av = String(a.entry.lastReadAtIso || '');
            const bv = String(b.entry.lastReadAtIso || '');
            return bv.localeCompare(av);
          })[0];

          // Pull forward a non-null versionId if the winner doesn't have one
          // but a sibling does (legacy unscoped winning over a scoped sibling).
          let versionId: string | null | undefined = winner.entry.versionId ?? null;
          if (!versionId) {
            for (const { entry } of bucket) {
              if (entry.versionId) {
                versionId = entry.versionId;
                break;
              }
            }
          }

          const scopeKey = buildLibraryScopeKey(novelId, versionId ?? null);
          next[scopeKey] = {
            ...winner.entry,
            novelId,
            ...(versionId ? { versionId } : {}),
          };
        }

        // Only write if the result differs (avoids spurious updatedAt churn).
        if (
          duplicateGroupsCollapsed > 0 ||
          Object.keys(next).length !== originalCount
        ) {
          await promisifyRequest(
            settingsStore.put({
              key: 'bookshelf-state',
              value: next,
              updatedAt: nowIso(),
            })
          );
          debugLog(
            'indexeddb',
            'summary',
            `[MaintenanceOps] Bookshelf consolidated: ${duplicateGroupsCollapsed} group(s), removed ${entriesRemoved} duplicate entry(ies).`
          );
        } else {
          debugLog('indexeddb', 'full', '[MaintenanceOps] Bookshelf already clean.');
        }
      },
      'maintenance',
      'consolidate',
      'bookshelf'
    );

    await SettingsOps.set(SETTINGS.BOOKSHELF_DEDUPED_V3, true);
    return { duplicateGroupsCollapsed, entriesRemoved };
  }

  /**
   * READ-ONLY diagnostic. Surveys IDB for chapter-identity duplication and
   * returns a structured report. Does not write or mutate anything.
   *
   * Per the empirical-first approach (see conversation 2026-05-07): we want
   * to know what's actually in the DB before designing the migration. The
   * audit reports duplicate groups by (novelId, libraryVersionId,
   * chapterNumber) and how each member is referenced across all stores.
   * Categorization heuristics distinguish legacy/scoped drift, content
   * drift, title drift, URL variation, and null-scope rows.
   */
  static async auditChapterDuplicates(): Promise<ChapterIdentityAuditReport> {
    const dbConn = await getConnection();
    const presentStores = new Set<string>(Array.from(dbConn.objectStoreNames));

    // Helper: getAll for a store, returning [] if the store doesn't exist.
    const safeGetAll = async <T>(storeName: string): Promise<T[]> => {
      if (!presentStores.has(storeName)) return [];
      return await withReadTxn([storeName], async (_txn, stores) => {
        const store = stores[storeName];
        return (await promisifyRequest(store.getAll())) as T[];
      });
    };

    const [
      chapters,
      summaries,
      translations,
      urlMappings,
      feedback,
      amendments,
      diffResults,
    ] = await Promise.all([
      safeGetAll<ChapterRecord>(STORE_NAMES.CHAPTERS),
      safeGetAll<ChapterSummaryRecord>(STORE_NAMES.CHAPTER_SUMMARIES),
      safeGetAll<TranslationRecord>(STORE_NAMES.TRANSLATIONS),
      safeGetAll<UrlMappingRecord>(STORE_NAMES.URL_MAPPINGS),
      safeGetAll<FeedbackRecord>(STORE_NAMES.FEEDBACK),
      safeGetAll<AmendmentLogRecord>(STORE_NAMES.AMENDMENT_LOGS),
      safeGetAll<DiffResult>(STORE_NAMES.DIFF_RESULTS),
    ]);

    // Read settings keys we care about
    let bookshelfState: Record<string, any> = {};
    let navigationHistory: string[] = [];
    let lastActiveChapter: { id?: string } | null = null;
    if (presentStores.has(STORE_NAMES.SETTINGS)) {
      bookshelfState =
        (await SettingsOps.getKey<Record<string, any>>('bookshelf-state')) ?? {};
      const navRaw = await SettingsOps.getKey<{ stableIds?: string[] }>(
        'navigation-history'
      );
      navigationHistory = Array.isArray(navRaw?.stableIds) ? navRaw!.stableIds! : [];
      lastActiveChapter = await SettingsOps.getKey<{ id?: string }>('lastActiveChapter');
    }

    // Build chapterByStableId index for orphan detection
    const chapterByStableId = new Map<string, ChapterRecord>();
    const chapterByUrl = new Map<string, ChapterRecord>();
    for (const ch of chapters) {
      if (ch.stableId) chapterByStableId.set(ch.stableId, ch);
      if (ch.url) chapterByUrl.set(ch.url, ch);
    }

    // Build per-stableId reference counts across all stores
    const refCountsByStableId = new Map<string, AuditReferenceCounts>();
    const ensureRefBucket = (stableId: string): AuditReferenceCounts => {
      let bucket = refCountsByStableId.get(stableId);
      if (!bucket) {
        bucket = {
          summaries: 0,
          translations: 0,
          feedback: 0,
          amendments: 0,
          diffResults: 0,
          urlMappings: 0,
          bookshelfEntries: 0,
          navigationHistoryEntries: 0,
        };
        refCountsByStableId.set(stableId, bucket);
      }
      return bucket;
    };

    for (const s of summaries) {
      if (s.stableId) ensureRefBucket(s.stableId).summaries += 1;
    }
    for (const t of translations) {
      if (t.stableId) ensureRefBucket(t.stableId).translations += 1;
    }
    for (const m of urlMappings) {
      if (m.stableId) ensureRefBucket(m.stableId).urlMappings += 1;
    }
    for (const a of amendments) {
      if (a.chapterId) ensureRefBucket(a.chapterId).amendments += 1;
    }
    for (const d of diffResults) {
      if (d.chapterId) ensureRefBucket(d.chapterId).diffResults += 1;
    }
    for (const entry of Object.values(bookshelfState ?? {})) {
      const id = (entry as any)?.lastChapterId;
      if (typeof id === 'string') ensureRefBucket(id).bookshelfEntries += 1;
    }
    for (const id of navigationHistory) {
      if (typeof id === 'string') ensureRefBucket(id).navigationHistoryEntries += 1;
    }

    // Feedback is keyed by URL, not stableId. To attribute it per-stableId we
    // need to look up the chapter by URL. Feedback for orphaned URLs gets
    // counted separately.
    let feedbackOrphanedUrls = 0;
    for (const f of feedback) {
      const ch = chapterByUrl.get(f.chapterUrl);
      if (ch?.stableId) {
        ensureRefBucket(ch.stableId).feedback += 1;
      } else if (f.chapterUrl) {
        feedbackOrphanedUrls += 1;
      }
    }

    // Group chapters by (novelId, libraryVersionId, chapterNumber). null
    // novelId or chapterNumber means we can't slot-identify the row, which
    // is itself a finding (categorized below).
    type SlotKey = string;
    const slotKey = (
      novelId: string | null,
      versionId: string | null,
      chapterNumber: number | undefined | null
    ): SlotKey => `${novelId ?? '∅'}|${versionId ?? '∅'}|${chapterNumber ?? '∅'}`;

    const slotIndex = new Map<SlotKey, ChapterRecord[]>();
    for (const ch of chapters) {
      const key = slotKey(ch.novelId ?? null, ch.libraryVersionId ?? null, ch.chapterNumber);
      const list = slotIndex.get(key) ?? [];
      list.push(ch);
      slotIndex.set(key, list);
    }

    // Build duplicate groups (slots with > 1 row)
    const SCOPED_PREFIX = 'lf-library:';
    const detectIdForm = (
      stableId: string | undefined
    ): 'bare' | 'scoped-encoded' | 'scoped-nested' | 'unknown' => {
      if (!stableId) return 'unknown';
      if (!stableId.startsWith(SCOPED_PREFIX)) return 'bare';
      const remainder = stableId.slice(SCOPED_PREFIX.length);
      // The repaired form has an encoded scope key followed by ':' and a base hash.
      // The nested-bug form has another `lf-library:` (or encoded scope) embedded.
      if (
        remainder.includes(`${SCOPED_PREFIX}`) ||
        remainder.includes(encodeURIComponent(SCOPED_PREFIX))
      ) {
        return 'scoped-nested';
      }
      return 'scoped-encoded';
    };

    const truncate = (s: string | undefined, n: number): string => {
      if (typeof s !== 'string') return '';
      return s.length > n ? `${s.slice(0, n - 1)}…` : s;
    };

    const contentHashShort = (content: string | undefined): string => {
      if (!content) return '';
      // Lightweight FNV-style hash, first 8 hex chars. Just for grouping
      // signature in the report — not a security or migration-grade hash.
      let h = 2166136261;
      for (let i = 0; i < content.length; i++) {
        h ^= content.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return (h >>> 0).toString(16).padStart(8, '0').slice(0, 8);
    };

    const duplicateGroups: AuditDuplicateGroup[] = [];
    let nullScopeRowCount = 0;
    let groupsLegacyUnscopedPlusScoped = 0;
    let groupsContentDriftWithinScope = 0;
    let groupsTitleDriftWithinScope = 0;
    let groupsUrlVariation = 0;

    for (const [, members] of slotIndex.entries()) {
      // Track the null-scope-rows count regardless of duplication
      for (const ch of members) {
        if (!ch.novelId || ch.libraryVersionId == null || typeof ch.chapterNumber !== 'number') {
          nullScopeRowCount += 1;
        }
      }

      if (members.length < 2) continue;

      // Skip "duplicate groups" that are only duplicates because they share
      // the null-scope sentinel — that bucket lumps unrelated rows together.
      const first = members[0];
      if (!first.novelId || typeof first.chapterNumber !== 'number') continue;

      const reportedMembers: AuditDuplicateMember[] = members.map((ch) => {
        const stableId = ch.stableId ?? '';
        // Use a conditional (not `&&`) so an empty stableId falls through to the
        // zero-counts default instead of yielding the empty string `''`, which is
        // not an AuditReferenceCounts. Non-empty-but-unknown ids also default to zero.
        const refs: AuditReferenceCounts = (stableId ? refCountsByStableId.get(stableId) : undefined) ?? {
          summaries: 0,
          translations: 0,
          feedback: 0,
          amendments: 0,
          diffResults: 0,
          urlMappings: 0,
          bookshelfEntries: 0,
          navigationHistoryEntries: 0,
        };
        return {
          stableId,
          idForm: detectIdForm(stableId),
          titleSnippet: truncate(ch.title, 60),
          titleLength: (ch.title || '').length,
          contentHash: contentHashShort(ch.content),
          contentLength: (ch.content || '').length,
          hasTranslation: refs.translations > 0,
          translationCount: refs.translations,
          canonicalUrl: ch.canonicalUrl ?? null,
          originalUrl: ch.originalUrl ?? null,
          novelId: ch.novelId ?? null,
          libraryVersionId: ch.libraryVersionId ?? null,
          lastAccessed: ch.lastAccessed ?? null,
          referencedBy: refs,
        };
      });

      // Categorize this group
      const idForms = new Set(reportedMembers.map((m) => m.idForm));
      const hasBare = idForms.has('bare');
      const hasScoped = idForms.has('scoped-encoded') || idForms.has('scoped-nested');
      if (hasBare && hasScoped) groupsLegacyUnscopedPlusScoped += 1;

      const contentHashes = new Set(reportedMembers.map((m) => m.contentHash));
      if (contentHashes.size > 1) groupsContentDriftWithinScope += 1;

      const titlesNormalized = new Set(
        reportedMembers.map((m) => (m.titleSnippet || '').toLowerCase())
      );
      const titlesRaw = new Set(reportedMembers.map((m) => m.titleSnippet || ''));
      // Same up to case but different raw → case drift
      if (titlesNormalized.size === 1 && titlesRaw.size > 1) groupsTitleDriftWithinScope += 1;

      const originalUrls = new Set(
        reportedMembers.map((m) => m.originalUrl).filter((u): u is string => !!u)
      );
      if (originalUrls.size > 1) groupsUrlVariation += 1;

      duplicateGroups.push({
        key: {
          novelId: first.novelId,
          versionId: first.libraryVersionId ?? null,
          chapterNumber: first.chapterNumber,
        },
        stableIds: reportedMembers.map((m) => m.stableId),
        members: reportedMembers,
      });
    }

    // Orphans: references to stableIds with no chapter row
    const orphanedReferences: AuditOrphanedReferences = {
      summariesWithoutChapter: [],
      translationsWithoutChapter: [],
      feedbackWithoutChapter: feedbackOrphanedUrls,
      bookshelfPointingAtMissing: [],
      navigationPointingAtMissing: [],
      amendmentsPointingAtMissing: [],
    };
    for (const s of summaries) {
      if (s.stableId && !chapterByStableId.has(s.stableId)) {
        orphanedReferences.summariesWithoutChapter.push(s.stableId);
      }
    }
    for (const t of translations) {
      if (t.stableId && !chapterByStableId.has(t.stableId)) {
        orphanedReferences.translationsWithoutChapter.push(t.stableId);
      }
    }
    for (const entry of Object.values(bookshelfState ?? {})) {
      const id = (entry as any)?.lastChapterId;
      if (typeof id === 'string' && !chapterByStableId.has(id)) {
        orphanedReferences.bookshelfPointingAtMissing.push(id);
      }
    }
    for (const id of navigationHistory) {
      if (typeof id === 'string' && !chapterByStableId.has(id)) {
        orphanedReferences.navigationPointingAtMissing.push(id);
      }
    }
    for (const a of amendments) {
      if (a.chapterId && !chapterByStableId.has(a.chapterId)) {
        orphanedReferences.amendmentsPointingAtMissing.push(a.chapterId);
      }
    }

    // Compute redundant-row totals
    let redundantChapterRows = 0;
    let redundantSummaryRows = 0;
    let redundantTranslationRows = 0;
    for (const group of duplicateGroups) {
      redundantChapterRows += group.members.length - 1;
      // Summary rows per stableId in the group (per-stableId; one chapter
      // can have at most one summary row keyed by stableId, but groups
      // have multiple stableIds → multiple summary rows)
      const summariesInGroup = group.members.reduce(
        (sum, m) => sum + (m.referencedBy.summaries || 0),
        0
      );
      if (summariesInGroup > 1) redundantSummaryRows += summariesInGroup - 1;
      const translationsInGroup = group.members.reduce(
        (sum, m) => sum + (m.referencedBy.translations || 0),
        0
      );
      // Translations CAN legitimately have multiple rows per chapter (versions),
      // so "redundant" here means "rows attached to a duplicate-stableId in a
      // group" rather than "rows beyond one." Surface raw count for inspection.
      if (translationsInGroup > 0 && group.members.length > 1) {
        redundantTranslationRows += translationsInGroup;
      }
    }

    return {
      schemaVersion: '1',
      generatedAt: nowIso(),
      totals: {
        chapters: chapters.length,
        summaries: summaries.length,
        translations: translations.length,
        urlMappings: urlMappings.length,
        feedbackEntries: feedback.length,
        amendmentLogs: amendments.length,
        diffResults: diffResults.length,
        bookshelfEntries: Object.keys(bookshelfState ?? {}).length,
        navigationHistoryEntries: navigationHistory.length,
        lastActiveChapterPresent: !!lastActiveChapter?.id,
      },
      duplicateGroups,
      categorization: {
        legacyUnscopedPlusScoped: groupsLegacyUnscopedPlusScoped,
        contentDriftWithinScope: groupsContentDriftWithinScope,
        titleDriftWithinScope: groupsTitleDriftWithinScope,
        urlVariation: groupsUrlVariation,
        nullScopeRows: nullScopeRowCount,
      },
      orphanedReferences,
      estimatedDuplicateLoad: {
        duplicateGroups: duplicateGroups.length,
        redundantChapterRows,
        redundantSummaryRows,
        redundantTranslationRows,
      },
    };
  }

  /**
   * V4: Unwrap nested scoped stableIds and canonicalize version aliases.
   *
   * Background: an earlier write path produced stableIds whose baseHash was itself
   * a fully-formed scoped stableId (e.g. lf-library:NOVEL::v1-st-enhanced:lf-library:NOVEL::v1-composite:ch1000_*).
   * The audit also showed parallel rows under v1-composite (legacy alias) and v1-st-enhanced
   * (current registry version) for the same chapter content.
   *
   * What this does:
   *   1. For every chapter, peel ALL scope wrappers from stableId to recover bare baseHash (chN_*).
   *   2. Re-scope under canonicalVersions[novelId] (e.g. v1-st-enhanced) — this collapses the
   *      v1-composite/v1-st-enhanced split AND removes nested wrappers in one pass.
   *   3. Re-key all references (summaries, translations, url_mappings, amendments, diffResults,
   *      bookshelf, navigation, lastActiveChapter).
   *   4. On collision (multiple old stableIds map to same new stableId), pick a survivor
   *      preferring most-recent lastAccessed and chapter rows with active translations.
   *      Translation rows are NEVER dropped — all are re-keyed onto the survivor stableId
   *      and re-numbered to avoid version conflicts.
   *
   * What this does NOT do:
   *   - Rows whose novelId is not in canonicalVersions are reported as orphans, untouched.
   *   - Rows with different bare base hashes (different content families) stay as distinct
   *     stableIds even when they collide on chapterNumber.
   *   - chapterNumber field correction (separate Phase 2 migration).
   *   - Cross-novel pollution detection (separate Phase 4 audit).
   *
   * Default is dry-run: returns a plan without writing. Pass { dryRun: false, force: true }
   * to commit. Re-runs after success are gated by CHAPTER_IDS_UNWRAPPED_V4 settings flag.
   */
  static async unwrapNestedScopedIds(options: UnwrapOptions): Promise<UnwrapReport> {
    const {
      dryRun = true,
      canonicalVersions,
      force = false,
      sampleLimit = 25,
    } = options;

    if (!canonicalVersions || Object.keys(canonicalVersions).length === 0) {
      throw new Error(
        '[MaintenanceOps.unwrapNestedScopedIds] canonicalVersions is required. ' +
        'Pass a map of novelId -> canonical libraryVersionId, e.g. ' +
        '{ "forty-millenniums-of-cultivation": "v1-st-enhanced" }'
      );
    }

    const flagAlreadySet = Boolean(
      await SettingsOps.getKey<boolean>(SETTINGS.CHAPTER_IDS_UNWRAPPED_V4)
    );

    // ─── Phase 1: scan and plan (read-only) ────────────────────────────────
    const conn = await getConnection();
    const planTxn = conn.transaction(
      [
        STORE_NAMES.CHAPTERS,
        STORE_NAMES.CHAPTER_SUMMARIES,
        STORE_NAMES.TRANSLATIONS,
        STORE_NAMES.URL_MAPPINGS,
        STORE_NAMES.AMENDMENT_LOGS,
        STORE_NAMES.DIFF_RESULTS,
        STORE_NAMES.SETTINGS,
      ],
      'readonly'
    );
    const chapters = (await promisifyRequest(
      planTxn.objectStore(STORE_NAMES.CHAPTERS).getAll()
    )) as ChapterRecord[];
    const summaries = (await promisifyRequest(
      planTxn.objectStore(STORE_NAMES.CHAPTER_SUMMARIES).getAll()
    )) as ChapterSummaryRecord[];
    const translations = (await promisifyRequest(
      planTxn.objectStore(STORE_NAMES.TRANSLATIONS).getAll()
    )) as TranslationRecord[];
    const mappings = (await promisifyRequest(
      planTxn.objectStore(STORE_NAMES.URL_MAPPINGS).getAll()
    )) as UrlMappingRecord[];
    const amendmentLogs = (await promisifyRequest(
      planTxn.objectStore(STORE_NAMES.AMENDMENT_LOGS).getAll()
    )) as AmendmentLogRecord[];
    const diffResults = (await promisifyRequest(
      planTxn.objectStore(STORE_NAMES.DIFF_RESULTS).getAll()
    )) as DiffResult[];
    const bookshelfSetting = (await promisifyRequest(
      planTxn.objectStore(STORE_NAMES.SETTINGS).get('bookshelf-state')
    )) as { key: string; value: Record<string, any>; updatedAt?: string } | undefined;
    const navigationSetting = (await promisifyRequest(
      planTxn.objectStore(STORE_NAMES.SETTINGS).get('navigation-history')
    )) as { key: string; value: { stableIds?: string[] }; updatedAt?: string } | undefined;
    const lastActiveSetting = (await promisifyRequest(
      planTxn.objectStore(STORE_NAMES.SETTINGS).get('lastActiveChapter')
    )) as { key: string; value: { id?: string; url?: string }; updatedAt?: string } | undefined;

    const orphans: UnwrapReport['orphans'] = {
      rowsWithoutNovelId: [],
      novelsNotInCanonicalMap: [],
      malformedBareHashes: [],
      translationsWithoutChapter: [],
      amendmentsWithoutChapter: [],
    };
    const rewrites: UnwrapRewrite[] = [];
    const stableIdRemap = new Map<string, string>();
    const chapterUrlRemap = new Map<string, string>();
    const novelsNotInMap = new Set<string>();
    let chaptersWithNestedIds = 0;

    for (const chapter of chapters) {
      const oldStableId = chapter.stableId || '';
      if (!oldStableId) continue;
      const novelId = chapter.novelId;
      if (!novelId) {
        orphans.rowsWithoutNovelId.push(oldStableId);
        continue;
      }
      const canonicalVersion = canonicalVersions[novelId];
      if (!canonicalVersion) {
        novelsNotInMap.add(novelId);
        continue;
      }
      const bareHash = peelAllScopes(oldStableId);
      const depth = getScopedStableIdDepth(oldStableId);
      if (depth > 1) chaptersWithNestedIds += 1;

      if (!isWellFormedBareHash(bareHash)) {
        orphans.malformedBareHashes.push({ stableId: oldStableId, resolvedBare: bareHash });
        continue;
      }

      const newStableId = `lf-library:${encodeURIComponent(
        buildLibraryScopeKey(novelId, canonicalVersion)
      )}:${bareHash}`;
      const newUrl = buildScopedStorageUrl(bareHash!, novelId, canonicalVersion);

      if (oldStableId !== newStableId) {
        stableIdRemap.set(oldStableId, newStableId);
      }
      if (chapter.url !== newUrl) {
        chapterUrlRemap.set(chapter.url, newUrl);
      }

      rewrites.push({
        oldStableId,
        newStableId,
        bareHash: bareHash!,
        novelId,
        oldVersionId: chapter.libraryVersionId ?? null,
        newVersionId: canonicalVersion,
        chapterNumber: typeof chapter.chapterNumber === 'number' ? chapter.chapterNumber : null,
        titleSnippet: (chapter.title || '').slice(0, 60),
        url: chapter.url,
        newUrl,
        hasNestedScope: depth > 1,
      });
    }

    orphans.novelsNotInCanonicalMap = Array.from(novelsNotInMap).sort();

    // Group chapter rewrites by newStableId to detect collisions
    const groupsByNewStableId = new Map<string, UnwrapRewrite[]>();
    for (const r of rewrites) {
      const bucket = groupsByNewStableId.get(r.newStableId) ?? [];
      bucket.push(r);
      groupsByNewStableId.set(r.newStableId, bucket);
    }

    // Translation/active counts keyed by oldStableId for survivor selection
    const translationCounts = new Map<string, number>();
    const activeTranslationCounts = new Map<string, number>();
    for (const t of translations) {
      const sid = t.stableId || '';
      if (!sid) continue;
      translationCounts.set(sid, (translationCounts.get(sid) ?? 0) + 1);
      if (t.isActive) {
        activeTranslationCounts.set(sid, (activeTranslationCounts.get(sid) ?? 0) + 1);
      }
    }
    const chaptersByOldStableId = new Map<string, ChapterRecord>();
    for (const c of chapters) {
      if (c.stableId) chaptersByOldStableId.set(c.stableId, c);
    }

    const collisions: UnwrapCollision[] = [];
    const survivorOldStableIdByNewStableId = new Map<string, string>();
    for (const [newStableId, bucket] of groupsByNewStableId.entries()) {
      if (bucket.length < 2) {
        survivorOldStableIdByNewStableId.set(newStableId, bucket[0].oldStableId);
        continue;
      }
      const memberChapters = bucket
        .map(r => chaptersByOldStableId.get(r.oldStableId))
        .filter((c): c is ChapterRecord => Boolean(c));
      const survivor = chooseSurvivor(memberChapters, translationCounts, activeTranslationCounts);
      survivorOldStableIdByNewStableId.set(newStableId, survivor.stableId || bucket[0].oldStableId);

      collisions.push({
        newStableId,
        bareHash: bucket[0].bareHash,
        novelId: bucket[0].novelId,
        chapterNumber: bucket[0].chapterNumber,
        members: bucket.map(r => {
          const ch = chaptersByOldStableId.get(r.oldStableId);
          return {
            oldStableId: r.oldStableId,
            contentLength: (ch?.content || '').length,
            titleSnippet: r.titleSnippet,
            translationCount: translationCounts.get(r.oldStableId) ?? 0,
            activeTranslationCount: activeTranslationCounts.get(r.oldStableId) ?? 0,
            lastAccessed: ch?.lastAccessed ?? null,
          };
        }),
        chosenSurvivorOldStableId: survivor.stableId || bucket[0].oldStableId,
      });
    }

    // Orphans: translations and amendments pointing at chapters that don't exist
    for (const t of translations) {
      const sid = t.stableId || '';
      if (!sid) continue;
      if (!chaptersByOldStableId.has(sid)) {
        // Could still be valid via chapterUrl lookup — only flag if URL also misses
        const hasUrlMatch = chapters.some(c => c.url === t.chapterUrl);
        if (!hasUrlMatch) {
          orphans.translationsWithoutChapter.push({
            id: t.id,
            stableId: sid,
            chapterUrl: t.chapterUrl,
          });
        }
      }
    }
    for (const a of amendmentLogs) {
      const cid = a.chapterId || null;
      if (!cid || !chaptersByOldStableId.has(cid)) {
        orphans.amendmentsWithoutChapter.push({ id: a.id, chapterId: cid });
      }
    }

    // Compute rekey impact projections
    const summariesToRekey = summaries.filter(s => stableIdRemap.has(s.stableId)).length;
    const translationsToRekey = translations.filter(t =>
      stableIdRemap.has(t.stableId || '') || chapterUrlRemap.has(t.chapterUrl)
    ).length;
    const urlMappingsToRekey = mappings.filter(m =>
      stableIdRemap.has(m.stableId) || (isLibraryStorageUrl(m.url) && chapterUrlRemap.has(m.url))
    ).length;
    const amendmentsToRekey = amendmentLogs.filter(a =>
      a.chapterId && stableIdRemap.has(a.chapterId)
    ).length;
    const diffResultsToRekey = diffResults.filter(d => stableIdRemap.has(d.chapterId)).length;
    const navigationToRekey = (() => {
      const ids = navigationSetting?.value?.stableIds || [];
      return ids.filter(id => stableIdRemap.has(id)).length;
    })();
    const bookshelfToRekey = (() => {
      const state = bookshelfSetting?.value || {};
      let count = 0;
      for (const entry of Object.values(state)) {
        if (entry && typeof entry === 'object') {
          const e = entry as { lastChapterId?: string };
          if (e.lastChapterId && stableIdRemap.has(e.lastChapterId)) count += 1;
        }
      }
      // If we are rescoping versions, the bookshelf keys themselves change
      const keysShouldChange = Object.keys(state).some(k => {
        const [novelId, ver] = k.split('::');
        const canonical = canonicalVersions[novelId];
        return canonical && ver && ver !== canonical;
      });
      return count + (keysShouldChange ? Object.keys(state).length : 0);
    })();
    const lastActiveToRekey = (() => {
      const id = lastActiveSetting?.value?.id;
      return Boolean(id && stableIdRemap.has(id));
    })();

    const baseReport: UnwrapReport = {
      schemaVersion: '1',
      generatedAt: nowIso(),
      dryRun: true,
      flagAlreadySet,
      canonicalVersions,
      totals: {
        chaptersScanned: chapters.length,
        chaptersWithNestedIds,
        chaptersToRewrite: stableIdRemap.size,
        collisionGroups: collisions.length,
        chaptersDeleted: 0,
        translationsRekeyed: 0,
        summariesRekeyed: 0,
        urlMappingsRekeyed: 0,
        amendmentsRekeyed: 0,
        diffResultsRekeyed: 0,
        bookshelfEntriesRekeyed: 0,
        navigationEntriesRekeyed: 0,
        lastActiveRekeyed: false,
      },
      orphans,
      rewriteSample: rewrites.slice(0, sampleLimit),
      collisions: collisions.slice(0, sampleLimit),
    };

    if (dryRun) {
      // Fill in projected counts so the user sees what WOULD happen
      baseReport.totals.summariesRekeyed = summariesToRekey;
      baseReport.totals.translationsRekeyed = translationsToRekey;
      baseReport.totals.urlMappingsRekeyed = urlMappingsToRekey;
      baseReport.totals.amendmentsRekeyed = amendmentsToRekey;
      baseReport.totals.diffResultsRekeyed = diffResultsToRekey;
      baseReport.totals.navigationEntriesRekeyed = navigationToRekey;
      baseReport.totals.bookshelfEntriesRekeyed = bookshelfToRekey;
      baseReport.totals.lastActiveRekeyed = lastActiveToRekey;
      // chaptersDeleted projection: each collision group loses (members - 1) rows
      baseReport.totals.chaptersDeleted = collisions.reduce(
        (acc, c) => acc + (c.members.length - 1),
        0
      );
      debugLog(
        'indexeddb',
        'summary',
        '[MaintenanceOps.unwrapNestedScopedIds] DRY-RUN plan',
        baseReport.totals
      );
      return baseReport;
    }

    if (flagAlreadySet && !force) {
      debugLog(
        'indexeddb',
        'summary',
        '[MaintenanceOps.unwrapNestedScopedIds] Already applied (flag set). Pass force=true to re-run.'
      );
      return { ...baseReport, dryRun: false };
    }

    // ─── Phase 2: commit (write transaction) ───────────────────────────────
    const commitReport = { ...baseReport, dryRun: false };

    await withWriteTxn(
      [
        STORE_NAMES.CHAPTERS,
        STORE_NAMES.CHAPTER_SUMMARIES,
        STORE_NAMES.TRANSLATIONS,
        STORE_NAMES.URL_MAPPINGS,
        STORE_NAMES.AMENDMENT_LOGS,
        STORE_NAMES.DIFF_RESULTS,
        STORE_NAMES.FEEDBACK,
        STORE_NAMES.SETTINGS,
      ],
      async (_txn, stores) => {
        const chaptersStore = stores[STORE_NAMES.CHAPTERS];
        const summariesStore = stores[STORE_NAMES.CHAPTER_SUMMARIES];
        const translationsStore = stores[STORE_NAMES.TRANSLATIONS];
        const mappingsStore = stores[STORE_NAMES.URL_MAPPINGS];
        const amendmentsStore = stores[STORE_NAMES.AMENDMENT_LOGS];
        const diffResultsStore = stores[STORE_NAMES.DIFF_RESULTS];
        const feedbackStore = stores[STORE_NAMES.FEEDBACK];
        const settingsStore = stores[STORE_NAMES.SETTINGS];

        // Build chapter merges per collision group
        const mergedByNewStableId = new Map<string, ChapterRecord>();
        const survivors = new Set<string>();
        for (const [newStableId, bucket] of groupsByNewStableId.entries()) {
          if (bucket.length === 0) continue;
          const memberChapters = bucket
            .map(r => chaptersByOldStableId.get(r.oldStableId))
            .filter((c): c is ChapterRecord => Boolean(c));
          if (memberChapters.length === 0) continue;
          const newUrl = bucket[0].newUrl;
          const merged = mergeChapterRecords(newStableId, newUrl, memberChapters);
          merged.libraryVersionId = bucket[0].newVersionId;
          merged.canonicalUrl =
            merged.canonicalUrl ||
            normalizeUrlAggressively(merged.originalUrl || merged.url) ||
            merged.url;
          mergedByNewStableId.set(newStableId, merged);
          survivors.add(newStableId);
        }

        // Delete all old chapter rows that are part of any rewrite
        const oldUrlsTouched = new Set<string>();
        for (const r of rewrites) {
          oldUrlsTouched.add(r.url);
        }
        for (const url of oldUrlsTouched) {
          await promisifyRequest(chaptersStore.delete(url));
        }
        // Write merged chapter rows
        for (const merged of mergedByNewStableId.values()) {
          await promisifyRequest(chaptersStore.put(merged));
        }
        commitReport.totals.chaptersDeleted = oldUrlsTouched.size - mergedByNewStableId.size;

        // ─── Translations: re-key stableId + chapterUrl, renumber on collisions ──
        // Bucket every translation by its FINAL stableId (post-remap if any),
        // including translations already at a canonical stableId. Otherwise an
        // already-canonical row sharing a target stableId can collide with a
        // remapped row on the (stableId, version) unique index.
        const targetStableIds = new Set(stableIdRemap.values());
        const translationsByNewStableId = new Map<string, TranslationRecord[]>();
        let translationsRekeyed = 0;
        for (const t of translations) {
          const oldSid = t.stableId || '';
          const newSid = stableIdRemap.get(oldSid);
          const newUrl = chapterUrlRemap.get(t.chapterUrl);
          const finalSid = newSid || oldSid;
          const isAlreadyAtTarget = !newSid && targetStableIds.has(oldSid);
          const isRekeyed = Boolean(newSid || newUrl);
          if (!isRekeyed && !isAlreadyAtTarget) continue;
          const updated: TranslationRecord = {
            ...t,
            stableId: finalSid,
            chapterUrl: newUrl || t.chapterUrl,
          };
          const bucket = translationsByNewStableId.get(finalSid) ?? [];
          bucket.push(updated);
          translationsByNewStableId.set(finalSid, bucket);
        }
        for (const [newSid, bucket] of translationsByNewStableId.entries()) {
          // Pick the chapter URL from the merged chapter (truth)
          const merged = mergedByNewStableId.get(newSid);
          const targetUrl = merged?.url || bucket[0].chapterUrl;
          // Renumber versions to avoid collisions, preserve isActive on most recent
          const sorted = [...bucket].sort((l, r) => {
            const d = translationCreatedAtValue(l) - translationCreatedAtValue(r);
            if (d !== 0) return d;
            return (l.version ?? 0) - (r.version ?? 0);
          });
          const activeCandidates = sorted.filter(t => t.isActive);
          const activeId =
            activeCandidates.length > 0
              ? [...activeCandidates].sort(
                  (l, r) => translationCreatedAtValue(r) - translationCreatedAtValue(l)
                )[0].id
              : sorted[sorted.length - 1]?.id;

          // Delete bucket members FIRST so the (stableId, version) unique
          // index is clear before we re-put with renumbered versions. Without
          // this, a remapped row's put at version=1 collides with a still-
          // present canonical row's existing version=1 entry, even though we
          // plan to renumber that canonical row later in the same loop.
          for (const record of sorted) {
            await promisifyRequest(translationsStore.delete(record.id));
          }

          const usedVersions = new Set<number>();
          let nextVersion = 1;
          for (const record of sorted) {
            let assignedVersion = record.version ?? nextVersion;
            while (usedVersions.has(assignedVersion)) {
              assignedVersion = nextVersion;
              nextVersion += 1;
            }
            usedVersions.add(assignedVersion);
            nextVersion = Math.max(nextVersion, assignedVersion + 1);
            record.version = assignedVersion;
            record.stableId = newSid;
            record.chapterUrl = targetUrl;
            record.isActive = record.id === activeId;
            await promisifyRequest(translationsStore.put(record));
            translationsRekeyed += 1;
          }
        }
        commitReport.totals.translationsRekeyed = translationsRekeyed;

        // ─── Summaries: delete old, regenerate from merged chapter + active translation ──
        const summaryStableIdsToDelete = new Set<string>();
        for (const s of summaries) {
          if (stableIdRemap.has(s.stableId)) summaryStableIdsToDelete.add(s.stableId);
          else if (survivors.has(s.stableId)) summaryStableIdsToDelete.add(s.stableId);
        }
        for (const sid of summaryStableIdsToDelete) {
          await promisifyRequest(summariesStore.delete(sid));
        }
        let summariesRekeyed = 0;
        for (const merged of mergedByNewStableId.values()) {
          const newSid = merged.stableId || '';
          if (!newSid) continue;
          const trBucket = translationsByNewStableId.get(newSid) ?? [];
          const active = trBucket.find(t => t.isActive) || null;
          const rec: ChapterSummaryRecord = {
            stableId: newSid,
            novelId: merged.novelId ?? null,
            libraryVersionId: merged.libraryVersionId ?? null,
            canonicalUrl: merged.canonicalUrl,
            title: merged.title,
            translatedTitle: active?.translatedTitle,
            chapterNumber: merged.chapterNumber,
            hasTranslation: trBucket.length > 0,
            hasImages: Boolean(
              active?.suggestedIllustrations?.some(
                i => i?.url || i?.generatedImage
              )
            ),
            lastAccessed: merged.lastAccessed,
            lastTranslatedAt: active?.createdAt,
          };
          await promisifyRequest(summariesStore.put(rec));
          summariesRekeyed += 1;
        }
        commitReport.totals.summariesRekeyed = summariesRekeyed;

        // ─── URL mappings: delete library:// URLs (they get rebuilt), repoint others ──
        let urlMappingsRekeyed = 0;
        for (const m of mappings) {
          const replacementSid = stableIdRemap.get(m.stableId);
          const isAffected =
            Boolean(replacementSid) ||
            (isLibraryStorageUrl(m.url) && chapterUrlRemap.has(m.url));
          if (!isAffected) continue;

          if (isLibraryStorageUrl(m.url)) {
            await promisifyRequest(mappingsStore.delete(m.url));
            urlMappingsRekeyed += 1;
            continue;
          }
          const targetSid = replacementSid || m.stableId;
          const merged = mergedByNewStableId.get(targetSid);
          await promisifyRequest(
            mappingsStore.put({
              ...m,
              stableId: targetSid,
              novelId: merged?.novelId ?? m.novelId ?? null,
              libraryVersionId: merged?.libraryVersionId ?? m.libraryVersionId ?? null,
              chapterNumber: merged?.chapterNumber ?? m.chapterNumber,
            })
          );
          urlMappingsRekeyed += 1;
        }
        // Re-emit canonical entries for merged chapters
        for (const merged of mergedByNewStableId.values()) {
          for (const entry of buildUrlMappingEntries(merged)) {
            await promisifyRequest(mappingsStore.put(entry));
          }
        }
        commitReport.totals.urlMappingsRekeyed = urlMappingsRekeyed;

        // ─── Amendments: re-key chapterId ─────────────────────────────────
        let amendmentsRekeyed = 0;
        for (const a of amendmentLogs) {
          if (!a.chapterId) continue;
          const replacement = stableIdRemap.get(a.chapterId);
          if (!replacement) continue;
          await promisifyRequest(
            amendmentsStore.put({ ...a, chapterId: replacement })
          );
          amendmentsRekeyed += 1;
        }
        commitReport.totals.amendmentsRekeyed = amendmentsRekeyed;

        // ─── Diff results: delete + reinsert with new chapterId ──────────
        let diffResultsRekeyed = 0;
        const affectedDiffs = diffResults.filter(d => stableIdRemap.has(d.chapterId));
        for (const d of affectedDiffs) {
          await promisifyRequest(diffResultsStore.delete(buildDiffResultKey(d)));
        }
        const dedupedDiffs = new Map<string, DiffResult>();
        for (const d of affectedDiffs) {
          const updated: DiffResult = {
            ...d,
            chapterId: stableIdRemap.get(d.chapterId) || d.chapterId,
          };
          const k = JSON.stringify(buildDiffResultKey(updated));
          const existing = dedupedDiffs.get(k);
          if (!existing || (updated.analyzedAt || 0) > (existing.analyzedAt || 0)) {
            dedupedDiffs.set(k, updated);
          }
        }
        for (const d of dedupedDiffs.values()) {
          await promisifyRequest(diffResultsStore.put(d));
          diffResultsRekeyed += 1;
        }
        commitReport.totals.diffResultsRekeyed = diffResultsRekeyed;

        // ─── Feedback: re-key chapterUrl ─────────────────────────────────
        const feedback = (await promisifyRequest(feedbackStore.getAll())) as FeedbackRecord[];
        for (const f of feedback) {
          const replacement = chapterUrlRemap.get(f.chapterUrl);
          if (!replacement) continue;
          await promisifyRequest(feedbackStore.put({ ...f, chapterUrl: replacement }));
        }

        // ─── Bookshelf: re-key per (novelId, canonicalVersion) ────────────
        if (bookshelfSetting?.value && typeof bookshelfSetting.value === 'object') {
          const next: Record<string, any> = {};
          const byNovel = new Map<string, any[]>();
          for (const [rawKey, rawEntry] of Object.entries(bookshelfSetting.value)) {
            if (!rawEntry || typeof rawEntry !== 'object') continue;
            const e = { ...(rawEntry as Record<string, any>) };
            if (typeof e.lastChapterId === 'string' && stableIdRemap.has(e.lastChapterId)) {
              e.lastChapterId = stableIdRemap.get(e.lastChapterId);
            }
            const novelId = e.novelId || rawKey.split('::')[0];
            const bucket = byNovel.get(novelId) ?? [];
            bucket.push({ ...e, novelId, rawKey });
            byNovel.set(novelId, bucket);
          }
          for (const [novelId, entries] of byNovel.entries()) {
            const canonical = canonicalVersions[novelId];
            if (!canonical) {
              // Novel not managed — preserve as-is
              for (const e of entries) {
                next[e.rawKey] = (() => {
                  const { rawKey: _, ...rest } = e;
                  return rest;
                })();
              }
              continue;
            }
            const winner = [...entries].sort((l, r) =>
              String(r.lastReadAtIso || '').localeCompare(String(l.lastReadAtIso || ''))
            )[0];
            const finalKey = buildLibraryScopeKey(novelId, canonical);
            const { rawKey: _drop, ...rest } = winner;
            next[finalKey] = { ...rest, versionId: canonical };
          }
          if (JSON.stringify(bookshelfSetting.value) !== JSON.stringify(next)) {
            await promisifyRequest(
              settingsStore.put({
                key: 'bookshelf-state',
                value: next,
                updatedAt: nowIso(),
              })
            );
            commitReport.totals.bookshelfEntriesRekeyed = Object.keys(bookshelfSetting.value).length;
          }
        }

        // ─── Navigation history: re-key, dedupe ───────────────────────────
        if (navigationSetting?.value?.stableIds) {
          const ids = navigationSetting.value.stableIds;
          const repaired = ids.map(id => stableIdRemap.get(id) || id);
          const deduped = [...new Set(repaired)];
          if (JSON.stringify(ids) !== JSON.stringify(deduped)) {
            await promisifyRequest(
              settingsStore.put({
                key: 'navigation-history',
                value: { stableIds: deduped },
                updatedAt: nowIso(),
              })
            );
            commitReport.totals.navigationEntriesRekeyed = ids.length;
          }
        }

        // ─── Last active chapter ──────────────────────────────────────────
        const lastActiveId = lastActiveSetting?.value?.id;
        if (lastActiveId && stableIdRemap.has(lastActiveId)) {
          await promisifyRequest(
            settingsStore.put({
              key: 'lastActiveChapter',
              value: {
                ...lastActiveSetting?.value,
                id: stableIdRemap.get(lastActiveId),
              },
              updatedAt: nowIso(),
            })
          );
          commitReport.totals.lastActiveRekeyed = true;
        }
      },
      'maintenance',
      'unwrap',
      'nestedScopedIdsV4'
    );

    await SettingsOps.set(SETTINGS.CHAPTER_IDS_UNWRAPPED_V4, true);
    debugLog(
      'indexeddb',
      'summary',
      '[MaintenanceOps.unwrapNestedScopedIds] COMMIT complete',
      commitReport.totals
    );
    return commitReport;
  }

  /**
   * V5 (issue #20): correct chapter rows whose `chapterNumber` field has
   * drifted from the chapter number encoded in their `stableId` baseHash.
   * See issues/20-chapter-number-drift-from-history-walker/README.md.
   *
   * Conservative: only restores chapterNumber when stableId baseHash AND
   * "Chapter N" parsed from title agree on N. Skips rows where signals
   * don't triangulate. Re-emits chapter_summary so summaries stay in sync.
   *
   * Default is dry-run. Pass { dryRun: false, force: true } to commit.
   * Re-runs gated by CHAPTER_NUMBER_CORRECTED_V5 settings flag.
   */
  static async correctChapterNumberDrift(options: {
    dryRun?: boolean;
    force?: boolean;
    sampleLimit?: number;
  } = {}): Promise<{
    schemaVersion: '1';
    generatedAt: string;
    dryRun: boolean;
    flagAlreadySet: boolean;
    totals: {
      chaptersScanned: number;
      driftedRows: number;
      corrected: number;
      summariesUpdated: number;
      skipped_noBareHash: number;
      skipped_titleMissingNumber: number;
      skipped_bareTitleDisagree: number;
    };
    correctionSample: Array<{
      stableId: string;
      bareN: number;
      titleN: number;
      previousChapterNumber: number | null;
      title: string;
    }>;
    skippedSample: Array<{
      stableId: string;
      reason: string;
      bareN: number | null;
      titleN: number | null;
      currentChapterNumber: number | null;
      titleSnippet: string;
    }>;
  }> {
    const { dryRun = true, force = false, sampleLimit = 25 } = options;

    const flagAlreadySet = Boolean(
      await SettingsOps.getKey<boolean>(SETTINGS.CHAPTER_NUMBER_CORRECTED_V5)
    );

    const conn = await getConnection();
    const planTxn = conn.transaction(
      [STORE_NAMES.CHAPTERS, STORE_NAMES.CHAPTER_SUMMARIES],
      'readonly'
    );
    const chapters = (await promisifyRequest(
      planTxn.objectStore(STORE_NAMES.CHAPTERS).getAll()
    )) as ChapterRecord[];
    const summaries = (await promisifyRequest(
      planTxn.objectStore(STORE_NAMES.CHAPTER_SUMMARIES).getAll()
    )) as ChapterSummaryRecord[];
    const summariesByStableId = new Map<string, ChapterSummaryRecord>();
    for (const s of summaries) summariesByStableId.set(s.stableId, s);

    const BARE_RE = /:ch(\d+)_/;
    const TITLE_RE = /\bChapter\s+(\d+)/i;

    type Drift = {
      record: ChapterRecord;
      bareN: number;
      titleN: number;
      previousChapterNumber: number | null;
    };
    const drifts: Drift[] = [];
    const skipped_noBareHash: ChapterRecord[] = [];
    const skipped_titleMissingNumber: ChapterRecord[] = [];
    const skipped_bareTitleDisagree: Array<{
      record: ChapterRecord;
      bareN: number;
      titleN: number;
    }> = [];

    for (const ch of chapters) {
      const sid = ch.stableId || '';
      const bareMatch = sid.match(BARE_RE);
      if (!bareMatch) {
        skipped_noBareHash.push(ch);
        continue;
      }
      const bareN = parseInt(bareMatch[1], 10);
      if (!Number.isFinite(bareN) || bareN <= 0) {
        skipped_noBareHash.push(ch);
        continue;
      }
      const titleMatch = (ch.title || '').match(TITLE_RE);
      if (!titleMatch) {
        skipped_titleMissingNumber.push(ch);
        continue;
      }
      const titleN = parseInt(titleMatch[1], 10);
      if (titleN !== bareN) {
        skipped_bareTitleDisagree.push({ record: ch, bareN, titleN });
        continue;
      }
      if (typeof ch.chapterNumber !== 'number' || ch.chapterNumber !== bareN) {
        drifts.push({
          record: ch,
          bareN,
          titleN,
          previousChapterNumber:
            typeof ch.chapterNumber === 'number' ? ch.chapterNumber : null,
        });
      }
    }

    const baseReport = {
      schemaVersion: '1' as const,
      generatedAt: nowIso(),
      dryRun: true,
      flagAlreadySet,
      totals: {
        chaptersScanned: chapters.length,
        driftedRows: drifts.length,
        corrected: 0,
        summariesUpdated: 0,
        skipped_noBareHash: skipped_noBareHash.length,
        skipped_titleMissingNumber: skipped_titleMissingNumber.length,
        skipped_bareTitleDisagree: skipped_bareTitleDisagree.length,
      },
      correctionSample: drifts.slice(0, sampleLimit).map(d => ({
        stableId: d.record.stableId || '',
        bareN: d.bareN,
        titleN: d.titleN,
        previousChapterNumber: d.previousChapterNumber,
        title: (d.record.title || '').slice(0, 80),
      })),
      skippedSample: [
        ...skipped_bareTitleDisagree.slice(0, Math.floor(sampleLimit / 2)).map(s => ({
          stableId: s.record.stableId || '',
          reason: 'bareN !== titleN',
          bareN: s.bareN,
          titleN: s.titleN,
          currentChapterNumber:
            typeof s.record.chapterNumber === 'number' ? s.record.chapterNumber : null,
          titleSnippet: (s.record.title || '').slice(0, 80),
        })),
        ...skipped_titleMissingNumber.slice(0, Math.floor(sampleLimit / 2)).map(r => ({
          stableId: r.stableId || '',
          reason: 'title has no "Chapter N"',
          bareN: null,
          titleN: null,
          currentChapterNumber:
            typeof r.chapterNumber === 'number' ? r.chapterNumber : null,
          titleSnippet: (r.title || '').slice(0, 80),
        })),
      ].slice(0, sampleLimit),
    };

    if (dryRun) {
      debugLog('indexeddb', 'summary', '[MaintenanceOps.correctChapterNumberDrift] DRY-RUN', baseReport.totals);
      return baseReport;
    }

    if (flagAlreadySet && !force) {
      return { ...baseReport, dryRun: false };
    }

    if (drifts.length === 0) {
      await SettingsOps.set(SETTINGS.CHAPTER_NUMBER_CORRECTED_V5, true);
      return { ...baseReport, dryRun: false };
    }

    const commitReport = { ...baseReport, dryRun: false };
    let corrected = 0;
    let summariesUpdated = 0;

    await withWriteTxn(
      [STORE_NAMES.CHAPTERS, STORE_NAMES.CHAPTER_SUMMARIES],
      async (_txn, stores) => {
        const chaptersStore = stores[STORE_NAMES.CHAPTERS];
        const summariesStore = stores[STORE_NAMES.CHAPTER_SUMMARIES];

        for (const d of drifts) {
          const updated: ChapterRecord = {
            ...d.record,
            chapterNumber: d.bareN,
            lastAccessed: nowIso(),
          };
          await promisifyRequest(chaptersStore.put(updated));
          corrected += 1;

          const existingSummary = summariesByStableId.get(d.record.stableId || '');
          if (existingSummary) {
            await promisifyRequest(
              summariesStore.put({
                ...existingSummary,
                chapterNumber: d.bareN,
              })
            );
            summariesUpdated += 1;
          }
        }
      },
      'maintenance',
      'correct',
      'chapterNumberDriftV5'
    );

    commitReport.totals.corrected = corrected;
    commitReport.totals.summariesUpdated = summariesUpdated;

    await SettingsOps.set(SETTINGS.CHAPTER_NUMBER_CORRECTED_V5, true);
    debugLog(
      'indexeddb',
      'summary',
      '[MaintenanceOps.correctChapterNumberDrift] COMMIT complete',
      commitReport.totals
    );
    return commitReport;
  }

  static async clearAllData(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        console.warn('[MaintenanceOps] clearAllData blocked by another tab.');
      };
    });
    resetConnection();
  }
}

async function updateTranslationsStableId(
  store: IDBObjectStore,
  chapterUrl: string,
  stableId?: string
): Promise<void> {
  if (!stableId) return;
  await new Promise<void>((resolve, reject) => {
    const index = store.index('chapterUrl');
    const cursorRequest = index.openCursor(IDBKeyRange.only(chapterUrl));
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result as IDBCursorWithValue | null;
      if (!cursor) {
        resolve();
        return;
      }
      const record = cursor.value as TranslationRecord;
      record.stableId = stableId;
      cursor.update(record);
      cursor.continue();
    };
    cursorRequest.onerror = () => reject(cursorRequest.error);
  });
}

if (typeof window !== 'undefined') {
  (window as any).MaintenanceOps = MaintenanceOps;
}
