/**
 * MigrationRecovery Component
 *
 * Displays when:
 * 1. A previous migration failed and backup is available
 * 2. Database is newer than app version
 * 3. Database is corrupted
 *
 * Provides actions to restore from backup or start fresh.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  getRestoreInfo,
  restoreFromBackup,
  emergencyRestore,
  type RestoreResult,
} from '../services/db/core/migrationRestore';
import {
  checkDatabaseVersion,
  getStatusTitle,
  getActionButtonText,
  type VersionCheckResult,
} from '../services/db/core/versionGate';

interface MigrationRecoveryProps {
  onRecoveryComplete?: () => void;
  onStartFresh?: () => void;
}

type RecoveryState =
  | 'checking'
  | 'no-issues'
  | 'migration-failed'
  | 'db-newer'
  | 'db-corrupted'
  | 'restoring'
  | 'restored'
  | 'restore-failed';

export function MigrationRecovery({
  onRecoveryComplete,
  onStartFresh,
}: MigrationRecoveryProps) {
  const [state, setState] = useState<RecoveryState>('checking');
  const [versionCheck, setVersionCheck] = useState<VersionCheckResult | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setState('checking');

    // Check for failed migration first
    const restoreInfo = getRestoreInfo();
    if (restoreInfo.available && restoreInfo.metadata) {
      setVersionCheck({
        status: 'migration-failed',
        currentDbVersion: restoreInfo.metadata.fromVersion,
        expectedVersion: restoreInfo.metadata.toVersion,
        canProceed: false,
        requiresBackup: false,
        message: `Migration to v${restoreInfo.metadata.toVersion} failed. Backup from v${restoreInfo.metadata.fromVersion} available.`,
        action: 'restore-backup',
      });
      setState('migration-failed');
      return;
    }

    // Check database version
    const check = await checkDatabaseVersion();
    setVersionCheck(check);

    switch (check.status) {
      case 'db-newer':
        setState('db-newer');
        break;
      case 'db-corrupted':
        setState('db-corrupted');
        break;
      case 'migration-failed':
        setState('migration-failed');
        break;
      default:
        setState('no-issues');
        break;
    }
  };

  const handleRestore = useCallback(async () => {
    setState('restoring');
    setError(null);

    try {
      const result = await restoreFromBackup();
      setRestoreResult(result);

      if (result.success) {
        setState('restored');
        // Give user a moment to see success, then trigger completion
        setTimeout(() => {
          onRecoveryComplete?.();
        }, 2000);
      } else {
        setState('restore-failed');
        setError(result.message);
      }
    } catch (err) {
      setState('restore-failed');
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [onRecoveryComplete]);

  const handleUploadBackup = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setState('restoring');
      setError(null);

      try {
        const text = await file.text();
        const result = await emergencyRestore(text);
        setRestoreResult(result);

        if (result.success) {
          setState('restored');
          setTimeout(() => {
            onRecoveryComplete?.();
          }, 2000);
        } else {
          setState('restore-failed');
          setError(result.message);
        }
      } catch (err) {
        setState('restore-failed');
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    input.click();
  }, [onRecoveryComplete]);

  const handleStartFresh = useCallback(() => {
    if (
      window.confirm(
        'This will delete all your data and start fresh. Are you sure?\n\n' +
          'This cannot be undone.'
      )
    ) {
      onStartFresh?.();
    }
  }, [onStartFresh]);

  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  // Don't render anything if no issues
  if (state === 'no-issues' || state === 'checking') {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className={`px-6 py-4 ${
            state === 'restored'
              ? 'bg-green-500'
              : state === 'restore-failed'
              ? 'bg-red-500'
              : 'bg-amber-500'
          }`}
        >
          <h2 className="text-xl font-bold text-white">
            {state === 'restored'
              ? 'Restore Complete'
              : state === 'restore-failed'
              ? 'Restore Failed'
              : state === 'restoring'
              ? 'Restoring...'
              : getStatusTitle(versionCheck?.status || 'db-corrupted')}
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {state === 'restoring' && (
            <div className="flex flex-col items-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300">
                Restoring your data...
              </p>
            </div>
          )}

          {state === 'restored' && restoreResult && (
            <div className="py-4">
              <p className="text-green-600 dark:text-green-400 mb-2">
                {restoreResult.message}
              </p>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Restored to version {restoreResult.restoredVersion}
              </p>
              {restoreResult.recordsRestored && (
                <ul className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <li>{restoreResult.recordsRestored.chapters} chapters</li>
                  <li>
                    {restoreResult.recordsRestored.translations} translations
                  </li>
                </ul>
              )}
              <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm">
                Reloading in a moment...
              </p>
            </div>
          )}

          {state === 'restore-failed' && (
            <div className="py-4">
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                You can try uploading a backup file manually, or start fresh.
              </p>
            </div>
          )}

          {state === 'migration-failed' && (
            <div className="py-4">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                {versionCheck?.message}
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                A backup was created before the failed upgrade. You can restore
                your data to the previous version.
              </p>
            </div>
          )}

          {state === 'db-newer' && (
            <div className="py-4">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                {versionCheck?.message}
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Your database was created by a newer version of LexiconForge.
                Please update the app or use the newer version to export your
                data.
              </p>
            </div>
          )}

          {state === 'db-corrupted' && (
            <div className="py-4">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                {versionCheck?.message}
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                If you have a backup file, you can upload it to restore your
                data.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
          <div className="flex flex-col gap-2">
            {/* Primary action */}
            {state === 'migration-failed' && (
              <button
                onClick={handleRestore}
                className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
              >
                Restore from Backup
              </button>
            )}

            {state === 'db-newer' && (
              <button
                onClick={handleRefresh}
                className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
              >
                Check for Updates
              </button>
            )}

            {state === 'restored' && (
              <button
                onClick={handleRefresh}
                className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
              >
                Reload App
              </button>
            )}

            {/* Secondary actions */}
            {(state === 'restore-failed' || state === 'db-corrupted') && (
              <>
                <button
                  onClick={handleUploadBackup}
                  className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
                >
                  Upload Backup File
                </button>
                <button
                  onClick={handleStartFresh}
                  className="w-full px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                >
                  Start Fresh
                </button>
              </>
            )}

            {state === 'migration-failed' && (
              <button
                onClick={handleUploadBackup}
                className="w-full px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 font-medium rounded-lg transition-colors"
              >
                Upload Different Backup
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check if migration recovery is needed
 */
export function useMigrationRecoveryNeeded(): {
  isChecking: boolean;
  needsRecovery: boolean;
  versionCheck: VersionCheckResult | null;
} {
  const [isChecking, setIsChecking] = useState(true);
  const [needsRecovery, setNeedsRecovery] = useState(false);
  const [versionCheck, setVersionCheck] = useState<VersionCheckResult | null>(
    null
  );

  useEffect(() => {
    async function check() {
      setIsChecking(true);

      // Check for failed migration
      const restoreInfo = getRestoreInfo();
      if (restoreInfo.available) {
        setNeedsRecovery(true);
        setIsChecking(false);
        return;
      }

      // Check version compatibility
      const result = await checkDatabaseVersion();
      setVersionCheck(result);
      setNeedsRecovery(!result.canProceed);
      setIsChecking(false);
    }

    check();
  }, []);

  return { isChecking, needsRecovery, versionCheck };
}

export default MigrationRecovery;
