import { describe, it, expect, afterEach } from 'vitest';
import { restoreFromBackup } from '../../../services/db/core/migrationRestore';
import {
  BACKUP_DATA_KEY,
  BACKUP_METADATA_KEY,
  type MigrationBackupMetadata,
  type BackupData,
} from '../../../services/db/core/migrationTypes';
import { SCHEMA_VERSIONS, STORE_NAMES } from '../../../services/db/core/schema';

const TEST_DB_NAME = 'test-migration-restore';
const FROM_VERSION = SCHEMA_VERSIONS.CURRENT - 1;

async function deleteDb(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(TEST_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('blocked'));
  });
}

describe('MigrationRestore', () => {
  afterEach(async () => {
    try {
      await deleteDb();
    } catch {
      // ignore
    }
    localStorage.removeItem(BACKUP_METADATA_KEY);
    localStorage.removeItem(BACKUP_DATA_KEY);
  });

  it('restores DB contents from a localStorage backup', async () => {
    const metadata: MigrationBackupMetadata = {
      fromVersion: FROM_VERSION,
      toVersion: SCHEMA_VERSIONS.CURRENT,
      timestamp: new Date().toISOString(),
      chapterCount: 1,
      translationCount: 1,
      sizeBytes: 0,
      status: 'failed',
      storage: 'localStorage',
    };

    const backup: BackupData = {
      metadata,
      chapters: [{ url: 'u1', title: 't1', content: 'c1' }],
      translations: [{ id: 'tr1', chapterUrl: 'u1', version: 1, isActive: true }],
      settings: [{ key: 'k1', value: 'v1' }],
      feedback: [{ id: 'fb1', chapterUrl: 'u1', createdAt: Date.now() }],
      promptTemplates: [{ id: 'p1', name: 'n1', isDefault: true, createdAt: Date.now() }],
      urlMappings: [{ url: 'u1', stableId: 's1', isCanonical: true }],
      novels: [],
      chapterSummaries: [],
      amendmentLogs: [],
      diffResults: [],
    };

    const json = JSON.stringify(backup);
    metadata.sizeBytes = new Blob([json]).size;

    localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));
    localStorage.setItem(BACKUP_DATA_KEY, json);

    const result = await restoreFromBackup(TEST_DB_NAME);
    expect(result.success).toBe(true);
    expect(result.restoredVersion).toBe(FROM_VERSION);

    expect(localStorage.getItem(BACKUP_METADATA_KEY)).toBeNull();
    expect(localStorage.getItem(BACKUP_DATA_KEY)).toBeNull();

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(TEST_DB_NAME);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    expect(db.version).toBe(FROM_VERSION);

    const chapter = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(STORE_NAMES.CHAPTERS, 'readonly');
      const req = tx.objectStore(STORE_NAMES.CHAPTERS).get('u1');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    expect(chapter?.title).toBe('t1');

    db.close();
  });
});

