import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import type { AppSettings } from '../../../types';
import { SettingsRepository } from '../../../services/db/repositories/SettingsRepository';
import { createMockAppSettings } from '../../utils/test-data';

const DB_NAME = 'settings-repo-test';
const SETTINGS_STORE = 'settings';

const baseSettings: AppSettings = createMockAppSettings({
  provider: 'OpenAI',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  systemPrompt: 'You are a helpful assistant.',
  contextDepth: 3,
  preloadCount: 3,
  fontSize: 16,
  fontStyle: 'sans',
  lineHeight: 1.5,
});

let db: IDBDatabase;
let repo: SettingsRepository;

const openTestDb = async (): Promise<IDBDatabase> => {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const upgradeDb = request.result;
      if (!upgradeDb.objectStoreNames.contains(SETTINGS_STORE)) {
        upgradeDb.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const deleteDb = async () =>
  new Promise<void>(resolve => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });

beforeEach(async () => {
  await deleteDb();
  db = await openTestDb();
  repo = new SettingsRepository({
    getDb: () => Promise.resolve(db),
    stores: { SETTINGS: SETTINGS_STORE },
  });
});

afterEach(async () => {
  db.close();
  await deleteDb();
});

describe('SettingsRepository', () => {
  it('stores and retrieves app settings', async () => {
    await repo.storeAppSettings(baseSettings);
    const result = await repo.getAppSettings();
    expect(result).toEqual(baseSettings);
  });

  it('overrides app settings with latest values', async () => {
    await repo.storeAppSettings(baseSettings);
    const updated = { ...baseSettings, temperature: 0.3 };
    await repo.storeAppSettings(updated);
    const result = await repo.getAppSettings();
    expect(result?.temperature).toBe(0.3);
  });

  it('persists arbitrary setting keys', async () => {
    const navigationKey = 'navigation-history';
    const history = { stableIds: ['ch-1', 'ch-2'] };
    await repo.setSetting(navigationKey, history);
    const stored = await repo.getSetting<typeof history>(navigationKey);
    expect(stored).toEqual(history);
  });

  it('returns null for missing keys', async () => {
    const value = await repo.getSetting('missing-key');
    expect(value).toBeNull();
  });
});
