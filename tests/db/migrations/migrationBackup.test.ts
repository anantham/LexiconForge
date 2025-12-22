/**
 * Migration Backup Tests
 *
 * Tests the pre-migration backup functionality including:
 * - Backup creation and storage
 * - Tiered storage fallbacks
 * - Metadata management
 * - Cleanup of old backups
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createPreMigrationBackup,
  getBackupMetadata,
  markBackupCompleted,
  markBackupFailed,
  needsPreMigrationBackup,
  cleanupOldBackups,
} from '../../../services/db/core/migrationBackup';
import { STORE_NAMES, applyMigrations } from '../../../services/db/core/schema';

const TEST_DB_NAME = 'test-migration-backup';
const BACKUP_METADATA_KEY = 'lexiconforge-migration-backup-metadata';
const BACKUP_DATA_KEY = 'lexiconforge-migration-backup-data';

describe('Migration Backup', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(async () => {
    // Clean up test database
    localStorage.clear();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(TEST_DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  });

  describe('needsPreMigrationBackup', () => {
    it('should return false for fresh install (oldVersion = 0)', () => {
      expect(needsPreMigrationBackup(0, 12)).toBe(false);
    });

    it('should return false for same version', () => {
      expect(needsPreMigrationBackup(12, 12)).toBe(false);
    });

    it('should return true for upgrade from existing DB', () => {
      expect(needsPreMigrationBackup(11, 12)).toBe(true);
      expect(needsPreMigrationBackup(1, 12)).toBe(true);
    });

    it('should return false for downgrade (should not happen)', () => {
      expect(needsPreMigrationBackup(12, 11)).toBe(false);
    });
  });

  describe('Backup Metadata Management', () => {
    it('should return null when no backup exists', () => {
      expect(getBackupMetadata()).toBeNull();
    });

    it('should store and retrieve backup metadata', () => {
      const metadata = {
        fromVersion: 11,
        toVersion: 12,
        timestamp: new Date().toISOString(),
        chapterCount: 5,
        translationCount: 3,
        sizeBytes: 1024,
        status: 'pending' as const,
        storage: 'localStorage' as const,
      };

      localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));

      const retrieved = getBackupMetadata();
      expect(retrieved).toEqual(metadata);
    });

    it('should mark backup as completed', () => {
      const metadata = {
        fromVersion: 11,
        toVersion: 12,
        timestamp: new Date().toISOString(),
        chapterCount: 5,
        translationCount: 3,
        sizeBytes: 1024,
        status: 'pending' as const,
        storage: 'localStorage' as const,
      };

      localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));

      markBackupCompleted();

      const updated = getBackupMetadata();
      expect(updated?.status).toBe('completed');
    });

    it('should mark backup as failed', () => {
      const metadata = {
        fromVersion: 11,
        toVersion: 12,
        timestamp: new Date().toISOString(),
        chapterCount: 5,
        translationCount: 3,
        sizeBytes: 1024,
        status: 'pending' as const,
        storage: 'localStorage' as const,
      };

      localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));

      markBackupFailed();

      const updated = getBackupMetadata();
      expect(updated?.status).toBe('failed');
    });

    it('should handle missing metadata gracefully when marking', () => {
      // Should not throw when no metadata exists
      expect(() => markBackupCompleted()).not.toThrow();
      expect(() => markBackupFailed()).not.toThrow();
    });
  });

  describe('createPreMigrationBackup', () => {
    it('should skip backup for fresh install', async () => {
      const result = await createPreMigrationBackup(TEST_DB_NAME, 0, 12);
      expect(result).toBe(true);
      expect(getBackupMetadata()).toBeNull();
    });

    it('should create backup with sample data', async () => {
      // First create a database with some data at version 11
      const db = await createTestDbWithData(TEST_DB_NAME, 11);
      db.close();

      // Now create backup before upgrading to version 12
      const result = await createPreMigrationBackup(TEST_DB_NAME, 11, 12);

      expect(result).toBe(true);

      const metadata = getBackupMetadata();
      expect(metadata).not.toBeNull();
      expect(metadata?.fromVersion).toBe(11);
      expect(metadata?.toVersion).toBe(12);
      expect(metadata?.status).toBe('pending');
      expect(metadata?.chapterCount).toBe(2); // We inserted 2 chapters
    });

    it('should store backup data in localStorage for small backups', async () => {
      const db = await createTestDbWithData(TEST_DB_NAME, 11);
      db.close();

      await createPreMigrationBackup(TEST_DB_NAME, 11, 12);

      const backupData = localStorage.getItem(BACKUP_DATA_KEY);
      expect(backupData).not.toBeNull();

      const parsed = JSON.parse(backupData!);
      expect(parsed.chapters).toHaveLength(2);
      expect(parsed.translations).toHaveLength(1);
    });
  });

  describe('cleanupOldBackups', () => {
    it('should not cleanup pending backups', async () => {
      const metadata = {
        fromVersion: 11,
        toVersion: 12,
        timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        chapterCount: 5,
        translationCount: 3,
        sizeBytes: 1024,
        status: 'pending' as const,
        storage: 'localStorage' as const,
      };

      localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));
      localStorage.setItem(BACKUP_DATA_KEY, '{"test": "data"}');

      await cleanupOldBackups(7 * 24 * 60 * 60 * 1000); // 7 day max age

      // Should still exist because status is 'pending'
      expect(getBackupMetadata()).not.toBeNull();
    });

    it('should not cleanup failed backups', async () => {
      const metadata = {
        fromVersion: 11,
        toVersion: 12,
        timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        chapterCount: 5,
        translationCount: 3,
        sizeBytes: 1024,
        status: 'failed' as const,
        storage: 'localStorage' as const,
      };

      localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));
      localStorage.setItem(BACKUP_DATA_KEY, '{"test": "data"}');

      await cleanupOldBackups(7 * 24 * 60 * 60 * 1000);

      // Should still exist because status is 'failed'
      expect(getBackupMetadata()).not.toBeNull();
    });

    it('should cleanup old completed backups', async () => {
      const metadata = {
        fromVersion: 11,
        toVersion: 12,
        timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        chapterCount: 5,
        translationCount: 3,
        sizeBytes: 1024,
        status: 'completed' as const,
        storage: 'localStorage' as const,
      };

      localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));
      localStorage.setItem(BACKUP_DATA_KEY, '{"test": "data"}');

      await cleanupOldBackups(7 * 24 * 60 * 60 * 1000);

      // Should be cleaned up
      expect(getBackupMetadata()).toBeNull();
      expect(localStorage.getItem(BACKUP_DATA_KEY)).toBeNull();
    });

    it('should not cleanup recent completed backups', async () => {
      const metadata = {
        fromVersion: 11,
        toVersion: 12,
        timestamp: new Date().toISOString(), // Just now
        chapterCount: 5,
        translationCount: 3,
        sizeBytes: 1024,
        status: 'completed' as const,
        storage: 'localStorage' as const,
      };

      localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));
      localStorage.setItem(BACKUP_DATA_KEY, '{"test": "data"}');

      await cleanupOldBackups(7 * 24 * 60 * 60 * 1000);

      // Should still exist because it's recent
      expect(getBackupMetadata()).not.toBeNull();
    });
  });
});

/**
 * Helper to create a test database with sample data
 */
async function createTestDbWithData(dbName: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction!;
      const oldVersion = event.oldVersion;

      applyMigrations(db, tx, oldVersion, version);
    };

    request.onsuccess = async () => {
      const db = request.result;

      // Insert test data
      await insertTestData(db);

      resolve(db);
    };

    request.onerror = () => reject(request.error);
  });
}

async function insertTestData(db: IDBDatabase): Promise<void> {
  // Insert chapters
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAMES.CHAPTERS], 'readwrite');
    const store = tx.objectStore(STORE_NAMES.CHAPTERS);

    store.put({
      url: 'https://example.com/ch1',
      title: 'Chapter 1',
      content: 'Content 1',
      stableId: 'stable-1',
      dateAdded: new Date().toISOString(),
    });

    store.put({
      url: 'https://example.com/ch2',
      title: 'Chapter 2',
      content: 'Content 2',
      stableId: 'stable-2',
      dateAdded: new Date().toISOString(),
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // Insert translation
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAMES.TRANSLATIONS], 'readwrite');
    const store = tx.objectStore(STORE_NAMES.TRANSLATIONS);

    store.put({
      id: 'trans-1',
      chapterUrl: 'https://example.com/ch1',
      stableId: 'stable-1',
      version: 1,
      translation: 'Translated content',
      translatedTitle: 'Translated Title',
      isActive: true,
      createdAt: new Date().toISOString(),
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // Insert settings
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAMES.SETTINGS], 'readwrite');
    const store = tx.objectStore(STORE_NAMES.SETTINGS);

    store.put({ key: 'provider', value: 'OpenAI' });
    store.put({ key: 'model', value: 'gpt-4o-mini' });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
