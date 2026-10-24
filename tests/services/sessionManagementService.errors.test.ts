import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PromptTemplate } from '../../types';

vi.mock('../../services/db/operations', () => ({
  TemplatesOps: {
    getAll: vi.fn(),
    getDefault: vi.fn(),
    store: vi.fn(),
    delete: vi.fn(),
    setDefault: vi.fn(),
  },
  MaintenanceOps: { clearAllData: vi.fn() },
}));

import { MaintenanceOps, TemplatesOps } from '../../services/db/operations';
import { SessionManagementService } from '../../services/sessionManagementService';

const template: PromptTemplate = {
  id: 'saved-template',
  name: 'Saved template',
  content: 'Translate precisely.',
  createdAt: '2026-10-24T00:00:00.000Z',
  isDefault: true,
};

describe('session error ownership', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(TemplatesOps.getAll).mockResolvedValue([template]);
    vi.mocked(TemplatesOps.getDefault).mockResolvedValue(template);
  });

  afterEach(() => vi.restoreAllMocks());

  it.each(['getAll', 'getDefault'] as const)('propagates a failed %s read instead of reporting an empty library', async (method) => {
    const error = new DOMException('Database is unavailable', 'InvalidStateError');
    vi.mocked(TemplatesOps[method]).mockRejectedValueOnce(error);

    await expect(SessionManagementService.loadPromptTemplates()).rejects.toBe(error);
  });

  it('does not bootstrap a default template when the initial read fails', async () => {
    vi.mocked(TemplatesOps.getAll).mockRejectedValueOnce(new Error('Database is unavailable'));

    const session = await SessionManagementService.initializeSession();

    expect(session.promptTemplates).toEqual([]);
    expect(TemplatesOps.store).not.toHaveBeenCalled();
    expect(TemplatesOps.setDefault).not.toHaveBeenCalled();
  });

  it('still initializes an actually empty template database', async () => {
    vi.mocked(TemplatesOps.getAll).mockResolvedValueOnce([]);
    vi.mocked(TemplatesOps.getDefault).mockResolvedValueOnce(null);

    const session = await SessionManagementService.initializeSession();

    expect(session.promptTemplates).toHaveLength(1);
    expect(TemplatesOps.store).toHaveBeenCalledWith(session.activePromptTemplate);
    expect(TemplatesOps.setDefault).toHaveBeenCalledWith(session.activePromptTemplate?.id);
  });

  it.each([
    ['create', 'store', () => SessionManagementService.createPromptTemplate(template)],
    ['update', 'store', () => SessionManagementService.updatePromptTemplate(template)],
    ['delete', 'delete', () => SessionManagementService.deletePromptTemplate(template.id)],
    ['activate', 'setDefault', () => SessionManagementService.setActivePromptTemplate(template.id)],
  ] as const)('preserves the database error for the %s caller', async (_operation, method, action) => {
    const error = new DOMException('Transaction aborted', 'AbortError');
    vi.mocked(TemplatesOps[method]).mockRejectedValueOnce(error);

    await expect(action()).rejects.toBe(error);
  });

  it('stops session clearing before touching local settings when the database clear fails', async () => {
    const error = new Error('Cannot clear database');
    vi.mocked(MaintenanceOps.clearAllData).mockRejectedValueOnce(error);
    localStorage.setItem('app-settings', 'saved-settings');

    await expect(SessionManagementService.clearSession()).rejects.toBe(error);

    expect(localStorage.getItem('app-settings')).toBe('saved-settings');
  });
});
