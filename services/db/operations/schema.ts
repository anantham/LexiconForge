import { applyMigrations, SCHEMA_VERSIONS, STORE_NAMES } from '../core/schema';
import { ChapterOps } from './chapters';
import { SummaryOpsDeps, seedChapterSummariesIfEmpty, recomputeSummary, deleteSummary, type RecomputeOptions } from './summaries';
import { getConnection, DB_NAME } from '../core/connection';

const DB_VERSION = SCHEMA_VERSIONS.CURRENT;

const requiredStores = Object.values(STORE_NAMES);
const liveSummaryDeps: SummaryOpsDeps = {
  openDatabase: () => getConnection(),
  getChapter: ChapterOps.getByUrl,
  getChapterByStableId: ChapterOps.getByStableId,
  getActiveTranslation: ChapterOps.getActiveTranslation,
  normalizeUrl: ChapterOps.normalizeUrl,
};

const ensureTranslationIndexes = async (db: IDBDatabase): Promise<void> => {
  try {
    const tx = db.transaction([STORE_NAMES.TRANSLATIONS], 'readonly');
    const store = tx.objectStore(STORE_NAMES.TRANSLATIONS);
    const idxNames = Array.from(store.indexNames || []);
    const missingChapterUrlVersion = !idxNames.includes('chapterUrl_version');
    const missingStableId = !idxNames.includes('stableId');
    const missingStableIdVersion = !idxNames.includes('stableId_version');
    if (!missingChapterUrlVersion && !missingStableId && !missingStableIdVersion) {
      return;
    }
  } catch {
    return;
  }

  throw new Error(
    '[IndexedDB] Missing translation indexes (chapterUrl_version / stableId / stableId_version) after migration'
  );
};

const ensureChapterIndexes = async (db: IDBDatabase): Promise<void> => {
  try {
    const tx = db.transaction([STORE_NAMES.CHAPTERS], 'readonly');
    const store = tx.objectStore(STORE_NAMES.CHAPTERS);
    const idxNames = Array.from(store.indexNames || []);
    if (idxNames.includes('chapterNumber')) return;
  } catch {
    return;
  }

  throw new Error('[IndexedDB] Missing chapterNumber index on chapters store after migration');
};

export interface SchemaTestResult {
  success: boolean;
  message: string;
  details: {
    version: number;
    storeNames: string[];
    expectedStores: string[];
    urlIndexes: string[];
    novelIndexes: string[];
    missingStores: string[];
    dbName: string;
    error?: string;
  };
}

export const SchemaOps = {
  async openDatabaseWithMigrations(): Promise<IDBDatabase> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('lexicon-forge', DB_VERSION);

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;
        const tx = request.transaction;
        if (!tx) {
          reject(new Error('[IndexedDB] Upgrade transaction missing; cannot apply migrations'));
          return;
        }
        const oldVersion = (event as IDBVersionChangeEvent).oldVersion || 0;
        const target = db.version ?? DB_VERSION;
        try {
          applyMigrations(db, tx, oldVersion, target);
        } catch (error) {
          reject(error);
        }
      };

      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
      request.onblocked = () => {
        // ignore (browser will notify user)
      };
      request.onsuccess = () => resolve(request.result);
    });

    if (db.version > DB_VERSION) {
      db.close();
      throw new Error(
        `[IndexedDB] Database version ${db.version} is newer than runtime schema ${DB_VERSION}`
      );
    }

    db.onversionchange = () => {
      db.close();
    };

    await this.verifySchema(db);
    return db;
  },

  async verifySchema(db: IDBDatabase): Promise<void> {
    const existing = Array.from(db.objectStoreNames);
    const missing = requiredStores.filter(store => !existing.includes(store));
    if (missing.length > 0) {
      throw new Error(
        `[IndexedDB] Schema drift detected - missing stores: ${missing.join(', ')}`
      );
    }

    await ensureTranslationIndexes(db);
    await ensureChapterIndexes(db);
    await this.ensureChapterSummaries(db);
  },

  async ensureChapterSummaries(db: IDBDatabase): Promise<void> {
    if (!db.objectStoreNames.contains(STORE_NAMES.CHAPTER_SUMMARIES)) {
      return;
    }

    const deps: SummaryOpsDeps = {
      openDatabase: () => Promise.resolve(db),
      getChapter: (url: string) => ChapterOps.getByUrl(url),
      getChapterByStableId: (stableId: string) => ChapterOps.getByStableId(stableId),
      getActiveTranslation: (url: string) => ChapterOps.getActiveTranslation(url),
      normalizeUrl: ChapterOps.normalizeUrl,
    } as SummaryOpsDeps;

    await seedChapterSummariesIfEmpty(deps);
  },

  async recomputeChapterSummary(options: RecomputeOptions): Promise<void> {
    await recomputeSummary(liveSummaryDeps, options);
  },

  async deleteChapterSummary(stableId: string): Promise<void> {
    await deleteSummary(liveSummaryDeps, stableId);
  },

  async testStableIdSchema(): Promise<SchemaTestResult> {
    try {
      const db = await getConnection();
      const version = db.version;
      const storeNames = Array.from(db.objectStoreNames).sort();
      const expectedStores = Object.values(STORE_NAMES).sort();
      const missingStores = expectedStores.filter(store => !storeNames.includes(store));

      const readIndexes = (storeName: string): string[] => {
        if (!db.objectStoreNames.contains(storeName)) {
          return [];
        }
        const tx = db.transaction([storeName], 'readonly');
        const store = tx.objectStore(storeName);
        return Array.from(store.indexNames).sort();
      };

      const urlIndexes = readIndexes(STORE_NAMES.URL_MAPPINGS);
      const novelIndexes = readIndexes(STORE_NAMES.NOVELS);

      const success = missingStores.length === 0;
      const message = success
        ? `Schema migration successful. Database version ${version} with ${storeNames.length} stores.`
        : `Missing stores: ${missingStores.join(', ')}`;

      return {
        success,
        message,
        details: {
          version,
          storeNames,
          expectedStores,
          urlIndexes,
          novelIndexes,
          missingStores,
          dbName: DB_NAME,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Schema test failed: ${error?.message ?? error}`,
        details: {
          version: -1,
          storeNames: [],
          expectedStores: Object.values(STORE_NAMES).sort(),
          urlIndexes: [],
          novelIndexes: [],
          missingStores: [],
          dbName: DB_NAME,
          error: error?.message ?? String(error),
        },
      };
    }
  },
};
