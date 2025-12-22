/**
 * Version Gate Service
 *
 * Checks database version before opening to handle:
 * - DB newer than app (can't downgrade - must update app)
 * - DB older than app (needs migration with backup)
 * - DB corrupted (offer restore or fresh start)
 */

import { DB_NAME, DB_VERSION } from './connection';
import { getBackupMetadata } from './migrationTypes';
import { canRestoreFromBackup } from './migrationRestore';

export type VersionCheckStatus =
  | 'ok'                    // Same version, proceed normally
  | 'fresh-install'         // No existing DB
  | 'upgrade-needed'        // DB older, migration required
  | 'db-newer'              // DB newer than app, can't open
  | 'db-corrupted'          // Can't read DB version
  | 'migration-failed'      // Previous migration failed, restore available
  | 'blocked';              // Another connection is blocking

export interface VersionCheckResult {
  status: VersionCheckStatus;
  currentDbVersion: number | null;
  expectedVersion: number;
  canProceed: boolean;
  requiresBackup: boolean;
  message: string;
  action?: 'update-app' | 'restore-backup' | 'create-backup' | 'fresh-start';
}

/**
 * Check database version without triggering an upgrade.
 * This should be called BEFORE getConnection().
 */
export async function checkDatabaseVersion(): Promise<VersionCheckResult> {
  const expectedVersion = DB_VERSION;

  // First check if there's a failed migration we need to handle
  if (canRestoreFromBackup()) {
    const metadata = getBackupMetadata();
    return {
      status: 'migration-failed',
      currentDbVersion: metadata?.fromVersion ?? null,
      expectedVersion,
      canProceed: false,
      requiresBackup: false,
      message: `Previous migration to v${metadata?.toVersion} failed. A backup from v${metadata?.fromVersion} is available.`,
      action: 'restore-backup',
    };
  }

  try {
    const currentVersion = await peekDbVersion();

    // Fresh install - no existing database
    if (currentVersion === null) {
      return {
        status: 'fresh-install',
        currentDbVersion: null,
        expectedVersion,
        canProceed: true,
        requiresBackup: false,
        message: 'Fresh installation, no existing data.',
      };
    }

    // Same version - all good
    if (currentVersion === expectedVersion) {
      return {
        status: 'ok',
        currentDbVersion: currentVersion,
        expectedVersion,
        canProceed: true,
        requiresBackup: false,
        message: 'Database version matches app version.',
      };
    }

    // DB is older - needs upgrade with backup
    if (currentVersion < expectedVersion) {
      return {
        status: 'upgrade-needed',
        currentDbVersion: currentVersion,
        expectedVersion,
        canProceed: true,  // Can proceed after backup
        requiresBackup: true,
        message: `Database will be upgraded from v${currentVersion} to v${expectedVersion}. A backup will be created first.`,
        action: 'create-backup',
      };
    }

    // DB is newer than app - CANNOT proceed
    return {
      status: 'db-newer',
      currentDbVersion: currentVersion,
      expectedVersion,
      canProceed: false,
      requiresBackup: false,
      message:
        `Your database (v${currentVersion}) is from a newer version of the app (expects v${expectedVersion}). ` +
        `Please update the app or use the newer version to export your data.`,
      action: 'update-app',
    };

  } catch (error) {
    // Check if it's a blocked error
    if (error instanceof Error && error.message.includes('blocked')) {
      return {
        status: 'blocked',
        currentDbVersion: null,
        expectedVersion,
        canProceed: false,
        requiresBackup: false,
        message: 'Database is being used by another tab. Please close other LexiconForge tabs and try again.',
      };
    }

    // Unknown error - likely corrupted
    return {
      status: 'db-corrupted',
      currentDbVersion: null,
      expectedVersion,
      canProceed: false,
      requiresBackup: false,
      message: `Could not read database: ${error instanceof Error ? error.message : String(error)}`,
      action: 'fresh-start',
    };
  }
}

/**
 * Peek at the current database version without triggering any upgrades.
 * Returns null if database doesn't exist.
 */
async function peekDbVersion(): Promise<number | null> {
  return new Promise((resolve, reject) => {
    // First check if database exists by listing all databases
    if ('databases' in indexedDB) {
      indexedDB.databases().then((databases) => {
        const ourDb = databases.find((db) => db.name === DB_NAME);
        if (!ourDb) {
          resolve(null); // Database doesn't exist
          return;
        }
        resolve(ourDb.version ?? null);
      }).catch(() => {
        // Fallback to open method if databases() not supported
        openToCheckVersion(resolve, reject);
      });
    } else {
      // Safari and older browsers don't support databases()
      openToCheckVersion(resolve, reject);
    }
  });
}

/**
 * Fallback version check by opening DB
 */
function openToCheckVersion(
  resolve: (version: number | null) => void,
  reject: (error: Error) => void
): void {
  // Open without specifying version to get current version
  const request = indexedDB.open(DB_NAME);

  request.onsuccess = () => {
    const db = request.result;
    const version = db.version;
    db.close();
    resolve(version);
  };

  request.onerror = () => {
    // If we get an error, the DB might not exist or is corrupted
    if (request.error?.name === 'NotFoundError') {
      resolve(null);
    } else {
      reject(new Error(request.error?.message || 'Failed to open database'));
    }
  };

  request.onblocked = () => {
    reject(new Error('Database access blocked by another connection'));
  };

  // If onupgradeneeded fires with oldVersion 0, it means the DB didn't exist
  request.onupgradeneeded = (event) => {
    if (event.oldVersion === 0) {
      // DB didn't exist, abort and report as null
      request.transaction?.abort();
      resolve(null);
    }
  };
}

/**
 * Format a version check result for logging
 */
export function formatVersionCheck(result: VersionCheckResult): string {
  const parts = [
    `Status: ${result.status}`,
    `DB Version: ${result.currentDbVersion ?? 'none'}`,
    `App Version: ${result.expectedVersion}`,
    `Can Proceed: ${result.canProceed}`,
    `Requires Backup: ${result.requiresBackup}`,
  ];

  if (result.action) {
    parts.push(`Action: ${result.action}`);
  }

  return parts.join(' | ');
}

/**
 * Check if app should show upgrade UI
 */
export function shouldShowUpgradeNotice(result: VersionCheckResult): boolean {
  return result.status === 'upgrade-needed' && result.requiresBackup;
}

/**
 * Check if app should block and show error
 */
export function shouldBlockApp(result: VersionCheckResult): boolean {
  return !result.canProceed;
}

/**
 * Get user-friendly title for the status
 */
export function getStatusTitle(status: VersionCheckStatus): string {
  switch (status) {
    case 'ok':
      return 'Ready';
    case 'fresh-install':
      return 'Welcome';
    case 'upgrade-needed':
      return 'Database Upgrade';
    case 'db-newer':
      return 'App Update Required';
    case 'db-corrupted':
      return 'Database Error';
    case 'migration-failed':
      return 'Migration Failed';
    case 'blocked':
      return 'Database Busy';
    default:
      return 'Database Status';
  }
}

/**
 * Get user-friendly action button text
 */
export function getActionButtonText(action?: string): string {
  switch (action) {
    case 'update-app':
      return 'Check for Updates';
    case 'restore-backup':
      return 'Restore from Backup';
    case 'create-backup':
      return 'Continue with Backup';
    case 'fresh-start':
      return 'Start Fresh';
    default:
      return 'Continue';
  }
}
