/**
 * Database Schema Management - Hybrid Approach
 * 
 * Pure migration functions and schema definitions.
 * Keeps schema changes testable and version-controlled.
 */

import type { Chapter, TranslationResult, AppSettings, FeedbackItem, PromptTemplate } from '../../../types';

// Schema version history
export const SCHEMA_VERSIONS = {
  INITIAL: 1,
  ADD_INDEXES: 2,
  STABLE_IDS: 3,
  PROMPT_TEMPLATES: 4,
  URL_MAPPINGS: 5,
  ARCHITECTURE_ENHANCEMENTS: 6,
  CANONICAL_DATA_STORES: 7,
  INDEX_REPAIRS: 8,
  AUTO_MIGRATION_CAP: 9,
  CHAPTER_NUMBER_INDEX: 10,
  AMENDMENT_LOGS: 11,
  DIFF_RESULTS: 12,
  SCHEMA_REPAIR: 13,
  CURRENT: 13,
} as const;

// Object store definitions
export const STORE_NAMES = {
  CHAPTERS: 'chapters',
  TRANSLATIONS: 'translations',
  SETTINGS: 'settings',
  FEEDBACK: 'feedback',
  PROMPT_TEMPLATES: 'prompt_templates',
  URL_MAPPINGS: 'url_mappings',
  NOVELS: 'novels',
  CHAPTER_SUMMARIES: 'chapter_summaries',
  AMENDMENT_LOGS: 'amendment_logs',
  DIFF_RESULTS: 'diffResults',
} as const;

// Domain-to-stores mapping (for Claude's domain organization)
export const DOMAIN_STORES = {
  chapters: [STORE_NAMES.CHAPTERS, STORE_NAMES.URL_MAPPINGS, STORE_NAMES.CHAPTER_SUMMARIES],
  translations: [STORE_NAMES.TRANSLATIONS, STORE_NAMES.DIFF_RESULTS],
  settings: [STORE_NAMES.SETTINGS, STORE_NAMES.PROMPT_TEMPLATES],
  feedback: [STORE_NAMES.FEEDBACK],
  novels: [STORE_NAMES.NOVELS, STORE_NAMES.URL_MAPPINGS],
  summaries: [STORE_NAMES.CHAPTER_SUMMARIES],
} as const;

/**
 * Schema migration function type
 */
export type MigrationFunction = (
  db: IDBDatabase,
  transaction: IDBTransaction,
  oldVersion: number,
  newVersion: number
) => void | Promise<void>;

/**
 * Registry of all migration functions
 */
export const MIGRATIONS: Record<number, MigrationFunction> = {
  1: migrateToV1,
  2: migrateToV2,
  3: migrateToV3,
  4: migrateToV4,
  5: migrateToV5,
  6: migrateToV6,
  7: migrateToV7,
  8: migrateToV8,
  9: migrateToV9,
  10: migrateToV10,
  11: migrateToV11,
  12: migrateToV12,
  13: migrateToV13,
};

function ensureStore(
  db: IDBDatabase,
  transaction: IDBTransaction,
  name: string,
  options?: IDBObjectStoreParameters
): IDBObjectStore {
  if (!db.objectStoreNames.contains(name)) {
    return db.createObjectStore(name, options);
  }
  return transaction.objectStore(name);
}

function ensureIndex(
  store: IDBObjectStore,
  indexName: string,
  keyPath: string | string[],
  options?: IDBIndexParameters
): void {
  if (!store.indexNames.contains(indexName)) {
    store.createIndex(indexName, keyPath, options);
  }
}

/**
 * Apply all necessary migrations from oldVersion to newVersion
 */
export function applyMigrations(
  db: IDBDatabase,
  transaction: IDBTransaction,
  oldVersion: number,
  newVersion: number
): void {
  console.log(`Applying migrations from version ${oldVersion} to ${newVersion}`);
  
  for (let version = oldVersion + 1; version <= newVersion; version++) {
    const migration = MIGRATIONS[version];
    if (migration) {
      console.log(`Applying migration to version ${version}`);
      migration(db, transaction, oldVersion, newVersion);
    }
  }
}

/**
 * Migration to version 1: Initial schema
 */
function migrateToV1(db: IDBDatabase, transaction: IDBTransaction): void {
  const chaptersStore = ensureStore(db, transaction, STORE_NAMES.CHAPTERS, { keyPath: 'url' });
  ensureIndex(chaptersStore, 'title', 'title');
  ensureIndex(chaptersStore, 'createdAt', 'createdAt');
  ensureIndex(chaptersStore, 'stableId', 'stableId');
  ensureIndex(chaptersStore, 'canonicalUrl', 'canonicalUrl');
  ensureIndex(chaptersStore, 'chapterNumber', 'chapterNumber');
  ensureIndex(chaptersStore, 'dateAdded', 'dateAdded');
  ensureIndex(chaptersStore, 'lastAccessed', 'lastAccessed');

  const translationsStore = ensureStore(db, transaction, STORE_NAMES.TRANSLATIONS, { keyPath: 'id' });
  ensureIndex(translationsStore, 'chapterUrl', 'chapterUrl');
  ensureIndex(translationsStore, 'createdAt', 'createdAt');
  ensureIndex(translationsStore, 'version', 'version');
  ensureIndex(translationsStore, 'isActive', 'isActive');
  ensureIndex(translationsStore, 'provider', 'provider');
  ensureIndex(translationsStore, 'model', 'model');

  ensureStore(db, transaction, STORE_NAMES.SETTINGS, { keyPath: 'key' });

  const feedbackStore = ensureStore(db, transaction, STORE_NAMES.FEEDBACK, { keyPath: 'id' });
  ensureIndex(feedbackStore, 'chapterUrl', 'chapterUrl');
  ensureIndex(feedbackStore, 'createdAt', 'createdAt');
}

/**
 * Migration to version 2: Add performance indexes
 */
function migrateToV2(db: IDBDatabase, transaction: IDBTransaction): void {
  const translationsStore = ensureStore(db, transaction, STORE_NAMES.TRANSLATIONS, { keyPath: 'id' });
  ensureIndex(translationsStore, 'chapterUrl_version', ['chapterUrl', 'version'], { unique: true });
  ensureIndex(translationsStore, 'active', ['chapterUrl', 'isActive']);
}

/**
 * Migration to version 3: Add stable ID support
 */
function migrateToV3(db: IDBDatabase, transaction: IDBTransaction): void {
  const chaptersStore = ensureStore(db, transaction, STORE_NAMES.CHAPTERS, { keyPath: 'url' });
  ensureIndex(chaptersStore, 'stableId', 'stableId');
  ensureIndex(chaptersStore, 'canonicalUrl', 'canonicalUrl');

  const translationsStore = ensureStore(db, transaction, STORE_NAMES.TRANSLATIONS, { keyPath: 'id' });
  ensureIndex(translationsStore, 'stableId', 'stableId');
}

/**
 * Migration to version 4: Add prompt templates
 */
function migrateToV4(db: IDBDatabase, transaction: IDBTransaction): void {
  const templatesStore = ensureStore(db, transaction, STORE_NAMES.PROMPT_TEMPLATES, { keyPath: 'id' });
  ensureIndex(templatesStore, 'name', 'name', { unique: true });
  ensureIndex(templatesStore, 'isDefault', 'isDefault');
  ensureIndex(templatesStore, 'createdAt', 'createdAt');
  ensureIndex(templatesStore, 'lastUsed', 'lastUsed');
}

/**
 * Migration to version 5: Add URL mappings for stable IDs
 */
function migrateToV5(db: IDBDatabase, transaction: IDBTransaction): void {
  const urlMappingsStore = ensureStore(db, transaction, STORE_NAMES.URL_MAPPINGS, { keyPath: 'url' });
  ensureIndex(urlMappingsStore, 'stableId', 'stableId');
  ensureIndex(urlMappingsStore, 'novelId', 'novelId');
}

/**
 * Migration to version 6: Enhanced schema for new architecture
 */
function migrateToV6(db: IDBDatabase, transaction: IDBTransaction): void {
  const feedbackStore = ensureStore(db, transaction, STORE_NAMES.FEEDBACK, { keyPath: 'id' });
  ensureIndex(feedbackStore, 'translationId', 'translationId');

  const translationsStore = ensureStore(db, transaction, STORE_NAMES.TRANSLATIONS, { keyPath: 'id' });
  ensureIndex(translationsStore, 'chapterVersion', ['chapterUrl', 'version'], { unique: true });

  const urlMappingsStore = ensureStore(db, transaction, STORE_NAMES.URL_MAPPINGS, { keyPath: 'url' });
  ensureIndex(urlMappingsStore, 'novelChapter', ['novelId', 'chapterNumber']);
}

/**
 * Migration to version 7: Add canonical data stores and indexes
 */
function migrateToV7(db: IDBDatabase, transaction: IDBTransaction): void {
  const urlStore = ensureStore(db, transaction, STORE_NAMES.URL_MAPPINGS, { keyPath: 'url' });
  ensureIndex(urlStore, 'stableId', 'stableId');
  ensureIndex(urlStore, 'isCanonical', 'isCanonical');
  ensureIndex(urlStore, 'dateAdded', 'dateAdded');
  ensureIndex(urlStore, 'novelId', 'novelId');

  const novelStore = ensureStore(db, transaction, STORE_NAMES.NOVELS, { keyPath: 'id' });
  ensureIndex(novelStore, 'source', 'source');
  ensureIndex(novelStore, 'title', 'title');
  ensureIndex(novelStore, 'dateAdded', 'dateAdded');
  ensureIndex(novelStore, 'lastAccessed', 'lastAccessed');

  const summaryStore = ensureStore(db, transaction, STORE_NAMES.CHAPTER_SUMMARIES, { keyPath: 'stableId' });
  ensureIndex(summaryStore, 'chapterNumber', 'chapterNumber');
  ensureIndex(summaryStore, 'lastAccessed', 'lastAccessed');
  ensureIndex(summaryStore, 'hasTranslation', 'hasTranslation');
}

/**
 * Migration to version 8: Ensure compound indexes exist for translations and chapters
 */
function migrateToV8(db: IDBDatabase, transaction: IDBTransaction): void {
  const translationsStore = ensureStore(db, transaction, STORE_NAMES.TRANSLATIONS, { keyPath: 'id' });
  ensureIndex(translationsStore, 'chapterUrl_version', ['chapterUrl', 'version'], { unique: true });
  ensureIndex(translationsStore, 'stableId', 'stableId');
  ensureIndex(translationsStore, 'stableId_version', ['stableId', 'version'], { unique: true });

  const chaptersStore = ensureStore(db, transaction, STORE_NAMES.CHAPTERS, { keyPath: 'url' });
  ensureIndex(chaptersStore, 'chapterNumber', 'chapterNumber');
}

/**
 * Migration to version 9: Anchor legacy auto-upgrade ceiling (no-op)
 *
 * Some browsers auto-incremented the schema past 8 via the legacy `db.version + 1` helpers.
 * This no-op migration allows those databases to open cleanly without further structural changes.
 */
function migrateToV9(): void {
  // Intentional no-op: schema already matches v8 definitions.
}

/**
 * Migration to version 10: Guarantee chapterNumber index exists even for legacy installations.
 */
function migrateToV10(db: IDBDatabase, transaction: IDBTransaction): void {
  const chaptersStore = ensureStore(db, transaction, STORE_NAMES.CHAPTERS, { keyPath: 'url' });
  ensureIndex(chaptersStore, 'chapterNumber', 'chapterNumber');
}

/**
 * Migration to version 11: Add amendment logs store for tracking prompt proposal actions
 */
function migrateToV11(db: IDBDatabase, transaction: IDBTransaction): void {
  const amendmentLogsStore = ensureStore(db, transaction, STORE_NAMES.AMENDMENT_LOGS, { keyPath: 'id' });
  ensureIndex(amendmentLogsStore, 'timestamp', 'timestamp');
  ensureIndex(amendmentLogsStore, 'chapterId', 'chapterId');
  ensureIndex(amendmentLogsStore, 'action', 'action');
}

/**
 * Migration to version 12: Add diffResults store for semantic diff analysis
 */
function migrateToV12(db: IDBDatabase, transaction: IDBTransaction): void {
  const diffResultsStore = ensureStore(db, transaction, STORE_NAMES.DIFF_RESULTS, {
    keyPath: ['chapterId', 'aiVersionId', 'fanVersionId', 'rawVersionId', 'algoVersion'],
  });
  ensureIndex(diffResultsStore, 'by_chapter', 'chapterId');
  ensureIndex(diffResultsStore, 'by_analyzed_at', 'analyzedAt');
}

/**
 * Migration to version 13: Schema repair - ensures ALL stores and indexes exist
 * This is a comprehensive repair migration that re-runs all store/index creation.
 * It handles databases that somehow ended up with missing stores or indexes.
 */
function migrateToV13(db: IDBDatabase, transaction: IDBTransaction): void {
  console.log('[Migration v13] Running schema repair...');

  // Log existing stores for debugging
  const existingStores = Array.from(db.objectStoreNames);
  console.log('[Migration v13] Existing stores:', existingStores);

  // Chapters store and indexes
  const chaptersStore = ensureStore(db, transaction, STORE_NAMES.CHAPTERS, { keyPath: 'url' });
  ensureIndex(chaptersStore, 'stableId', 'stableId');
  ensureIndex(chaptersStore, 'title', 'title');
  ensureIndex(chaptersStore, 'canonicalUrl', 'canonicalUrl');
  ensureIndex(chaptersStore, 'chapterNumber', 'chapterNumber');
  ensureIndex(chaptersStore, 'dateAdded', 'dateAdded');
  ensureIndex(chaptersStore, 'lastAccessed', 'lastAccessed');

  // Translations store and indexes
  const translationsStore = ensureStore(db, transaction, STORE_NAMES.TRANSLATIONS, { keyPath: 'id' });
  ensureIndex(translationsStore, 'chapterUrl', 'chapterUrl');
  ensureIndex(translationsStore, 'stableId', 'stableId');
  ensureIndex(translationsStore, 'version', ['chapterUrl', 'version'], { unique: true });
  ensureIndex(translationsStore, 'chapterUrl_version', ['chapterUrl', 'version'], { unique: true });
  ensureIndex(translationsStore, 'stableId_version', ['stableId', 'version'], { unique: true });
  ensureIndex(translationsStore, 'isActive', 'isActive');
  ensureIndex(translationsStore, 'createdAt', 'createdAt');

  // Settings store
  ensureStore(db, transaction, STORE_NAMES.SETTINGS, { keyPath: 'key' });

  // Feedback store and indexes
  const feedbackStore = ensureStore(db, transaction, STORE_NAMES.FEEDBACK, { keyPath: 'id' });
  ensureIndex(feedbackStore, 'chapterUrl', 'chapterUrl');
  ensureIndex(feedbackStore, 'translationId', 'translationId');
  ensureIndex(feedbackStore, 'createdAt', 'createdAt');

  // Prompt templates store and indexes
  const promptStore = ensureStore(db, transaction, STORE_NAMES.PROMPT_TEMPLATES, { keyPath: 'id' });
  ensureIndex(promptStore, 'name', 'name', { unique: true });
  ensureIndex(promptStore, 'isDefault', 'isDefault');
  ensureIndex(promptStore, 'createdAt', 'createdAt');
  ensureIndex(promptStore, 'lastUsed', 'lastUsed');

  // URL mappings store and indexes
  const urlStore = ensureStore(db, transaction, STORE_NAMES.URL_MAPPINGS, { keyPath: 'url' });
  ensureIndex(urlStore, 'stableId', 'stableId');
  ensureIndex(urlStore, 'isCanonical', 'isCanonical');
  ensureIndex(urlStore, 'dateAdded', 'dateAdded');

  // Novels store and indexes
  const novelStore = ensureStore(db, transaction, STORE_NAMES.NOVELS, { keyPath: 'id' });
  ensureIndex(novelStore, 'source', 'source');
  ensureIndex(novelStore, 'title', 'title');
  ensureIndex(novelStore, 'dateAdded', 'dateAdded');
  ensureIndex(novelStore, 'lastAccessed', 'lastAccessed');

  // Chapter summaries store and indexes
  const summaryStore = ensureStore(db, transaction, STORE_NAMES.CHAPTER_SUMMARIES, { keyPath: 'stableId' });
  ensureIndex(summaryStore, 'chapterNumber', 'chapterNumber');
  ensureIndex(summaryStore, 'lastAccessed', 'lastAccessed');
  ensureIndex(summaryStore, 'hasTranslation', 'hasTranslation');

  // Amendment logs store and indexes
  const amendmentStore = ensureStore(db, transaction, STORE_NAMES.AMENDMENT_LOGS, { keyPath: 'id' });
  ensureIndex(amendmentStore, 'timestamp', 'timestamp');
  ensureIndex(amendmentStore, 'chapterId', 'chapterId');
  ensureIndex(amendmentStore, 'action', 'action');

  // Diff results store and indexes
  const diffStore = ensureStore(db, transaction, STORE_NAMES.DIFF_RESULTS, {
    keyPath: ['chapterId', 'aiVersionId', 'fanVersionId', 'rawVersionId', 'algoVersion'],
  });
  ensureIndex(diffStore, 'by_chapter', 'chapterId');
  ensureIndex(diffStore, 'by_analyzed_at', 'analyzedAt');

  // Log final state
  const finalStores = Array.from(db.objectStoreNames);
  console.log('[Migration v13] Schema repair complete. Stores:', finalStores);
}

/**
 * Get stores required for a specific domain
 */
export function getStoresForDomain(domain: keyof typeof DOMAIN_STORES): string[] {
  return [...DOMAIN_STORES[domain]];
}

/**
 * Validate database schema integrity
 */
export function validateSchema(db: IDBDatabase): boolean {
  const requiredStores = Object.values(STORE_NAMES);
  
  for (const storeName of requiredStores) {
    if (!db.objectStoreNames.contains(storeName)) {
      console.error(`Missing required object store: ${storeName}`);
      return false;
    }
  }
  
  // Validate critical indexes exist
  const transaction = db.transaction(requiredStores, 'readonly');
  
  try {
    // Check chapters indexes
    const chaptersStore = transaction.objectStore(STORE_NAMES.CHAPTERS);
    if (!chaptersStore.indexNames.contains('stableId')) {
      console.error('Missing stableId index on chapters store');
      return false;
    }
    
    // Check translations indexes
    const translationsStore = transaction.objectStore(STORE_NAMES.TRANSLATIONS);
    if (!translationsStore.indexNames.contains('chapterUrl') || 
        !translationsStore.indexNames.contains('stableId')) {
      console.error('Missing critical indexes on translations store');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Schema validation failed:', error);
    return false;
  }
}

/**
 * Export current schema for backup/restore
 */
export interface SchemaSnapshot {
  version: number;
  stores: Array<{
    name: string;
    keyPath: string | string[];
    indexes: Array<{
      name: string;
      keyPath: string | string[];
      unique: boolean;
    }>;
  }>;
}

export function exportSchema(db: IDBDatabase): SchemaSnapshot {
  const stores: SchemaSnapshot['stores'] = [];
  
  for (let i = 0; i < db.objectStoreNames.length; i++) {
    const storeName = db.objectStoreNames[i];
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    const indexes: SchemaSnapshot['stores'][0]['indexes'] = [];
    for (let j = 0; j < store.indexNames.length; j++) {
      const indexName = store.indexNames[j];
      const index = store.index(indexName);
      indexes.push({
        name: indexName,
        keyPath: index.keyPath,
        unique: index.unique,
      });
    }
    
    stores.push({
      name: storeName,
      keyPath: store.keyPath,
      indexes,
    });
  }
  
  return {
    version: SCHEMA_VERSIONS.CURRENT,
    stores,
  };
}
