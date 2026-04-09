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
} as const;

const nowIso = () => new Date().toISOString();

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
  if (!isScopedStableId(stableId)) {
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
