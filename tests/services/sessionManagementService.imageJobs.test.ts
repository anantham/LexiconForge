import { beforeEach, describe, expect, it } from 'vitest';
import { RESUMABLE_IMAGE_JOBS_STORAGE_KEY } from '../../services/imageJobTypes';
import { SessionManagementService } from '../../services/sessionManagementService';

describe('SessionManagementService image-job cleanup', () => {
  beforeEach(() => localStorage.clear());

  it('removes resumable image jobs when local session data is cleared', async () => {
    localStorage.setItem(RESUMABLE_IMAGE_JOBS_STORAGE_KEY, JSON.stringify([
      { id: 'job-1', externalTaskId: 'broker-task-1' },
    ]));

    await SessionManagementService.clearSession({
      clearSettings: false,
      clearPromptTemplates: false,
      clearIndexedDB: false,
      clearLocalStorage: true,
    });

    expect(localStorage.getItem(RESUMABLE_IMAGE_JOBS_STORAGE_KEY)).toBeNull();
  });
});
