import type { ChapterRecord, TranslationRecord, UrlMappingRecord } from '../types';
import { generateStableChapterId, normalizeUrlAggressively } from '../../stableIdService';
import { DB_NAME, getConnection, resetConnection } from '../core/connection';
import { STORE_NAMES } from '../core/schema';
import { withWriteTxn, withReadTxn, promisifyRequest } from '../core/txn';
import { SettingsOps } from './settings';

const URL_MAPPINGS_BACKFILL_VERSION = 2;
const SETTINGS = {
  URL_BACKFILL_VERSION: 'urlMappingsBackfillVersion',
  URL_BACKFILL_FLAG: 'urlMappingsBackfilled',
  STABLE_ID_NORMALIZED: 'stableIdNormalized',
  ACTIVE_TRANSLATIONS_V2: 'activeTranslationsBackfilledV2',
} as const;

const nowIso = () => new Date().toISOString();

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
    entries.push({ url: canonical, stableId, isCanonical: true, dateAdded: timestamp });
  }
  if (original && original !== canonical) {
    entries.push({ url: original, stableId, isCanonical: false, dateAdded: timestamp });
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
