import type { ChapterRecord, UrlMappingRecord } from '../types';
import { normalizeUrlAggressively, generateStableChapterId } from '../../stableIdService';
import { STORE_NAMES } from './schema';
import { withReadTxn, withWriteTxn, promisifyRequest } from './txn';

/**
 * StableIdManager — unified stable ID handling with migration-friendly fallbacks.
 *
 * Canonical format: underscore-based IDs from generateStableChapterId(), e.g. ch163_abcd1234_wxyz
 * Legacy/backfill format: hyphen-based IDs, e.g. ch-163-abcd1234-wxyz (tolerated during migration)
 */
export class StableIdManager {
  private static readonly DOMAIN = 'stableIds';

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
    const nowIso = new Date().toISOString();

    const upsert = async (store: IDBObjectStore, url: string, isCanonical: boolean) => {
      const existing = (await promisifyRequest(store.get(url))) as UrlMappingRecord | undefined;
      const record: UrlMappingRecord = {
        url,
        stableId,
        isCanonical,
        dateAdded: existing?.dateAdded ?? nowIso,
      };
      await promisifyRequest(store.put(record as any));
    };

    await withWriteTxn(
      STORE_NAMES.URL_MAPPINGS,
      async (_txn, stores) => {
        const store = stores[STORE_NAMES.URL_MAPPINGS];
        await upsert(store, canonical, true);
        if (canonical !== chapterUrl) {
          await upsert(store, chapterUrl, false);
        }
      },
      this.DOMAIN,
      'core',
      'ensureUrlMappings'
    ).catch(error => {
      console.warn('[StableIdManager] ensureUrlMappings failed', {
        chapterUrl,
        stableId,
        error: (error as Error)?.message ?? String(error),
      });
    });
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
    const chapter = await this.getChapterByStableId(stableId);
    if (chapter?.url) {
      const url = chapter.url;
      await this.ensureUrlMappings(url, stableId);
      return url;
    }

    // 4) Try variant in chapters as last resort
    const ch2 = await this.getChapterByStableId(undersc);
    if (ch2?.url) {
      const url = ch2.url;
      await this.ensureUrlMappings(url, undersc);
      return url;
    }

    throw new Error(`StableId not found: ${stableId}`);
  }

  private static async lookupUrlByStableId(id: string): Promise<string | null> {
    return withReadTxn(
      STORE_NAMES.URL_MAPPINGS,
      async (_txn, stores) => {
        const store = stores[STORE_NAMES.URL_MAPPINGS];
        let record: UrlMappingRecord | undefined;

        if (store.indexNames.contains('stableId')) {
          const idx = store.index('stableId');
          record = (await promisifyRequest(idx.get(id))) as UrlMappingRecord | undefined;
        } else {
          const rows = (await promisifyRequest(store.getAll())) as UrlMappingRecord[];
          record = rows.find(row => row.stableId === id);
        }

        return record?.url ?? null;
      },
      this.DOMAIN,
      'core',
      'lookupUrlByStableId'
    ).catch(() => null);
  }

  private static async getChapterByStableId(stableId: string): Promise<ChapterRecord | null> {
    return withReadTxn(
      STORE_NAMES.CHAPTERS,
      async (_txn, stores) => {
        const store = stores[STORE_NAMES.CHAPTERS];
        if (store.indexNames.contains('stableId')) {
          const index = store.index('stableId');
          const record = (await promisifyRequest(index.get(stableId))) as ChapterRecord | undefined;
          return record || null;
        }

        const rows = (await promisifyRequest(store.getAll())) as ChapterRecord[];
        return rows.find(row => row.stableId === stableId) || null;
      },
      this.DOMAIN,
      'core',
      'getChapterByStableId'
    ).catch(() => null);
  }
}
