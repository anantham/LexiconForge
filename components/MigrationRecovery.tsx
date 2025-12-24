import React, { useCallback, useMemo, useState } from 'react';
import { deleteDatabase } from '../services/db/core/connection';
import { cleanupStorageTier } from '../services/db/core/backupStorage';
import { getBackupMetadata, clearBackupMetadata } from '../services/db/core/migrationTypes';
import { emergencyRestore, restoreFromBackup } from '../services/db/core/migrationRestore';
import { getStatusTitle, type VersionCheckResult } from '../services/db/core/versionGate';

interface MigrationRecoveryProps {
  versionCheck: VersionCheckResult;
  onRetry: () => void;
  onRecovered?: () => void;
}

type BusyState = 'idle' | 'restoring' | 'starting-fresh' | 'uploading';

const defaultRecovered = () => window.location.reload();

export function MigrationRecovery({ versionCheck, onRetry, onRecovered }: MigrationRecoveryProps) {
  const recovered = onRecovered ?? defaultRecovered;
  const [busy, setBusy] = useState<BusyState>('idle');
  const [error, setError] = useState<string | null>(null);

  const canRestore = versionCheck.status === 'migration-failed';
  const canUpload = versionCheck.status === 'migration-failed' || versionCheck.status === 'db-corrupted';
  const canStartFresh = versionCheck.status !== 'blocked';

  const title = useMemo(() => getStatusTitle(versionCheck.status), [versionCheck.status]);

  const handleRestore = useCallback(async () => {
    setBusy('restoring');
    setError(null);
    try {
      const result = await restoreFromBackup();
      if (!result.success) {
        setError(result.message);
        setBusy('idle');
        return;
      }
      recovered();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy('idle');
    }
  }, [recovered]);

  const handleUploadBackup = useCallback(async () => {
    setError(null);

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      setBusy('uploading');
      try {
        const text = await file.text();
        const result = await emergencyRestore(text);
        if (!result.success) {
          setError(result.message);
          setBusy('idle');
          return;
        }
        recovered();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setBusy('idle');
      }
    };

    input.click();
  }, [recovered]);

  const handleStartFresh = useCallback(async () => {
    if (
      !window.confirm(
        'This will delete the local database and start fresh.\n\n' +
          'If you have important data, try “Restore from Backup” or export from the newer app first.\n\n' +
          'Continue?'
      )
    ) {
      return;
    }

    setBusy('starting-fresh');
    setError(null);

    try {
      const metadata = getBackupMetadata();
      if (metadata) {
        await cleanupStorageTier(metadata);
      }
      clearBackupMetadata();
    } catch (e) {
      console.warn('[MigrationRecovery] Failed to clean up backup artifacts:', e);
    }

    try {
      await deleteDatabase();
      recovered();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy('idle');
    }
  }, [recovered]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-800">
        <div className="bg-amber-500 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-gray-800 dark:text-gray-200">{versionCheck.message}</p>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-900/20">
          {versionCheck.status === 'blocked' ? (
            <button
              type="button"
              onClick={onRetry}
              className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              Retry
            </button>
          ) : null}

          {canRestore ? (
            <button
              type="button"
              onClick={handleRestore}
              disabled={busy !== 'idle'}
              className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {busy === 'restoring' ? 'Restoring…' : 'Restore from Backup'}
            </button>
          ) : null}

          {canUpload ? (
            <button
              type="button"
              onClick={handleUploadBackup}
              disabled={busy !== 'idle'}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
            >
              {busy === 'uploading' ? 'Uploading…' : 'Upload Backup File'}
            </button>
          ) : null}

          {canStartFresh ? (
            <button
              type="button"
              onClick={handleStartFresh}
              disabled={busy !== 'idle'}
              className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200 dark:hover:bg-red-900/30"
            >
              {busy === 'starting-fresh' ? 'Starting fresh…' : 'Start Fresh'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default MigrationRecovery;

