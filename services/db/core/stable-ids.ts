import { indexedDBService } from '../../indexeddb';
import { normalizeUrlAggressively, generateStableChapterId } from '../../stableIdService';

/**
 * StableIdManager — unified stable ID handling with migration-friendly fallbacks.
 *
 * Canonical format: underscore-based IDs from generateStableChapterId(), e.g. ch163_abcd1234_wxyz
 * Legacy/backfill format: hyphen-based IDs, e.g. ch-163-abcd1234-wxyz (tolerated during migration)
 */
export class StableIdManager {
  /**
   * Generate canonical underscore-format stable ID
   */
  static generate(content: string, chapterNumber: number, title: string): string {
    return generateStableChapterId(content, chapterNumber, title);
  }

  /**
   * Ensure URL mappings exist for both canonical and raw URLs.
   * If chapterUrl differs from canonical, writes both mappings.
   */
  static async ensureUrlMappings(chapterUrl: string, stableId: string): Promise<void> {
    const canonical = normalizeUrlAggressively(chapterUrl) || chapterUrl;
    try {
      // Minimal import payload that only writes URL mappings
      const payload = {
        novels: new Map(),
        chapters: new Map(),
        urlIndex: new Map<string, string>([[canonical, stableId]]),
        rawUrlIndex: canonical === chapterUrl ? new Map() : new Map<string, string>([[chapterUrl, stableId]]),
        currentChapterId: null as any,
        navigationHistory: [] as string[],
      };
      await indexedDBService.importStableSessionData(payload as any);
    } catch (e) {
      console.warn('[StableIdManager] ensureUrlMappings failed', { chapterUrl, stableId, error: (e as any)?.message });
    }
  }

  /**
   * Resolve a URL for a given stableId with tolerant fallbacks and auto-repair.
   */
  static async getUrlForStableId(stableId: string): Promise<string> {
    // 1) Try mapping by exact ID
    const mapping = await this.lookupUrlByStableId(stableId);
    if (mapping) return mapping;

    // 2) Try hyphen/underscore variants for migration compatibility
    const hyphen = stableId.replace(/_/g, '-');
    const undersc = stableId.replace(/-/g, '_');

    const alt1 = await this.lookupUrlByStableId(hyphen);
    if (alt1) {
      // Auto-repair: write correct mapping with canonical format
      await this.ensureUrlMappings(alt1, undersc);
      return alt1;
    }

    const alt2 = await this.lookupUrlByStableId(undersc);
    if (alt2) {
      await this.ensureUrlMappings(alt2, undersc);
      return alt2;
    }

    // 3) Fallback search in chapters
    const chapter = await indexedDBService.getChapterByStableId(stableId)
      .catch(() => null);
    if (chapter?.url) {
      const url = chapter.url;
      await this.ensureUrlMappings(url, stableId);
      return url;
    }

    // 4) Try variant in chapters as last resort
    const ch2 = await indexedDBService.getChapterByStableId(undersc).catch(() => null);
    if (ch2?.url) {
      const url = ch2.url;
      await this.ensureUrlMappings(url, undersc);
      return url;
    }

    throw new Error(`StableId not found: ${stableId}`);
  }

  private static async lookupUrlByStableId(id: string): Promise<string | null> {
    try {
      const all = await indexedDBService.getAllUrlMappings();
      const row = all.find(r => r.stableId === id);
      return row?.url || null;
    } catch {
      return null;
    }
  }
}

