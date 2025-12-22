import { describe, it, expect, afterEach } from 'vitest';
import { checkDatabaseVersion } from '../../../services/db/core/versionGate';
import { BACKUP_METADATA_KEY, type MigrationBackupMetadata } from '../../../services/db/core/migrationTypes';
import { SCHEMA_VERSIONS } from '../../../services/db/core/schema';

const TEST_DB_NAME = 'test-version-gate';
const EXPECTED_VERSION = SCHEMA_VERSIONS.CURRENT;

async function createDb(version: number): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(TEST_DB_NAME, version);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      // Ensure at least one store exists so the DB is created.
      const db = request.result;
      if (!db.objectStoreNames.contains('dummy')) {
        db.createObjectStore('dummy', { keyPath: 'id' });
      }
    };
  });
  db.close();
}

async function deleteDb(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(TEST_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('blocked'));
  });
}

describe('VersionGate', () => {
  afterEach(async () => {
    try {
      await deleteDb();
    } catch {
      // ignore
    }
    localStorage.removeItem(BACKUP_METADATA_KEY);
  });

  it('returns fresh-install when no DB exists', async () => {
    const result = await checkDatabaseVersion(TEST_DB_NAME, EXPECTED_VERSION);
    expect(result.status).toBe('fresh-install');
    expect(result.canProceed).toBe(true);
  });

  it('returns ok when DB version matches app version', async () => {
    await createDb(EXPECTED_VERSION);
    const result = await checkDatabaseVersion(TEST_DB_NAME, EXPECTED_VERSION);
    expect(result.status).toBe('ok');
    expect(result.canProceed).toBe(true);
  });

  it('returns upgrade-needed when DB is older', async () => {
    await createDb(EXPECTED_VERSION - 1);
    const result = await checkDatabaseVersion(TEST_DB_NAME, EXPECTED_VERSION);
    expect(result.status).toBe('upgrade-needed');
    expect(result.canProceed).toBe(true);
    expect(result.requiresBackup).toBe(true);
  });

  it('returns db-newer when DB is newer than app', async () => {
    await createDb(EXPECTED_VERSION + 1);
    const result = await checkDatabaseVersion(TEST_DB_NAME, EXPECTED_VERSION);
    expect(result.status).toBe('db-newer');
    expect(result.canProceed).toBe(false);
  });

  it('returns migration-failed when failed backup metadata exists', async () => {
    const metadata: MigrationBackupMetadata = {
      fromVersion: EXPECTED_VERSION - 1,
      toVersion: EXPECTED_VERSION,
      timestamp: new Date().toISOString(),
      chapterCount: 1,
      translationCount: 1,
      sizeBytes: 123,
      status: 'failed',
      storage: 'localStorage',
    };
    localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));

    const result = await checkDatabaseVersion(TEST_DB_NAME, EXPECTED_VERSION);
    expect(result.status).toBe('migration-failed');
    expect(result.canProceed).toBe(false);
    expect(result.action).toBe('restore-backup');
  });
});

