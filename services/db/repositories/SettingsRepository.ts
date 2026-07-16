import type { AppSettings } from '../../../types';
import {
  promisifyRequest,
  runTransaction,
  type TransactionMode,
} from '../core/txn';
import type { SettingsRecord } from '../types';
import type { ISettingsRepository } from './interfaces/ISettingsRepository';

interface SettingsRepositoryDeps {
  getDb: () => Promise<IDBDatabase>;
  stores: {
    SETTINGS: string;
  };
  appSettingsKey?: string;
}

export class SettingsRepository implements ISettingsRepository {
  private readonly appSettingsKey: string;

  constructor(private readonly deps: SettingsRepositoryDeps) {
    this.appSettingsKey = deps.appSettingsKey ?? 'app-settings';
  }

  private async withStore<T>(
    mode: TransactionMode,
    operationName: string,
    fn: (store: IDBObjectStore) => Promise<T> | T
  ): Promise<T> {
    const db = await this.deps.getDb();
    const storeName = this.deps.stores.SETTINGS;
    return runTransaction(
      db,
      storeName,
      mode,
      (_transaction, stores) => fn(stores[storeName]),
      'settings',
      'SettingsRepository',
      operationName
    );
  }

  async storeAppSettings(settings: AppSettings): Promise<void> {
    await this.setSetting(this.appSettingsKey, settings);
  }

  async getAppSettings(): Promise<AppSettings | null> {
    return this.getSetting<AppSettings>(this.appSettingsKey);
  }

  async setSetting<T = unknown>(key: string, value: T): Promise<void> {
    await this.withStore('readwrite', 'setSetting', async store => {
      const record: SettingsRecord = {
        key,
        value,
        updatedAt: new Date().toISOString(),
      };
      await promisifyRequest(store.put(record));
    });
  }

  async getSetting<T = unknown>(key: string): Promise<T | null> {
    return this.withStore('readonly', 'getSetting', async store => {
      const record = await promisifyRequest<SettingsRecord | undefined>(store.get(key));
      return (record?.value as T) ?? null;
    });
  }
}
