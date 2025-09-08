/**
 * Database Connection Management - Hybrid Approach
 * 
 * Single source of truth for IndexedDB connection with upgrade hooks.
 * Handles browser compatibility and provides fallback detection.
 */

import { DbError, mapDomError } from './errors';

// Database configuration constants
export const DB_NAME = 'lexicon-forge';
export const DB_VERSION = 6; // Increment for new schema changes

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
  newVersion: number
): void {
  console.log(`Upgrading database from version ${oldVersion} to ${newVersion}`);

  // Import schema definitions to avoid circular dependency
  // Note: This will be implemented when we create schema.ts
  // For now, we'll handle basic store creation inline

  // Version 1: Initial schema
  if (oldVersion < 1) {
    createInitialStores(db);
  }

  // Version 2: Add indexes
  if (oldVersion < 2) {
    addInitialIndexes(db, transaction);
  }

  // Future versions will be handled in schema.ts
  // This allows for clean, testable migration functions
}

/**
 * Create initial object stores
 */
function createInitialStores(db: IDBDatabase): void {
  // Chapters store
  if (!db.objectStoreNames.contains('chapters')) {
    const chaptersStore = db.createObjectStore('chapters', { keyPath: 'url' });
    chaptersStore.createIndex('stableId', 'stableId', { unique: false });
    chaptersStore.createIndex('title', 'title', { unique: false });
  }

  // Translations store
  if (!db.objectStoreNames.contains('translations')) {
    const translationsStore = db.createObjectStore('translations', { keyPath: 'id' });
    translationsStore.createIndex('chapterUrl', 'chapterUrl', { unique: false });
    translationsStore.createIndex('stableId', 'stableId', { unique: false });
    translationsStore.createIndex('version', ['chapterUrl', 'version'], { unique: true });
  }

  // Settings store
  if (!db.objectStoreNames.contains('settings')) {
    db.createObjectStore('settings', { keyPath: 'key' });
  }

  // Feedback store
  if (!db.objectStoreNames.contains('feedback')) {
    const feedbackStore = db.createObjectStore('feedback', { keyPath: 'id' });
    feedbackStore.createIndex('chapterUrl', 'chapterUrl', { unique: false });
    feedbackStore.createIndex('translationId', 'translationId', { unique: false });
  }

  // Prompt templates store
  if (!db.objectStoreNames.contains('prompt_templates')) {
    db.createObjectStore('prompt_templates', { keyPath: 'id' });
  }

  // URL mappings store (for stable IDs)
  if (!db.objectStoreNames.contains('url_mappings')) {
    const urlMappingsStore = db.createObjectStore('url_mappings', { keyPath: 'url' });
    urlMappingsStore.createIndex('stableId', 'stableId', { unique: false });
  }
}

/**
 * Add initial indexes for performance
 */
function addInitialIndexes(db: IDBDatabase, transaction: IDBTransaction): void {
  // Add any additional indexes needed for version 2
  // This is where we'd add composite indexes for complex queries
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