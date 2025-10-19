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
  CURRENT: 12,
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
};

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
function migrateToV1(db: IDBDatabase): void {
  // Chapters store
  if (!db.objectStoreNames.contains(STORE_NAMES.CHAPTERS)) {
    const chaptersStore = db.createObjectStore(STORE_NAMES.CHAPTERS, { 
      keyPath: 'url' 
    });
    chaptersStore.createIndex('title', 'title', { unique: false });
    chaptersStore.createIndex('createdAt', 'createdAt', { unique: false });
  }

  // Translations store
  if (!db.objectStoreNames.contains(STORE_NAMES.TRANSLATIONS)) {
    const translationsStore = db.createObjectStore(STORE_NAMES.TRANSLATIONS, { 
      keyPath: 'id' 
    });
    translationsStore.createIndex('chapterUrl', 'chapterUrl', { unique: false });
    translationsStore.createIndex('createdAt', 'createdAt', { unique: false });
  }

  // Settings store
  if (!db.objectStoreNames.contains(STORE_NAMES.SETTINGS)) {
    db.createObjectStore(STORE_NAMES.SETTINGS, { keyPath: 'key' });
  }

  // Feedback store
  if (!db.objectStoreNames.contains(STORE_NAMES.FEEDBACK)) {
    const feedbackStore = db.createObjectStore(STORE_NAMES.FEEDBACK, { 
      keyPath: 'id' 
    });
    feedbackStore.createIndex('chapterUrl', 'chapterUrl', { unique: false });
    feedbackStore.createIndex('createdAt', 'createdAt', { unique: false });
  }
}

/**
 * Migration to version 2: Add performance indexes
 */
function migrateToV2(db: IDBDatabase, transaction: IDBTransaction): void {
  // Add composite indexes for better query performance
  const translationsStore = transaction.objectStore(STORE_NAMES.TRANSLATIONS);
  
  if (!translationsStore.indexNames.contains('version')) {
    translationsStore.createIndex('version', ['chapterUrl', 'version'], { unique: true });
  }
  
  if (!translationsStore.indexNames.contains('active')) {
    translationsStore.createIndex('active', ['chapterUrl', 'isActive'], { unique: false });
  }
}

/**
 * Migration to version 3: Add stable ID support
 */
function migrateToV3(db: IDBDatabase, transaction: IDBTransaction): void {
  // Add stable ID indexes to chapters
  const chaptersStore = transaction.objectStore(STORE_NAMES.CHAPTERS);
  if (!chaptersStore.indexNames.contains('stableId')) {
    chaptersStore.createIndex('stableId', 'stableId', { unique: false });
  }

  // Add stable ID indexes to translations
  const translationsStore = transaction.objectStore(STORE_NAMES.TRANSLATIONS);
  if (!translationsStore.indexNames.contains('stableId')) {
    translationsStore.createIndex('stableId', 'stableId', { unique: false });
  }
}

/**
 * Migration to version 4: Add prompt templates
 */
function migrateToV4(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORE_NAMES.PROMPT_TEMPLATES)) {
    const templatesStore = db.createObjectStore(STORE_NAMES.PROMPT_TEMPLATES, { 
      keyPath: 'id' 
    });
    templatesStore.createIndex('name', 'name', { unique: true });
    templatesStore.createIndex('isDefault', 'isDefault', { unique: false });
  }
}

/**
 * Migration to version 5: Add URL mappings for stable IDs
 */
function migrateToV5(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORE_NAMES.URL_MAPPINGS)) {
    const urlMappingsStore = db.createObjectStore(STORE_NAMES.URL_MAPPINGS, { 
      keyPath: 'url' 
    });
    urlMappingsStore.createIndex('stableId', 'stableId', { unique: false });
    urlMappingsStore.createIndex('novelId', 'novelId', { unique: false });
  }
}

/**
 * Migration to version 6: Enhanced schema for new architecture
 */
function migrateToV6(db: IDBDatabase, transaction: IDBTransaction): void {
  // Add translation ID index to feedback for better queries
  const feedbackStore = transaction.objectStore(STORE_NAMES.FEEDBACK);
  if (!feedbackStore.indexNames.contains('translationId')) {
    feedbackStore.createIndex('translationId', 'translationId', { unique: false });
  }

  // Add composite index for chapter-translation lookups
  const translationsStore = transaction.objectStore(STORE_NAMES.TRANSLATIONS);
  if (!translationsStore.indexNames.contains('chapterVersion')) {
    translationsStore.createIndex('chapterVersion', ['chapterUrl', 'version'], { unique: true });
  }

  // Add novel-chapter composite index for URL mappings
  const urlMappingsStore = transaction.objectStore(STORE_NAMES.URL_MAPPINGS);
  if (!urlMappingsStore.indexNames.contains('novelChapter')) {
    urlMappingsStore.createIndex('novelChapter', ['novelId', 'chapterNumber'], { unique: false });
  }
}

/**
 * Migration to version 7: Add canonical data stores and indexes
 */
function migrateToV7(db: IDBDatabase, transaction: IDBTransaction): void {
  // Ensure URL mappings has full canonical indexes
  let urlStore: IDBObjectStore;
  if (!db.objectStoreNames.contains(STORE_NAMES.URL_MAPPINGS)) {
    urlStore = db.createObjectStore(STORE_NAMES.URL_MAPPINGS, { keyPath: 'url' });
  } else {
    urlStore = transaction.objectStore(STORE_NAMES.URL_MAPPINGS);
  }

  if (!urlStore.indexNames.contains('stableId')) {
    urlStore.createIndex('stableId', 'stableId', { unique: false });
  }
  if (!urlStore.indexNames.contains('isCanonical')) {
    urlStore.createIndex('isCanonical', 'isCanonical', { unique: false });
  }
  if (!urlStore.indexNames.contains('dateAdded')) {
    urlStore.createIndex('dateAdded', 'dateAdded', { unique: false });
  }
  if (!urlStore.indexNames.contains('novelId')) {
    urlStore.createIndex('novelId', 'novelId', { unique: false });
  }

  // Add novels store if missing
  if (!db.objectStoreNames.contains(STORE_NAMES.NOVELS)) {
    const novelStore = db.createObjectStore(STORE_NAMES.NOVELS, { keyPath: 'id' });
    novelStore.createIndex('source', 'source', { unique: false });
    novelStore.createIndex('title', 'title', { unique: false });
    novelStore.createIndex('dateAdded', 'dateAdded', { unique: false });
    novelStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
  }

  // Add chapter summaries store if missing
  if (!db.objectStoreNames.contains(STORE_NAMES.CHAPTER_SUMMARIES)) {
    const summaryStore = db.createObjectStore(STORE_NAMES.CHAPTER_SUMMARIES, { keyPath: 'stableId' });
    summaryStore.createIndex('chapterNumber', 'chapterNumber', { unique: false });
    summaryStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
    summaryStore.createIndex('hasTranslation', 'hasTranslation', { unique: false });
  }
}

/**
 * Migration to version 8: Ensure compound indexes exist for translations and chapters
 */
function migrateToV8(db: IDBDatabase, transaction: IDBTransaction): void {
  // Ensure translations store has compound indexes
  const translationsStore = transaction.objectStore(STORE_NAMES.TRANSLATIONS);
  if (!translationsStore.indexNames.contains('chapterUrl_version')) {
    translationsStore.createIndex('chapterUrl_version', ['chapterUrl', 'version'], { unique: true });
  }
  if (!translationsStore.indexNames.contains('stableId')) {
    translationsStore.createIndex('stableId', 'stableId', { unique: false });
  }
  if (!translationsStore.indexNames.contains('stableId_version')) {
    translationsStore.createIndex('stableId_version', ['stableId', 'version'], { unique: true });
  }

  // Ensure chapters store has chapterNumber index for navigation
  const chaptersStore = transaction.objectStore(STORE_NAMES.CHAPTERS);
  if (!chaptersStore.indexNames.contains('chapterNumber')) {
    chaptersStore.createIndex('chapterNumber', 'chapterNumber', { unique: false });
  }
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
  const chaptersStore = transaction.objectStore(STORE_NAMES.CHAPTERS);
  if (!chaptersStore.indexNames.contains('chapterNumber')) {
    chaptersStore.createIndex('chapterNumber', 'chapterNumber', { unique: false });
  }
}

/**
 * Migration to version 11: Add amendment logs store for tracking prompt proposal actions
 */
function migrateToV11(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORE_NAMES.AMENDMENT_LOGS)) {
    const amendmentLogsStore = db.createObjectStore(STORE_NAMES.AMENDMENT_LOGS, { keyPath: 'id' });
    amendmentLogsStore.createIndex('timestamp', 'timestamp', { unique: false });
    amendmentLogsStore.createIndex('chapterId', 'chapterId', { unique: false });
    amendmentLogsStore.createIndex('action', 'action', { unique: false });
  }
}

/**
 * Migration to version 12: Add diffResults store for semantic diff analysis
 */
function migrateToV12(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORE_NAMES.DIFF_RESULTS)) {
    const diffResultsStore = db.createObjectStore(STORE_NAMES.DIFF_RESULTS, {
      keyPath: ['chapterId', 'aiVersionId', 'fanVersionId', 'rawVersionId', 'algoVersion']
    });
    diffResultsStore.createIndex('by_chapter', 'chapterId', { unique: false });
    diffResultsStore.createIndex('by_analyzed_at', 'analyzedAt', { unique: false });
  }
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
