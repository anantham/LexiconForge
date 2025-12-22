/**
 * Migration Restore Service
 *
 * Restores user data from the most recent pre-migration backup after a failed upgrade.
 *
 * Notes:
 * - This module intentionally does NOT import `connection.ts` to avoid circular dependencies.
 * - Use `restoreFromBackup()` from a recovery UI or manual admin flow.
 */

import { applyMigrations, STORE_NAMES } from './schema';
import {
  getBackupMetadata,
  clearBackupMetadata,
  type BackupData,
  type MigrationBackupMetadata,
  type RestoreResult,
} from './migrationTypes';
import { retrieveBackupData, parseBackupJson } from './restoreStorage';
import { cleanupStorageTier } from './backupStorage';

export interface RestoreInfo {
  available: boolean;
  metadata: MigrationBackupMetadata | null;
  reason?: string;
}

export function canRestoreFromBackup(): boolean {
  const metadata = getBackupMetadata();
  return metadata !== null && metadata.status === 'failed';
}

export function getRestoreInfo(): RestoreInfo {
  const metadata = getBackupMetadata();

  if (!metadata) {
    return { available: false, metadata: null, reason: 'No backup metadata found' };
  }

  if (metadata.status === 'completed') {
    return { available: false, metadata, reason: 'Backup already marked completed' };
  }

  if (metadata.status === 'pending') {
    return { available: false, metadata, reason: 'Migration still in progress (backup pending)' };
  }

  return { available: true, metadata };
}

export async function restoreFromBackup(dbName: string = 'lexicon-forge'): Promise<RestoreResult> {
  const metadata = getBackupMetadata();

  if (!metadata) {
    return { success: false, message: 'No backup metadata found' };
  }

  if (metadata.status !== 'failed') {
    return { success: false, message: `Cannot restore from backup with status: ${metadata.status}` };
  }

  console.log(`[MigrationRestore] Starting restore from ${metadata.storage} backup (target v${metadata.fromVersion})`);

  try {
    const backup = await retrieveBackupData(metadata);
    if (!backup) {
      return { success: false, message: 'Could not retrieve backup data' };
    }

    await deleteDatabase(dbName);

    const db = await createDatabaseAtVersion(dbName, metadata.fromVersion);
    const restoredCounts = await restoreAllStores(db, backup);
    db.close();

    // Mark restore complete by clearing metadata; backup artifacts are cleaned up after.
    clearBackupMetadata();
    await cleanupStorageTier(metadata);

    return {
      success: true,
      message: `Successfully restored ${restoredCounts.chapters} chapters and ${restoredCounts.translations} translations`,
      restoredVersion: metadata.fromVersion,
      recordsRestored: restoredCounts,
    };
  } catch (error) {
    console.error('[MigrationRestore] Restore failed:', error);
    return {
      success: false,
      message: `Restore failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function emergencyRestore(
  backupJson: string,
  dbName: string = 'lexicon-forge'
): Promise<RestoreResult> {
  const parsed = parseBackupJson(backupJson);
  if (!parsed) {
    return { success: false, message: 'Invalid backup file format' };
  }

  console.log(`[MigrationRestore] Emergency restore requested (target v${parsed.metadata.fromVersion})`);

  try {
    await deleteDatabase(dbName);
    const db = await createDatabaseAtVersion(dbName, parsed.metadata.fromVersion);
    const restoredCounts = await restoreAllStores(db, parsed);
    db.close();

    // Clear any lingering metadata and stored backup pointers.
    clearBackupMetadata();

    return {
      success: true,
      message: `Successfully restored ${restoredCounts.chapters} chapters and ${restoredCounts.translations} translations`,
      restoredVersion: parsed.metadata.fromVersion,
      recordsRestored: restoredCounts,
    };
  } catch (error) {
    console.error('[MigrationRestore] Emergency restore failed:', error);
    return {
      success: false,
      message: `Emergency restore failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function deleteDatabase(dbName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Failed to delete database'));
    request.onblocked = () => reject(new Error('Database deletion blocked - close other tabs'));
  });
}

async function createDatabaseAtVersion(dbName: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction!;
      const oldVersion = event.oldVersion;
      const newVersion = event.newVersion ?? version;
      applyMigrations(db, tx, oldVersion, newVersion);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open database for restore'));
    request.onblocked = () => reject(new Error('Database open blocked - close other tabs'));
  });
}

async function restoreAllStores(db: IDBDatabase, backup: BackupData): Promise<NonNullable<RestoreResult['recordsRestored']>> {
  const storeData: Array<[string, any[]]> = [
    [STORE_NAMES.CHAPTERS, backup.chapters],
    [STORE_NAMES.TRANSLATIONS, backup.translations],
    [STORE_NAMES.SETTINGS, backup.settings],
    [STORE_NAMES.FEEDBACK, backup.feedback],
    [STORE_NAMES.PROMPT_TEMPLATES, backup.promptTemplates],
    [STORE_NAMES.URL_MAPPINGS, backup.urlMappings],
    [STORE_NAMES.NOVELS, backup.novels],
    [STORE_NAMES.CHAPTER_SUMMARIES, backup.chapterSummaries],
    [STORE_NAMES.AMENDMENT_LOGS, backup.amendmentLogs],
    [STORE_NAMES.DIFF_RESULTS, backup.diffResults],
  ];

  const existing = new Set(Array.from(db.objectStoreNames));
  const storesToRestore = storeData.filter(([name]) => existing.has(name));

  const restored: NonNullable<RestoreResult['recordsRestored']> = {
    chapters: backup.chapters.length,
    translations: backup.translations.length,
    settings: backup.settings.length,
    feedback: backup.feedback.length,
    other:
      backup.promptTemplates.length +
      backup.urlMappings.length +
      backup.novels.length +
      backup.chapterSummaries.length +
      backup.amendmentLogs.length +
      backup.diffResults.length,
  };

  if (storesToRestore.length === 0) {
    return restored;
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      storesToRestore.map(([name]) => name),
      'readwrite'
    );

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Restore transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('Restore transaction aborted'));

    for (const [storeName, records] of storesToRestore) {
      const store = tx.objectStore(storeName);
      for (const record of records) {
        store.put(record);
      }
    }
  });

  return restored;
}

