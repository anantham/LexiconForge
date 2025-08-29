import { indexedDBService } from '../../services/indexeddb';
import type { AppSettings } from '../../types';

export interface SettingsRepo {
  storeSettings(settings: AppSettings): Promise<void>;
  getSettings(): Promise<AppSettings | null>;
  setSetting<T = any>(key: string, value: T): Promise<void>;
  getSetting<T = any>(key: string): Promise<T | null>;
}

export const settingsRepo: SettingsRepo = {
  storeSettings: (settings) => indexedDBService.storeSettings(settings),
  getSettings: () => indexedDBService.getSettings(),
  setSetting: (key, value) => indexedDBService.setSetting(key, value),
  getSetting: (key) => indexedDBService.getSetting(key),
};