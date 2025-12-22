/**
 * Migration Types
 *
 * Shared types, interfaces, and constants for the migration safety system.
 */

// Storage keys
export const BACKUP_METADATA_KEY = 'lexiconforge-migration-backup-metadata';
export const BACKUP_DATA_KEY = 'lexiconforge-migration-backup-data';
export const BACKUP_DB_NAME = 'lexiconforge-backups';

export type BackupStorageTier = 'opfs' | 'backupDb' | 'localStorage' | 'userDownload';

export interface MigrationBackupMetadata {
  fromVersion: number;
  toVersion: number;
  timestamp: string;
  chapterCount: number;
  translationCount: number;
  sizeBytes: number;
  status: 'pending' | 'completed' | 'failed';
  storage: BackupStorageTier;
  fileName?: string;
}

export interface BackupData {
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
 * Save backup metadata
 */
export function setBackupMetadata(metadata: MigrationBackupMetadata): void {
  localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));
}

/**
 * Clear backup metadata
 */
export function clearBackupMetadata(): void {
  localStorage.removeItem(BACKUP_METADATA_KEY);
}

/**
 * Mark backup as completed (called after successful migration)
 */
export function markBackupCompleted(): void {
  const metadata = getBackupMetadata();
  if (metadata) {
    metadata.status = 'completed';
    setBackupMetadata(metadata);
  }
}

/**
 * Mark backup as failed (called if migration fails)
 */
export function markBackupFailed(): void {
  const metadata = getBackupMetadata();
  if (metadata) {
    metadata.status = 'failed';
    setBackupMetadata(metadata);
  }
}
