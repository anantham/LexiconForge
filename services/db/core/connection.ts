/**
 * Database Connection Management - Hybrid Approach
 * 
 * Single source of truth for IndexedDB connection with upgrade hooks.
 * Handles browser compatibility and provides fallback detection.
 */

import { DbError, mapDomError } from './errors';
import { applyMigrations, SCHEMA_VERSIONS, STORE_NAMES } from './schema';

// Database configuration constants
export const DB_NAME = 'lexicon-forge';
export const DB_VERSION = SCHEMA_VERSIONS.CURRENT;

// IndexedDB availability check
let _indexedDBAvailable: boolean | undefined;

export function isIndexedDBAvailable(): boolean {
  if (_indexedDBAvailable !== undefined) {
    return _indexedDBAvailable;
  }

  try {
    _indexedDBAvailable = typeof indexedDB !== 'undefined' && indexedDB !== null;
    
    // Additional check for private browsing mode
    if (_indexedDBAvailable) {
      // Test if we can actually open a database
      const testName = `__idb_test_${Date.now()}`;
      const testRequest = indexedDB.open(testName);
      testRequest.onerror = () => {
        _indexedDBAvailable = false;
      };
      testRequest.onsuccess = () => {
        // Clean up test database
        const testDb = testRequest.result;
        testDb.close();
        indexedDB.deleteDatabase(testName);
      };
    }
  } catch (error) {
    _indexedDBAvailable = false;
  }

  return _indexedDBAvailable;
}

// Connection singleton
let _dbConnection: IDBDatabase | null = null;
let _connectionPromise: Promise<IDBDatabase> | null = null;

export function resetConnection(): void {
  if (_dbConnection) {
    try {
      _dbConnection.close();
    } catch {
      // ignore close errors
    }
  }
  _dbConnection = null;
  _connectionPromise = null;
}

/**
 * Get or create the database connection
 */
export async function getConnection(): Promise<IDBDatabase> {
  if (_dbConnection) {
    return _dbConnection;
  }

  if (_connectionPromise) {
    return _connectionPromise;
  }

  _connectionPromise = openDatabase();
  _dbConnection = await _connectionPromise;
  return _dbConnection;
}

/**
 * Open the IndexedDB database with upgrade handling
 */
async function openDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDBAvailable()) {
    throw new DbError('Permission', 'connection', 'system', 
      'IndexedDB is not available - possibly private browsing mode');
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      const error = mapDomError(request.error, 'connection', 'system', 'open');
      reject(error);
    };

    request.onblocked = () => {
      const error = new DbError('Blocked', 'connection', 'system', 
        'Database upgrade blocked by another connection. Please close other tabs.');
      reject(error);
    };

    request.onsuccess = () => {
      const db = request.result;
      
      // Handle unexpected closes
      db.onclose = () => {
        _dbConnection = null;
        _connectionPromise = null;
      };

      // Handle version change from other tabs
      db.onversionchange = () => {
        db.close();
        _dbConnection = null;
        _connectionPromise = null;
      };

      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const transaction = request.transaction!;
      const oldVersion = event.oldVersion;
      const newVersion = event.newVersion!;

      try {
        upgradeDatabase(db, transaction, oldVersion, newVersion);
      } catch (error) {
        const dbError = mapDomError(error, 'connection', 'system', 'upgrade');
        reject(dbError);
      }
    };
  });
}

/**
 * Handle database schema upgrades
 */
function upgradeDatabase(
  db: IDBDatabase,
  transaction: IDBTransaction,
  oldVersion: number,
  newVersion: number | null
): void {
  console.log(`Upgrading database from version ${oldVersion} to ${newVersion}`);

  createInitialStores(db);
  if (transaction) {
    applyMigrations(db, transaction, oldVersion, newVersion ?? DB_VERSION);
  }
}

/**
 * Create initial object stores
 */
function createInitialStores(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORE_NAMES.CHAPTERS)) {
    const chaptersStore = db.createObjectStore(STORE_NAMES.CHAPTERS, { keyPath: 'url' });
    chaptersStore.createIndex('stableId', 'stableId', { unique: false });
    chaptersStore.createIndex('title', 'title', { unique: false });
    chaptersStore.createIndex('canonicalUrl', 'canonicalUrl', { unique: false });
    chaptersStore.createIndex('chapterNumber', 'chapterNumber', { unique: false });
    chaptersStore.createIndex('dateAdded', 'dateAdded', { unique: false });
    chaptersStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
  }

  if (!db.objectStoreNames.contains(STORE_NAMES.TRANSLATIONS)) {
    const translationsStore = db.createObjectStore(STORE_NAMES.TRANSLATIONS, { keyPath: 'id' });
    translationsStore.createIndex('chapterUrl', 'chapterUrl', { unique: false });
    translationsStore.createIndex('stableId', 'stableId', { unique: false });
    translationsStore.createIndex('version', ['chapterUrl', 'version'], { unique: true });
    translationsStore.createIndex('chapterUrl_version', ['chapterUrl', 'version'], { unique: true });
    translationsStore.createIndex('stableId_version', ['stableId', 'version'], { unique: true });
    translationsStore.createIndex('isActive', 'isActive', { unique: false });
    translationsStore.createIndex('createdAt', 'createdAt', { unique: false });
  }

  if (!db.objectStoreNames.contains(STORE_NAMES.SETTINGS)) {
    db.createObjectStore(STORE_NAMES.SETTINGS, { keyPath: 'key' });
  }

  if (!db.objectStoreNames.contains(STORE_NAMES.FEEDBACK)) {
    const feedbackStore = db.createObjectStore(STORE_NAMES.FEEDBACK, { keyPath: 'id' });
    feedbackStore.createIndex('chapterUrl', 'chapterUrl', { unique: false });
    feedbackStore.createIndex('translationId', 'translationId', { unique: false });
    feedbackStore.createIndex('createdAt', 'createdAt', { unique: false });
  }

  if (!db.objectStoreNames.contains(STORE_NAMES.PROMPT_TEMPLATES)) {
    const promptStore = db.createObjectStore(STORE_NAMES.PROMPT_TEMPLATES, { keyPath: 'id' });
    promptStore.createIndex('name', 'name', { unique: true });
    promptStore.createIndex('isDefault', 'isDefault', { unique: false });
    promptStore.createIndex('createdAt', 'createdAt', { unique: false });
  }

  if (!db.objectStoreNames.contains(STORE_NAMES.URL_MAPPINGS)) {
    const urlStore = db.createObjectStore(STORE_NAMES.URL_MAPPINGS, { keyPath: 'url' });
    urlStore.createIndex('stableId', 'stableId', { unique: false });
    urlStore.createIndex('isCanonical', 'isCanonical', { unique: false });
    urlStore.createIndex('dateAdded', 'dateAdded', { unique: false });
  }

  if (!db.objectStoreNames.contains(STORE_NAMES.NOVELS)) {
    const novelStore = db.createObjectStore(STORE_NAMES.NOVELS, { keyPath: 'id' });
    novelStore.createIndex('source', 'source', { unique: false });
    novelStore.createIndex('title', 'title', { unique: false });
    novelStore.createIndex('dateAdded', 'dateAdded', { unique: false });
    novelStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
  }

  if (!db.objectStoreNames.contains(STORE_NAMES.CHAPTER_SUMMARIES)) {
    const summaryStore = db.createObjectStore(STORE_NAMES.CHAPTER_SUMMARIES, { keyPath: 'stableId' });
    summaryStore.createIndex('chapterNumber', 'chapterNumber', { unique: false });
    summaryStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
    summaryStore.createIndex('hasTranslation', 'hasTranslation', { unique: false });
  }

  if (!db.objectStoreNames.contains(STORE_NAMES.AMENDMENT_LOGS)) {
    const amendmentStore = db.createObjectStore(STORE_NAMES.AMENDMENT_LOGS, { keyPath: 'id' });
    amendmentStore.createIndex('timestamp', 'timestamp', { unique: false });
    amendmentStore.createIndex('chapterId', 'chapterId', { unique: false });
    amendmentStore.createIndex('action', 'action', { unique: false });
  }

  if (!db.objectStoreNames.contains(STORE_NAMES.DIFF_RESULTS)) {
    const diffStore = db.createObjectStore(STORE_NAMES.DIFF_RESULTS, {
      keyPath: ['chapterId', 'aiVersionId', 'fanVersionId', 'rawVersionId', 'algoVersion'],
    });
    diffStore.createIndex('by_chapter', 'chapterId', { unique: false });
    diffStore.createIndex('by_analyzed_at', 'analyzedAt', { unique: false });
  }
}

/**
 * Close the database connection
 */
export function closeConnection(): void {
  if (_dbConnection) {
    _dbConnection.close();
    _dbConnection = null;
    _connectionPromise = null;
  }
}

/**
 * Delete the entire database (for testing/reset)
 */
export async function deleteDatabase(): Promise<void> {
  closeConnection();
  
  return new Promise<void>((resolve, reject) => {
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
    
    deleteRequest.onerror = () => {
      const error = mapDomError(deleteRequest.error, 'connection', 'system', 'delete');
      reject(error);
    };
    
    deleteRequest.onblocked = () => {
      const error = new DbError('Blocked', 'connection', 'system', 
        'Cannot delete database - close all tabs first');
      reject(error);
    };
    
    deleteRequest.onsuccess = () => {
      resolve();
    };
  });
}
