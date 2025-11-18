import type { AppSettings } from '../../../../types';

export interface ISettingsRepository {
  storeAppSettings(settings: AppSettings): Promise<void>;
  getAppSettings(): Promise<AppSettings | null>;
  setSetting<T = unknown>(key: string, value: T): Promise<void>;
  getSetting<T = unknown>(key: string): Promise<T | null>;
}
