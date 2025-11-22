import type { NovelRecord, UrlMappingRecord } from '../types';
import { normalizeUrlAggressively } from '../../stableIdService';
import { STORE_NAMES } from '../core/schema';
import { withReadTxn, promisifyRequest } from '../core/txn';

const DOMAIN = 'mappings';

const mapBoolean = <T extends UrlMappingRecord>(record: T | undefined | null): UrlMappingRecord | null => {
  if (!record) return null;
  return { ...record, isCanonical: Boolean(record.isCanonical) };
};

export class MappingsOps {
  static async getStableIdByUrl(url: string): Promise<string | null> {
    const stableId = await this.getUrlMappingForUrl(url).then(record => record?.stableId);
    if (stableId) return stableId;

    const normalized = normalizeUrlAggressively(url);
    if (!normalized || normalized === url) return null;
    return this.getUrlMappingForUrl(normalized).then(record => record?.stableId ?? null);
  }

  static async getUrlMappingForUrl(url: string): Promise<UrlMappingRecord | null> {
    try {
      return await withReadTxn(
        STORE_NAMES.URL_MAPPINGS,
        async (_txn, stores) => {
          const store = stores[STORE_NAMES.URL_MAPPINGS];
          const record = (await promisifyRequest(store.get(url))) as UrlMappingRecord | undefined;
          return mapBoolean(record);
        },
        DOMAIN,
        'operations',
        'getUrlMappingForUrl'
      );
    } catch {
      return null;
    }
  }

  static async getUrlByStableId(stableId: string): Promise<string | null> {
    try {
      return await withReadTxn(
        STORE_NAMES.URL_MAPPINGS,
        async (_txn, stores) => {
          const store = stores[STORE_NAMES.URL_MAPPINGS];
          let record: UrlMappingRecord | undefined;

          if (store.indexNames.contains('stableId')) {
            const index = store.index('stableId');
            record = (await promisifyRequest(index.get(stableId))) as UrlMappingRecord | undefined;
          } else {
            const rows = (await promisifyRequest(store.getAll())) as UrlMappingRecord[];
            record = rows.find(row => row.stableId === stableId);
          }

          return record?.url ?? null;
        },
        DOMAIN,
        'operations',
        'getUrlByStableId'
      );
    } catch {
      return null;
    }
  }

  static async getAllUrlMappings(): Promise<UrlMappingRecord[]> {
    try {
      return await withReadTxn(
        STORE_NAMES.URL_MAPPINGS,
        async (_txn, stores) => {
          const store = stores[STORE_NAMES.URL_MAPPINGS];
          const rows = (await promisifyRequest(store.getAll())) as UrlMappingRecord[];
          return rows.map(row => ({ ...row, isCanonical: Boolean(row.isCanonical) }));
        },
        DOMAIN,
        'operations',
        'getAllUrlMappings'
      );
    } catch {
      return [];
    }
  }

  static async getAllNovels(): Promise<NovelRecord[]> {
    try {
      return await withReadTxn(
        STORE_NAMES.NOVELS,
        async (_txn, stores) => {
          const store = stores[STORE_NAMES.NOVELS];
          return (await promisifyRequest(store.getAll())) as NovelRecord[];
        },
        DOMAIN,
        'operations',
        'getAllNovels'
      );
    } catch {
      return [];
    }
  }
}
