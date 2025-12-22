/**
 * Migration Backup Service
 *
 * Creates automatic backups before schema migrations to prevent data loss.
 * Uses tiered storage: OPFS → Backup DB → localStorage → User Download
 */

import { STORE_NAMES } from './schema';

// Storage keys
const BACKUP_METADATA_KEY = 'lexiconforge-migration-backup-metadata';
const BACKUP_DATA_KEY = 'lexiconforge-migration-backup-data';
const BACKUP_DB_NAME = 'lexiconforge-backups';

export interface MigrationBackupMetadata {
  fromVersion: number;
  toVersion: number;
  timestamp: string;
  chapterCount: number;
  translationCount: number;
  sizeBytes: number;
  status: 'pending' | 'completed' | 'failed';
  storage: 'opfs' | 'backupDb' | 'localStorage' | 'userDownload';
  fileName?: string;
}

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

/**
 * Check if a backup is needed before migration
 */
export function needsPreMigrationBackup(oldVersion: number, newVersion: number): boolean {
  // Only backup if upgrading from an existing DB (not fresh install)
  return oldVersion > 0 && oldVersion < newVersion;
}

/**
 * Get stored backup metadata if exists
 */
export function getBackupMetadata(): MigrationBackupMetadata | null {
  try {
    const metadataStr = localStorage.getItem(BACKUP_METADATA_KEY);
    if (!metadataStr) return null;
    return JSON.parse(metadataStr);
  } catch {
    return null;
  }
}

/**
 * Mark backup as completed (called after successful migration)
 */
export function markBackupCompleted(): void {
  const metadata = getBackupMetadata();
  if (metadata) {
    metadata.status = 'completed';
    localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));
  }
}

/**
 * Mark backup as failed (called if migration fails)
 */
export function markBackupFailed(): void {
  const metadata = getBackupMetadata();
  if (metadata) {
    metadata.status = 'failed';
    localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));
  }
}

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
 * Try to store backup using tiered storage strategy
 */
async function storeBackup(
  backupJson: string,
  metadata: MigrationBackupMetadata
): Promise<boolean> {
  // Tier 1: OPFS (Origin Private File System) - best for large data
  if (await tryStoreInOPFS(backupJson, metadata)) {
    metadata.storage = 'opfs';
    localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));
    return true;
  }

  // Tier 2: Separate backup IndexedDB (never migrated)
  if (await tryStoreInBackupDb(backupJson, metadata)) {
    metadata.storage = 'backupDb';
    localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));
    return true;
  }

  // Tier 3: localStorage (size limited but always available)
  if (await tryStoreInLocalStorage(backupJson, metadata)) {
    metadata.storage = 'localStorage';
    localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));
    return true;
  }

  // Tier 4: Prompt user to download file
  if (await promptUserDownload(backupJson, metadata)) {
    metadata.storage = 'userDownload';
    localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));
    return true;
  }

  return false;
}

/**
 * Store backup in Origin Private File System
 */
async function tryStoreInOPFS(
  backupJson: string,
  metadata: MigrationBackupMetadata
): Promise<boolean> {
  try {
    if (!('storage' in navigator) || !('getDirectory' in (navigator.storage || {}))) {
      console.log('[MigrationBackup] OPFS not available');
      return false;
    }

    const root = await navigator.storage.getDirectory();
    const backupsDir = await root.getDirectoryHandle('migration-backups', { create: true });
    const fileName = `backup-v${metadata.fromVersion}-${Date.now()}.json`;
    const fileHandle = await backupsDir.getFileHandle(fileName, { create: true });

    const writable = await fileHandle.createWritable();
    await writable.write(backupJson);
    await writable.close();

    metadata.fileName = fileName;
    console.log(`[MigrationBackup] Stored in OPFS: ${fileName}`);
    return true;
  } catch (e) {
    console.warn('[MigrationBackup] OPFS storage failed:', e);
    return false;
  }
}

/**
 * Store backup in a separate IndexedDB (never migrated)
 */
async function tryStoreInBackupDb(
  backupJson: string,
  metadata: MigrationBackupMetadata
): Promise<boolean> {
  try {
    const backupDb = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(BACKUP_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('backups')) {
          db.createObjectStore('backups', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const tx = backupDb.transaction('backups', 'readwrite');
    const store = tx.objectStore('backups');

    const backupId = `v${metadata.fromVersion}-${metadata.timestamp}`;

    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        id: backupId,
        metadata,
        data: backupJson,
        createdAt: new Date().toISOString(),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    backupDb.close();
    console.log(`[MigrationBackup] Stored in backup database: ${backupId}`);
    return true;
  } catch (e) {
    console.warn('[MigrationBackup] Backup DB storage failed:', e);
    return false;
  }
}

/**
 * Store backup in localStorage (size limited)
 */
async function tryStoreInLocalStorage(
  backupJson: string,
  metadata: MigrationBackupMetadata
): Promise<boolean> {
  try {
    // localStorage limit is typically 5-10MB
    const MAX_LOCALSTORAGE_SIZE = 4 * 1024 * 1024; // 4MB to be safe

    if (metadata.sizeBytes > MAX_LOCALSTORAGE_SIZE) {
      console.warn(`[MigrationBackup] Data too large for localStorage: ${(metadata.sizeBytes / 1024 / 1024).toFixed(2)}MB`);
      return false;
    }

    localStorage.setItem(BACKUP_DATA_KEY, backupJson);
    console.log('[MigrationBackup] Stored in localStorage');
    return true;
  } catch (e) {
    console.warn('[MigrationBackup] localStorage storage failed:', e);
    return false;
  }
}

/**
 * Prompt user to download backup file (last resort)
 */
async function promptUserDownload(
  backupJson: string,
  metadata: MigrationBackupMetadata
): Promise<boolean> {
  return new Promise((resolve) => {
    const fileName = `lexiconforge-backup-v${metadata.fromVersion}-${metadata.timestamp.replace(/[:.]/g, '-')}.json`;

    const confirmed = window.confirm(
      `LexiconForge needs to upgrade your data (v${metadata.fromVersion} → v${metadata.toVersion}).\n\n` +
      `For safety, please save a backup file before continuing.\n\n` +
      `Click OK to download the backup.`
    );

    if (confirmed) {
      try {
        const blob = new Blob([backupJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        metadata.fileName = fileName;
        console.log(`[MigrationBackup] User downloaded backup: ${fileName}`);
        resolve(true);
      } catch (e) {
        console.error('[MigrationBackup] Download failed:', e);
        resolve(false);
      }
    } else {
      console.warn('[MigrationBackup] User declined to download backup');
      resolve(false);
    }
  });
}

/**
 * Clean up old completed backups (call periodically)
 */
export async function cleanupOldBackups(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  const metadata = getBackupMetadata();

  if (!metadata || metadata.status !== 'completed') {
    return; // Keep pending/failed backups
  }

  const backupAge = Date.now() - new Date(metadata.timestamp).getTime();

  if (backupAge < maxAgeMs) {
    return; // Backup is still fresh
  }

  console.log('[MigrationBackup] Cleaning up old backup...');

  try {
    // Clean up based on storage type
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
        // Nothing to clean up - user has the file
        break;
    }

    // Clear metadata
    localStorage.removeItem(BACKUP_METADATA_KEY);
    console.log('[MigrationBackup] Old backup cleaned up');
  } catch (e) {
    console.warn('[MigrationBackup] Cleanup failed:', e);
  }
}
