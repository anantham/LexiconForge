/**
 * Migration Restore Tests
 *
 * Tests the restore functionality including:
 * - Restore availability checks
 * - Data restoration from localStorage
 * - Emergency restore from uploaded file
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  canRestoreFromBackup,
  getRestoreInfo,
  restoreFromBackup,
  emergencyRestore,
} from '../../../services/db/core/migrationRestore';
import { STORE_NAMES } from '../../../services/db/core/schema';

const BACKUP_METADATA_KEY = 'lexiconforge-migration-backup-metadata';
const BACKUP_DATA_KEY = 'lexiconforge-migration-backup-data';
const TEST_DB_NAME = 'lexicon-forge';

describe('Migration Restore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(async () => {
    localStorage.clear();
    // Clean up any test databases
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(TEST_DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  });

  describe('canRestoreFromBackup', () => {
    it('should return false when no backup exists', () => {
      expect(canRestoreFromBackup()).toBe(false);
    });

    it('should return false when backup status is pending', () => {
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

      expect(canRestoreFromBackup()).toBe(false);
    });

    it('should return false when backup status is completed', () => {
      const metadata = {
        fromVersion: 11,
        toVersion: 12,
        timestamp: new Date().toISOString(),
        chapterCount: 5,
        translationCount: 3,
        sizeBytes: 1024,
        status: 'completed' as const,
        storage: 'localStorage' as const,
      };
      localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));

      expect(canRestoreFromBackup()).toBe(false);
    });

    it('should return true when backup status is failed', () => {
      const metadata = {
        fromVersion: 11,
        toVersion: 12,
        timestamp: new Date().toISOString(),
        chapterCount: 5,
        translationCount: 3,
        sizeBytes: 1024,
        status: 'failed' as const,
        storage: 'localStorage' as const,
      };
      localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));

      expect(canRestoreFromBackup()).toBe(true);
    });
  });

  describe('getRestoreInfo', () => {
    it('should return not available when no backup exists', () => {
      const info = getRestoreInfo();
      expect(info.available).toBe(false);
      expect(info.metadata).toBeNull();
      expect(info.reason).toBe('No backup found');
    });

    it('should return not available for pending backup', () => {
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

      const info = getRestoreInfo();
      expect(info.available).toBe(false);
      expect(info.reason).toBe('Migration still in progress');
    });

    it('should return not available for completed backup', () => {
      const metadata = {
        fromVersion: 11,
        toVersion: 12,
        timestamp: new Date().toISOString(),
        chapterCount: 5,
        translationCount: 3,
        sizeBytes: 1024,
        status: 'completed' as const,
        storage: 'localStorage' as const,
      };
      localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));

      const info = getRestoreInfo();
      expect(info.available).toBe(false);
      expect(info.reason).toBe('Backup already restored (migration succeeded)');
    });

    it('should return available for failed backup', () => {
      const metadata = {
        fromVersion: 11,
        toVersion: 12,
        timestamp: new Date().toISOString(),
        chapterCount: 5,
        translationCount: 3,
        sizeBytes: 1024,
        status: 'failed' as const,
        storage: 'localStorage' as const,
      };
      localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));

      const info = getRestoreInfo();
      expect(info.available).toBe(true);
      expect(info.metadata).toEqual(metadata);
      expect(info.reason).toBeUndefined();
    });
  });

  describe('restoreFromBackup', () => {
    it('should fail when no backup metadata exists', async () => {
      const result = await restoreFromBackup();
      expect(result.success).toBe(false);
      expect(result.message).toBe('No backup metadata found');
    });

    it('should fail when backup is not in failed state', async () => {
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

      const result = await restoreFromBackup();
      expect(result.success).toBe(false);
      expect(result.message).toContain('Cannot restore from backup with status');
    });

    it('should restore from localStorage backup successfully', async () => {
      // Set up failed backup metadata
      const metadata = {
        fromVersion: 11,
        toVersion: 12,
        timestamp: new Date().toISOString(),
        chapterCount: 2,
        translationCount: 1,
        sizeBytes: 1024,
        status: 'failed' as const,
        storage: 'localStorage' as const,
      };
      localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));

      // Set up backup data
      const backupData = {
        metadata,
        chapters: [
          {
            url: 'https://example.com/ch1',
            title: 'Chapter 1',
            content: 'Content 1',
            stableId: 'stable-1',
            dateAdded: new Date().toISOString(),
          },
          {
            url: 'https://example.com/ch2',
            title: 'Chapter 2',
            content: 'Content 2',
            stableId: 'stable-2',
            dateAdded: new Date().toISOString(),
          },
        ],
        translations: [
          {
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
          },
        ],
        settings: [],
        feedback: [],
        promptTemplates: [],
        urlMappings: [],
        novels: [],
        chapterSummaries: [],
        amendmentLogs: [],
        diffResults: [],
      };
      localStorage.setItem(BACKUP_DATA_KEY, JSON.stringify(backupData));

      const result = await restoreFromBackup();

      expect(result.success).toBe(true);
      expect(result.restoredVersion).toBe(11);
      expect(result.recordsRestored?.chapters).toBe(2);
      expect(result.recordsRestored?.translations).toBe(1);

      // Verify metadata was cleaned up
      expect(localStorage.getItem(BACKUP_METADATA_KEY)).toBeNull();
    });
  });

  describe('emergencyRestore', () => {
    it('should reject invalid backup format', async () => {
      const result = await emergencyRestore('{"invalid": "data"}');
      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid backup format');
    });

    it('should reject malformed JSON', async () => {
      const result = await emergencyRestore('not-json');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Emergency restore failed');
    });

    it('should restore from valid backup JSON', async () => {
      const backupData = {
        metadata: {
          fromVersion: 11,
          toVersion: 12,
          timestamp: new Date().toISOString(),
          chapterCount: 1,
          translationCount: 0,
          sizeBytes: 512,
          status: 'failed' as const,
          storage: 'userDownload' as const,
        },
        chapters: [
          {
            url: 'https://example.com/emergency',
            title: 'Emergency Chapter',
            content: 'Emergency content',
            stableId: 'emergency-1',
            dateAdded: new Date().toISOString(),
          },
        ],
        translations: [],
        settings: [],
        feedback: [],
        promptTemplates: [],
        urlMappings: [],
        novels: [],
        chapterSummaries: [],
        amendmentLogs: [],
        diffResults: [],
      };

      const result = await emergencyRestore(JSON.stringify(backupData));

      expect(result.success).toBe(true);
      expect(result.restoredVersion).toBe(11);
      expect(result.recordsRestored?.chapters).toBe(1);
      expect(result.message).toContain('1 chapters restored');
    });

    it('should clear existing backup metadata after emergency restore', async () => {
      // Set up some existing metadata
      localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify({ status: 'failed' }));

      const backupData = {
        metadata: {
          fromVersion: 10,
          toVersion: 11,
          timestamp: new Date().toISOString(),
          chapterCount: 0,
          translationCount: 0,
          sizeBytes: 128,
          status: 'failed' as const,
          storage: 'userDownload' as const,
        },
        chapters: [],
        translations: [],
        settings: [],
        feedback: [],
        promptTemplates: [],
        urlMappings: [],
        novels: [],
        chapterSummaries: [],
        amendmentLogs: [],
        diffResults: [],
      };

      await emergencyRestore(JSON.stringify(backupData));

      // Metadata should be cleared
      expect(localStorage.getItem(BACKUP_METADATA_KEY)).toBeNull();
    });
  });
});
