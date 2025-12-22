/**
 * Restore Storage Service
 *
 * Tiered retrieval abstraction for migration backups.
 * Retrieves backup data from the storage tier specified in metadata.
 */

import {
  BACKUP_DATA_KEY,
  BACKUP_DB_NAME,
  type MigrationBackupMetadata,
  type BackupData,
} from './migrationTypes';

/**
 * Retrieve backup data from the appropriate storage
 */
export async function retrieveBackupData(
  metadata: MigrationBackupMetadata
): Promise<BackupData | null> {
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
        console.error(`[RestoreStorage] Unknown storage type: ${metadata.storage}`);
        return null;
    }

    if (!backupJson) {
      return null;
    }

    return JSON.parse(backupJson) as BackupData;
  } catch (error) {
    console.error('[RestoreStorage] Failed to retrieve backup data:', error);
    return null;
  }
}

/**
 * Retrieve from OPFS
 */
async function retrieveFromOPFS(
  metadata: MigrationBackupMetadata
): Promise<string | null> {
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
    console.error('[RestoreStorage] OPFS retrieval failed:', e);
    return null;
  }
}

/**
 * Retrieve from backup database
 */
async function retrieveFromBackupDb(
  metadata: MigrationBackupMetadata
): Promise<string | null> {
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
    console.error('[RestoreStorage] Backup DB retrieval failed:', e);
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
 * Parse and validate backup JSON
 */
export function parseBackupJson(backupJson: string): BackupData | null {
  try {
    const data = JSON.parse(backupJson) as BackupData;
    if (!data.metadata || !Array.isArray(data.chapters)) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
