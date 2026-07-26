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

  /**
   * Fire-and-forget persistence for callers that must not await.
   *
   * Exactly ONE swallow layer, and it logs. The pattern these replace —
   * `try { op().catch(() => {}) } catch {}` scattered at six call sites,
   * some writing through SettingsOps, some through repo.setSetting — had an
   * unreachable outer shell (calling an async fn never throws synchronously)
   * stacked on a silent inner swallow, and bypassed this class, which exists
   * to own these keys.
   */
  static persistHistory(history: NavigationHistory): void {
    void NavigationOps.setHistory(history).catch((e) => {
      console.warn('[NavigationOps] Failed to persist navigation-history', e);
    });
  }

  static persistLastActiveChapter<T = any>(value: T): void {
    void NavigationOps.setLastActiveChapter(value).catch((e) => {
      console.warn('[NavigationOps] Failed to persist lastActiveChapter', e);
    });
  }
}
