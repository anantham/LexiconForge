/**
 * Migration Backup Service
 *
 * Creates automatic backups before schema migrations to prevent data loss.
 * Orchestrates backup creation using tiered storage from backupStorage.ts
 */

import { STORE_NAMES } from './schema';
import {
  type MigrationBackupMetadata,
  type BackupData,
  needsPreMigrationBackup,
  getBackupMetadata,
  clearBackupMetadata,
} from './migrationTypes';
import { storeBackup, cleanupStorageTier } from './backupStorage';

// Re-export commonly used functions from migrationTypes
export {
  needsPreMigrationBackup,
  getBackupMetadata,
  markBackupCompleted,
  markBackupFailed,
  type MigrationBackupMetadata,
} from './migrationTypes';

/**
 * Create a backup before migration.
 * IMPORTANT: Must be called BEFORE opening DB with new version.
 */
export async function createPreMigrationBackup(
  dbName: string,
  fromVersion: number,
  toVersion: number
): Promise<boolean> {
  if (!needsPreMigrationBackup(fromVersion, toVersion)) {
    console.log('[MigrationBackup] No backup needed (fresh install or same version)');
    return true;
  }

  console.log(`[MigrationBackup] Creating backup before v${fromVersion} → v${toVersion}`);

  try {
    // Open DB at current (old) version in read-only mode
    const oldDb = await openDbReadOnly(dbName, fromVersion);

    // Export all data
    const backupData = await exportAllStores(oldDb, fromVersion, toVersion);
    oldDb.close();

    const backupJson = JSON.stringify(backupData);
    const sizeBytes = new Blob([backupJson]).size;

    console.log(`[MigrationBackup] Backup size: ${(sizeBytes / 1024 / 1024).toFixed(2)}MB`);

    // Update metadata with size
    backupData.metadata.sizeBytes = sizeBytes;

    // Try storage strategies in order of preference
    const stored = await storeBackup(backupJson, backupData.metadata);

    if (!stored) {
      console.error('[MigrationBackup] Failed to store backup in any storage tier');
      return false;
    }

    console.log(`[MigrationBackup] Backup created successfully in ${backupData.metadata.storage}`);
    return true;

  } catch (error) {
    console.error('[MigrationBackup] Failed to create backup:', error);
    return false;
  }
}

/**
 * Open DB at specific version in read-only mode (no upgrade)
 */
async function openDbReadOnly(dbName: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`Failed to open DB: ${request.error?.message}`));

    // If onupgradeneeded fires, abort - we only want to read existing data
    request.onupgradeneeded = () => {
      request.transaction?.abort();
      reject(new Error('Cannot open DB at older version for backup'));
    };
  });
}

/**
 * Export all data from all stores
 */
async function exportAllStores(
  db: IDBDatabase,
  fromVersion: number,
  toVersion: number
): Promise<BackupData> {
  const timestamp = new Date().toISOString();

  const storeNames = Array.from(db.objectStoreNames);
  const tx = db.transaction(storeNames, 'readonly');

  const getAll = (storeName: string): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(storeName)) {
        resolve([]);
        return;
      }
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  };

  const [
    chapters,
    translations,
    settings,
    feedback,
    promptTemplates,
    urlMappings,
    novels,
    chapterSummaries,
    amendmentLogs,
    diffResults,
  ] = await Promise.all([
    getAll(STORE_NAMES.CHAPTERS),
    getAll(STORE_NAMES.TRANSLATIONS),
    getAll(STORE_NAMES.SETTINGS),
    getAll(STORE_NAMES.FEEDBACK),
    getAll(STORE_NAMES.PROMPT_TEMPLATES),
    getAll(STORE_NAMES.URL_MAPPINGS),
    getAll(STORE_NAMES.NOVELS),
    getAll(STORE_NAMES.CHAPTER_SUMMARIES),
    getAll(STORE_NAMES.AMENDMENT_LOGS),
    getAll(STORE_NAMES.DIFF_RESULTS),
  ]);

  const metadata: MigrationBackupMetadata = {
    fromVersion,
    toVersion,
    timestamp,
    chapterCount: chapters.length,
    translationCount: translations.length,
    sizeBytes: 0, // Will be updated after serialization
    status: 'pending',
    storage: 'localStorage', // Default, will be updated
  };

  return {
    metadata,
    chapters,
    translations,
    settings,
    feedback,
    promptTemplates,
    urlMappings,
    novels,
    chapterSummaries,
    amendmentLogs,
    diffResults,
  };
}

/**
 * Clean up old completed backups (call periodically)
 */
export async function cleanupOldBackups(
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000
): Promise<void> {
  const metadata = getBackupMetadata();

  if (!metadata || metadata.status !== 'completed') {
    return; // Keep pending/failed backups
  }

  const backupAge = Date.now() - new Date(metadata.timestamp).getTime();

  if (backupAge < maxAgeMs) {
    return; // Backup is still fresh
  }

  console.log('[MigrationBackup] Cleaning up old backup...');

  await cleanupStorageTier(metadata);
  clearBackupMetadata();

  console.log('[MigrationBackup] Old backup cleaned up');
}
