import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MigrationRecovery from '../../components/MigrationRecovery';
import type { VersionCheckResult } from '../../services/db/core/versionGate';
import type { MigrationBackupMetadata, RestoreResult } from '../../services/db/core/migrationTypes';

const restoreFromBackupMock = vi.fn<() => Promise<RestoreResult>>();
const emergencyRestoreMock = vi.fn<(json: string) => Promise<RestoreResult>>();
const deleteDatabaseMock = vi.fn<() => Promise<void>>();
const cleanupStorageTierMock = vi.fn<(metadata: MigrationBackupMetadata) => Promise<void>>();
const getBackupMetadataMock = vi.fn<() => MigrationBackupMetadata | null>();
const clearBackupMetadataMock = vi.fn<() => void>();

vi.mock('../../services/db/core/migrationRestore', () => ({
  restoreFromBackup: () => restoreFromBackupMock(),
  emergencyRestore: (json: string) => emergencyRestoreMock(json),
  canRestoreFromBackup: () => false,
}));

vi.mock('../../services/db/core/connection', () => ({
  deleteDatabase: () => deleteDatabaseMock(),
}));

vi.mock('../../services/db/core/backupStorage', () => ({
  cleanupStorageTier: (metadata: MigrationBackupMetadata) => cleanupStorageTierMock(metadata),
}));

vi.mock('../../services/db/core/migrationTypes', async () => {
  const actual = await vi.importActual<typeof import('../../services/db/core/migrationTypes')>(
    '../../services/db/core/migrationTypes'
  );
  return {
    ...actual,
    getBackupMetadata: () => getBackupMetadataMock(),
    clearBackupMetadata: () => clearBackupMetadataMock(),
  };
});

const baseVersionCheck = (overrides: Partial<VersionCheckResult>): VersionCheckResult => ({
  status: 'blocked',
  currentDbVersion: null,
  expectedVersion: 12,
  canProceed: false,
  requiresBackup: false,
  message: 'Database blocked.',
  ...overrides,
});

describe('MigrationRecovery', () => {
  beforeEach(() => {
    restoreFromBackupMock.mockReset();
    emergencyRestoreMock.mockReset();
    deleteDatabaseMock.mockReset();
    cleanupStorageTierMock.mockReset();
    getBackupMetadataMock.mockReset();
    clearBackupMetadataMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a retry action for blocked databases', () => {
    const onRetry = vi.fn();
    render(<MigrationRecovery versionCheck={baseVersionCheck({})} onRetry={onRetry} />);

    expect(screen.getByText('Database Busy')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('restores from backup when migration failed', async () => {
    const onRecovered = vi.fn();
    restoreFromBackupMock.mockResolvedValueOnce({ success: true, message: 'ok' });

    render(
      <MigrationRecovery
        versionCheck={baseVersionCheck({
          status: 'migration-failed',
          message: 'Migration failed.',
          canProceed: false,
        })}
        onRetry={vi.fn()}
        onRecovered={onRecovered}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Restore from Backup' }));

    await waitFor(() => expect(restoreFromBackupMock).toHaveBeenCalledTimes(1));
    expect(onRecovered).toHaveBeenCalledTimes(1);
  });

  it('shows an error when restore fails', async () => {
    restoreFromBackupMock.mockResolvedValueOnce({ success: false, message: 'nope' });

    render(
      <MigrationRecovery
        versionCheck={baseVersionCheck({
          status: 'migration-failed',
          message: 'Migration failed.',
          canProceed: false,
        })}
        onRetry={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Restore from Backup' }));

    await waitFor(() => expect(screen.getByText('nope')).toBeInTheDocument());
  });

  it('starts fresh after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onRecovered = vi.fn();

    getBackupMetadataMock.mockReturnValue({
      fromVersion: 11,
      toVersion: 12,
      timestamp: new Date().toISOString(),
      chapterCount: 1,
      translationCount: 1,
      sizeBytes: 10,
      status: 'failed',
      storage: 'localStorage',
    });

    cleanupStorageTierMock.mockResolvedValueOnce();
    deleteDatabaseMock.mockResolvedValueOnce();

    render(
      <MigrationRecovery
        versionCheck={baseVersionCheck({
          status: 'db-corrupted',
          message: 'Corrupted DB.',
          canProceed: false,
        })}
        onRetry={vi.fn()}
        onRecovered={onRecovered}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start Fresh' }));

    await waitFor(() => expect(deleteDatabaseMock).toHaveBeenCalledTimes(1));
    expect(cleanupStorageTierMock).toHaveBeenCalledTimes(1);
    expect(clearBackupMetadataMock).toHaveBeenCalledTimes(1);
    expect(onRecovered).toHaveBeenCalledTimes(1);
  });
});
