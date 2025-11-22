import type { AppSettings } from '../../../types';
import { settingsRepository } from '../repositories/instances';

export class SettingsOps {
  static async store(settings: AppSettings) {
    return settingsRepository.storeAppSettings(settings);
  }
  static async get(): Promise<AppSettings | null> {
    return settingsRepository.getAppSettings();
  }
  static async set<T = any>(key: string, value: T) {
    return settingsRepository.setSetting(key, value);
  }
  static async getKey<T = any>(key: string): Promise<T | null> {
    return settingsRepository.getSetting<T>(key);
  }
}
