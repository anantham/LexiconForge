import { describe, it, expect, afterEach } from 'vitest';
import { createPreMigrationBackup } from '../../../services/db/core/migrationBackup';
import { retrieveBackupData } from '../../../services/db/core/restoreStorage';
import {
  BACKUP_DB_NAME,
  BACKUP_METADATA_KEY,
  getBackupMetadata,
  type MigrationBackupMetadata,
} from '../../../services/db/core/migrationTypes';
import { SCHEMA_VERSIONS, STORE_NAMES, applyMigrations } from '../../../services/db/core/schema';

const TEST_DB_NAME = 'test-migration-backup';
const FROM_VERSION = SCHEMA_VERSIONS.CURRENT - 1;
const TO_VERSION = SCHEMA_VERSIONS.CURRENT;

async function openDbAtVersion(version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(TEST_DB_NAME, version);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction!;
      applyMigrations(db, tx, event.oldVersion, event.newVersion ?? version);
    };
  });
}

async function deleteDb(name: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('blocked'));
  });
}

describe('MigrationBackup', () => {
  afterEach(async () => {
    try {
      await deleteDb(TEST_DB_NAME);
    } catch {
      // ignore
    }
    try {
      await deleteDb(BACKUP_DB_NAME);
    } catch {
      // ignore
    }
    localStorage.removeItem(BACKUP_METADATA_KEY);
  });

  it('creates a backup for an upgrade and stores metadata', async () => {
    const db = await openDbAtVersion(FROM_VERSION);

    // Seed a few stores with minimal records
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        [
          STORE_NAMES.CHAPTERS,
          STORE_NAMES.TRANSLATIONS,
          STORE_NAMES.SETTINGS,
          STORE_NAMES.FEEDBACK,
          STORE_NAMES.PROMPT_TEMPLATES,
          STORE_NAMES.URL_MAPPINGS,
        ],
        'readwrite'
      );

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);

      tx.objectStore(STORE_NAMES.CHAPTERS).put({ url: 'u1', title: 't1', content: 'c1' });
      tx.objectStore(STORE_NAMES.TRANSLATIONS).put({ id: 'tr1', chapterUrl: 'u1', version: 1, isActive: true });
      tx.objectStore(STORE_NAMES.SETTINGS).put({ key: 'k1', value: 'v1' });
      tx.objectStore(STORE_NAMES.FEEDBACK).put({ id: 'fb1', chapterUrl: 'u1', createdAt: Date.now() });
      tx.objectStore(STORE_NAMES.PROMPT_TEMPLATES).put({ id: 'p1', name: 'n1', isDefault: true, createdAt: Date.now() });
      tx.objectStore(STORE_NAMES.URL_MAPPINGS).put({ url: 'u1', stableId: 's1', isCanonical: true });
    });

    db.close();

    const ok = await createPreMigrationBackup(TEST_DB_NAME, FROM_VERSION, TO_VERSION);
    expect(ok).toBe(true);

    const metadata = getBackupMetadata() as MigrationBackupMetadata | null;
    expect(metadata).not.toBeNull();
    expect(metadata?.fromVersion).toBe(FROM_VERSION);
    expect(metadata?.toVersion).toBe(TO_VERSION);
    expect(metadata?.status).toBe('pending');
    expect(metadata?.chapterCount).toBe(1);
    expect(metadata?.translationCount).toBe(1);

    // Confirm we can retrieve backup data from the selected tier
    const backup = metadata ? await retrieveBackupData(metadata) : null;
    expect(backup).not.toBeNull();
    expect(backup?.chapters).toHaveLength(1);
    expect(backup?.translations).toHaveLength(1);
    expect(backup?.promptTemplates).toHaveLength(1);
    expect(backup?.urlMappings).toHaveLength(1);
  });
});

