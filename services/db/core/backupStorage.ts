/**
 * Backup Storage Service
 *
 * Tiered storage abstraction for migration backups.
 * Tries storage in order of preference: OPFS → Backup DB → localStorage → User Download
 */

import {
  BACKUP_METADATA_KEY,
  BACKUP_DATA_KEY,
  BACKUP_DB_NAME,
  type MigrationBackupMetadata,
} from './migrationTypes';

/**
 * Try to store backup using tiered storage strategy
 */
export async function storeBackup(
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
      console.log('[BackupStorage] OPFS not available');
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
    console.log(`[BackupStorage] Stored in OPFS: ${fileName}`);
    return true;
  } catch (e) {
    console.warn('[BackupStorage] OPFS storage failed:', e);
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
    console.log(`[BackupStorage] Stored in backup database: ${backupId}`);
    return true;
  } catch (e) {
    console.warn('[BackupStorage] Backup DB storage failed:', e);
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
      console.warn(`[BackupStorage] Data too large for localStorage: ${(metadata.sizeBytes / 1024 / 1024).toFixed(2)}MB`);
      return false;
    }

    localStorage.setItem(BACKUP_DATA_KEY, backupJson);
    console.log('[BackupStorage] Stored in localStorage');
    return true;
  } catch (e) {
    console.warn('[BackupStorage] localStorage storage failed:', e);
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
        console.log(`[BackupStorage] User downloaded backup: ${fileName}`);
        resolve(true);
      } catch (e) {
        console.error('[BackupStorage] Download failed:', e);
        resolve(false);
      }
    } else {
      console.warn('[BackupStorage] User declined to download backup');
      resolve(false);
    }
  });
}

/**
 * Clean up backup from a specific storage tier
 */
export async function cleanupStorageTier(metadata: MigrationBackupMetadata): Promise<void> {
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
        // Nothing to clean up - user has the file
        break;
    }

    console.log('[BackupStorage] Storage tier cleaned up');
  } catch (e) {
    console.warn('[BackupStorage] Cleanup failed:', e);
  }
}
