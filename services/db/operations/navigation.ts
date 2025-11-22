import { SettingsOps } from './settings';

const NAVIGATION_HISTORY_KEY = 'navigation-history';
const LAST_ACTIVE_CHAPTER_KEY = 'lastActiveChapter';

type NavigationHistory = { stableIds: string[] };

export class NavigationOps {
  static async getHistory(): Promise<NavigationHistory | null> {
    return SettingsOps.getKey<NavigationHistory>(NAVIGATION_HISTORY_KEY);
  }

  static async setHistory(history: NavigationHistory): Promise<void> {
    await SettingsOps.set(NAVIGATION_HISTORY_KEY, history);
  }

  static async getLastActiveChapter<T = any>(): Promise<T | null> {
    return SettingsOps.getKey<T>(LAST_ACTIVE_CHAPTER_KEY);
  }

  static async setLastActiveChapter<T = any>(value: T): Promise<void> {
    await SettingsOps.set(LAST_ACTIVE_CHAPTER_KEY, value);
  }
}
