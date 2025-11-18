import type { AppSettings } from '../../../types';
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
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => Promise<T> | T
  ): Promise<T> {
    const db = await this.deps.getDb();
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction([this.deps.stores.SETTINGS], mode);
      const store = tx.objectStore(this.deps.stores.SETTINGS);
      Promise.resolve(fn(store))
        .then(resolve)
        .catch(reject);
      tx.onerror = () => reject(tx.error);
    });
  }

  async storeAppSettings(settings: AppSettings): Promise<void> {
    await this.setSetting(this.appSettingsKey, settings);
  }

  async getAppSettings(): Promise<AppSettings | null> {
    return this.getSetting<AppSettings>(this.appSettingsKey);
  }

  async setSetting<T = unknown>(key: string, value: T): Promise<void> {
    await this.withStore('readwrite', async store => {
      const record: SettingsRecord = {
        key,
        value,
        updatedAt: new Date().toISOString(),
      };
      await new Promise<void>((resolve, reject) => {
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  }

  async getSetting<T = unknown>(key: string): Promise<T | null> {
    return this.withStore('readonly', store => {
      return new Promise<T | null>((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => {
          const record = req.result as SettingsRecord | undefined;
          resolve((record?.value as T) ?? null);
        };
        req.onerror = () => reject(req.error);
      });
    });
  }
}
