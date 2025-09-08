import type { AppSettings } from '../../../types';
import { indexedDBService } from '../../indexeddb';

export class SettingsOps {
  static async store(settings: AppSettings) {
    return indexedDBService.storeSettings(settings);
  }
  static async get(): Promise<AppSettings | null> {
    return indexedDBService.getSettings();
  }
  static async set<T = any>(key: string, value: T) {
    return indexedDBService.setSetting(key, value);
  }
  static async getKey<T = any>(key: string): Promise<T | null> {
    return indexedDBService.getSetting<T>(key);
  }
}
