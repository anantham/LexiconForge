/**
 * Migration Restore Service
 *
 * Restores data from backup after a failed migration.
 * Supports all storage tiers used by migrationBackup.ts
 */

import { STORE_NAMES, applyMigrations } from './schema';
import { DB_NAME } from './connection';
import {
  getBackupMetadata,
  type MigrationBackupMetadata,
} from './migrationBackup';

const BACKUP_DATA_KEY = 'lexiconforge-migration-backup-data';
const BACKUP_METADATA_KEY = 'lexiconforge-migration-backup-metadata';
const BACKUP_DB_NAME = 'lexiconforge-backups';

interface BackupData {
  metadata: MigrationBackupMetadata;
  chapters: any[];
  translations: any[];
  settings: any[];
  feedback: any[];
  promptTemplates: any[];
  urlMappings: any[];
  novels: any[];
  chapterSummaries: any[];
  amendmentLogs: any[];
  diffResults: any[];
}

export interface RestoreResult {
  success: boolean;
  message: string;
  restoredVersion?: number;
  recordsRestored?: {
    chapters: number;
    translations: number;
    settings: number;
    feedback: number;
    other: number;
  };
}

/**
 * Check if a restore is possible
 */
export function canRestoreFromBackup(): boolean {
  const metadata = getBackupMetadata();
  return metadata !== null && metadata.status === 'failed';
}

/**
 * Get information about the available backup
 */
export function getRestoreInfo(): {
  available: boolean;
  metadata: MigrationBackupMetadata | null;
  reason?: string;
} {
  const metadata = getBackupMetadata();

  if (!metadata) {
    return { available: false, metadata: null, reason: 'No backup found' };
  }

  if (metadata.status === 'completed') {
    return { available: false, metadata, reason: 'Backup already restored (migration succeeded)' };
  }

  if (metadata.status === 'pending') {
    return { available: false, metadata, reason: 'Migration still in progress' };
  }

  return { available: true, metadata };
}

/**
 * Restore from the most recent backup
 */
export async function restoreFromBackup(): Promise<RestoreResult> {
  const metadata = getBackupMetadata();

  if (!metadata) {
    return { success: false, message: 'No backup metadata found' };
  }

  if (metadata.status !== 'failed') {
    return { success: false, message: `Cannot restore from backup with status: ${metadata.status}` };
  }

  console.log(`[MigrationRestore] Starting restore from ${metadata.storage} backup`);
  console.log(`[MigrationRestore] Target version: ${metadata.fromVersion}`);

  try {
    // 1. Retrieve backup data
    const backupData = await retrieveBackupData(metadata);

    if (!backupData) {
      return { success: false, message: 'Could not retrieve backup data' };
    }

    console.log(`[MigrationRestore] Retrieved backup with ${backupData.chapters.length} chapters`);

    // 2. Delete the corrupted/failed database
    await deleteMainDatabase();
    console.log('[MigrationRestore] Deleted corrupted database');

    // 3. Recreate database at the old version
    const db = await createDatabaseAtVersion(metadata.fromVersion);
    console.log(`[MigrationRestore] Created database at version ${metadata.fromVersion}`);

    // 4. Restore all data
    const recordsRestored = await restoreAllStores(db, backupData);
    db.close();

    console.log('[MigrationRestore] Data restored:', recordsRestored);

    // 5. Clear backup metadata (successful restore)
    localStorage.removeItem(BACKUP_METADATA_KEY);

    // 6. Clean up backup data
    await cleanupBackupData(metadata);

    return {
      success: true,
      message: `Successfully restored ${recordsRestored.chapters} chapters and ${recordsRestored.translations} translations`,
      restoredVersion: metadata.fromVersion,
      recordsRestored,
    };

  } catch (error) {
    console.error('[MigrationRestore] Restore failed:', error);
    return {
      success: false,
      message: `Restore failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Retrieve backup data from the appropriate storage
 */
async function retrieveBackupData(metadata: MigrationBackupMetadata): Promise<BackupData | null> {
  try {
    let backupJson: string | null = null;

    switch (metadata.storage) {
      case 'opfs':
        backupJson = await retrieveFromOPFS(metadata);
        break;

      case 'backupDb':
        backupJson = await retrieveFromBackupDb(metadata);
        break;

      case 'localStorage':
        backupJson = localStorage.getItem(BACKUP_DATA_KEY);
        break;

      case 'userDownload':
        backupJson = await promptUserUpload();
        break;

      default:
        console.error(`[MigrationRestore] Unknown storage type: ${metadata.storage}`);
        return null;
    }

    if (!backupJson) {
      return null;
    }

    return JSON.parse(backupJson) as BackupData;
  } catch (error) {
    console.error('[MigrationRestore] Failed to retrieve backup data:', error);
    return null;
  }
}

/**
 * Retrieve from OPFS
 */
async function retrieveFromOPFS(metadata: MigrationBackupMetadata): Promise<string | null> {
  if (!metadata.fileName) {
    return null;
  }

  try {
    const root = await navigator.storage.getDirectory();
    const backupsDir = await root.getDirectoryHandle('migration-backups');
    const fileHandle = await backupsDir.getFileHandle(metadata.fileName);
    const file = await fileHandle.getFile();
    return await file.text();
  } catch (e) {
    console.error('[MigrationRestore] OPFS retrieval failed:', e);
    return null;
  }
}

/**
 * Retrieve from backup database
 */
async function retrieveFromBackupDb(metadata: MigrationBackupMetadata): Promise<string | null> {
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(BACKUP_DB_NAME, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const tx = db.transaction('backups', 'readonly');
    const store = tx.objectStore('backups');
    const backupId = `v${metadata.fromVersion}-${metadata.timestamp}`;

    const record = await new Promise<any>((resolve, reject) => {
      const request = store.get(backupId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();

    return record?.data || null;
  } catch (e) {
    console.error('[MigrationRestore] Backup DB retrieval failed:', e);
    return null;
  }
}

/**
 * Prompt user to upload their backup file
 */
async function promptUserUpload(): Promise<string | null> {
  return new Promise((resolve) => {
    const message =
      'Please select your backup file to restore your data.\n\n' +
      'The file should be named like: lexiconforge-backup-v*.json';

    if (!window.confirm(message)) {
      resolve(null);
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          // Validate it's a backup file
          const parsed = JSON.parse(text);
          if (parsed.metadata && parsed.chapters) {
            resolve(text);
          } else {
            alert('Invalid backup file format');
            resolve(null);
          }
        } catch (err) {
          alert('Failed to read backup file');
          resolve(null);
        }
      } else {
        resolve(null);
      }
    };

    input.oncancel = () => resolve(null);

    input.click();
  });
}

/**
 * Delete the main database
 */
async function deleteMainDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);

    request.onsuccess = () => {
      console.log('[MigrationRestore] Main database deleted');
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Failed to delete database: ${request.error?.message}`));
    };

    request.onblocked = () => {
      console.warn('[MigrationRestore] Database deletion blocked - close other tabs');
      // We'll wait and it should eventually succeed
    };
  });
}

/**
 * Create database at a specific version
 */
async function createDatabaseAtVersion(version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, version);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction!;
      const oldVersion = event.oldVersion;

      // Apply migrations from 0 to target version
      applyMigrations(db, tx, oldVersion, version);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Restore all data to the stores
 */
async function restoreAllStores(
  db: IDBDatabase,
  backup: BackupData
): Promise<{
  chapters: number;
  translations: number;
  settings: number;
  feedback: number;
  other: number;
}> {
  const storeMapping: Array<{ storeName: string; data: any[]; key: string }> = [
    { storeName: STORE_NAMES.CHAPTERS, data: backup.chapters, key: 'chapters' },
    { storeName: STORE_NAMES.TRANSLATIONS, data: backup.translations, key: 'translations' },
    { storeName: STORE_NAMES.SETTINGS, data: backup.settings, key: 'settings' },
    { storeName: STORE_NAMES.FEEDBACK, data: backup.feedback, key: 'feedback' },
    { storeName: STORE_NAMES.PROMPT_TEMPLATES, data: backup.promptTemplates, key: 'other' },
    { storeName: STORE_NAMES.URL_MAPPINGS, data: backup.urlMappings, key: 'other' },
    { storeName: STORE_NAMES.NOVELS, data: backup.novels, key: 'other' },
    { storeName: STORE_NAMES.CHAPTER_SUMMARIES, data: backup.chapterSummaries, key: 'other' },
    { storeName: STORE_NAMES.AMENDMENT_LOGS, data: backup.amendmentLogs, key: 'other' },
    { storeName: STORE_NAMES.DIFF_RESULTS, data: backup.diffResults, key: 'other' },
  ];

  const counts = { chapters: 0, translations: 0, settings: 0, feedback: 0, other: 0 };

  for (const { storeName, data, key } of storeMapping) {
    if (!data || data.length === 0) continue;

    if (!db.objectStoreNames.contains(storeName)) {
      console.warn(`[MigrationRestore] Store ${storeName} does not exist, skipping`);
      continue;
    }

    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      for (const record of data) {
        await new Promise<void>((resolve, reject) => {
          const request = store.put(record);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
        counts[key as keyof typeof counts]++;
      }

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      console.log(`[MigrationRestore] Restored ${data.length} records to ${storeName}`);
    } catch (error) {
      console.error(`[MigrationRestore] Failed to restore ${storeName}:`, error);
    }
  }

  return counts;
}

/**
 * Clean up backup data after successful restore
 */
async function cleanupBackupData(metadata: MigrationBackupMetadata): Promise<void> {
  try {
    switch (metadata.storage) {
      case 'opfs':
        if (metadata.fileName) {
          const root = await navigator.storage.getDirectory();
          const backupsDir = await root.getDirectoryHandle('migration-backups');
          await backupsDir.removeEntry(metadata.fileName);
        }
        break;

      case 'backupDb':
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(BACKUP_DB_NAME, 1);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const tx = db.transaction('backups', 'readwrite');
        const store = tx.objectStore('backups');
        const backupId = `v${metadata.fromVersion}-${metadata.timestamp}`;
        store.delete(backupId);
        db.close();
        break;

      case 'localStorage':
        localStorage.removeItem(BACKUP_DATA_KEY);
        break;

      case 'userDownload':
        // Nothing to clean up
        break;
    }

    console.log('[MigrationRestore] Backup data cleaned up');
  } catch (e) {
    console.warn('[MigrationRestore] Cleanup failed (non-fatal):', e);
  }
}

/**
 * Emergency restore: manually provide backup data
 */
export async function emergencyRestore(backupJson: string): Promise<RestoreResult> {
  try {
    const backupData = JSON.parse(backupJson) as BackupData;

    if (!backupData.metadata || !backupData.chapters) {
      return { success: false, message: 'Invalid backup format' };
    }

    // Delete existing database
    await deleteMainDatabase();

    // Create at backup version
    const targetVersion = backupData.metadata.fromVersion;
    const db = await createDatabaseAtVersion(targetVersion);

    // Restore data
    const recordsRestored = await restoreAllStores(db, backupData);
    db.close();

    // Clear any existing backup metadata
    localStorage.removeItem(BACKUP_METADATA_KEY);

    return {
      success: true,
      message: `Emergency restore complete: ${recordsRestored.chapters} chapters restored`,
      restoredVersion: targetVersion,
      recordsRestored,
    };
  } catch (error) {
    return {
      success: false,
      message: `Emergency restore failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
