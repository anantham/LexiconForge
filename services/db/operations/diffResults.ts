import type { DiffResult } from '../../diff/types';
import { STORE_NAMES } from '../core/schema';
import { withReadTxn, withWriteTxn, promisifyRequest } from '../core/txn';

const DOMAIN = 'diffResults';

export type StoredDiffResult = DiffResult & { fanVersionId: string };

const normalizeFanVersionId = (value: string | null | undefined): string =>
  value ?? '';

const mapFromStorage = (record?: DiffResult | null): DiffResult | null => {
  if (!record) return null;
  return {
    ...record,
    fanVersionId: record.fanVersionId === '' ? null : record.fanVersionId ?? null,
    aiHash: record.aiHash ?? null,
    fanHash: record.fanHash ?? null,
    rawHash: record.rawHash ?? record.rawVersionId,
  };
};

/** Normalizes a DiffResult for IndexedDB storage (null → '' for composite key fields) */
export const prepareForStorage = (record: DiffResult): StoredDiffResult => ({
  ...record,
  fanVersionId: normalizeFanVersionId(record.fanVersionId),
  aiHash: record.aiHash ?? null,
  fanHash: record.fanHash ?? null,
  rawHash: record.rawHash ?? record.rawVersionId,
});

export class DiffOps {
  static async save(result: DiffResult): Promise<void> {
    await withWriteTxn(
      STORE_NAMES.DIFF_RESULTS,
      async (_txn, stores) => {
        const store = stores[STORE_NAMES.DIFF_RESULTS];
        await promisifyRequest(store.put(prepareForStorage(result) as StoredDiffResult));
      },
      DOMAIN,
      'operations',
      'save'
    );
  }

  static async get(params: {
    chapterId: string;
    aiVersionId: string;
    fanVersionId: string | null;
    rawVersionId: string;
    algoVersion: string;
  }): Promise<DiffResult | null> {
    const { chapterId, aiVersionId, fanVersionId, rawVersionId, algoVersion } = params;
    return withReadTxn(
      STORE_NAMES.DIFF_RESULTS,
      async (_txn, stores) => {
        const store = stores[STORE_NAMES.DIFF_RESULTS];
        const key = [
          chapterId,
          aiVersionId,
          normalizeFanVersionId(fanVersionId),
          rawVersionId,
          algoVersion,
        ];
        const record = (await promisifyRequest(store.get(key))) as DiffResult | null;
        return mapFromStorage(record);
      },
      DOMAIN,
      'operations',
      'get'
    ).catch(() => null);
  }

  static async getByChapter(chapterId: string): Promise<DiffResult[]> {
    return withReadTxn(
      STORE_NAMES.DIFF_RESULTS,
      async (_txn, stores) => {
        const store = stores[STORE_NAMES.DIFF_RESULTS];
        const index = store.index('by_chapter');
        const records = (await promisifyRequest(index.getAll(chapterId))) as DiffResult[];
        return records
          .map(mapFromStorage)
          .filter((record): record is DiffResult => Boolean(record))
          .sort((a, b) => (b.analyzedAt || 0) - (a.analyzedAt || 0));
      },
      DOMAIN,
      'operations',
      'getByChapter'
    ).catch(() => []);
  }

  static async findByHashes(
    chapterId: string,
    aiHash: string | null,
    fanHash: string | null,
    rawHash: string,
    algoVersion: string
  ): Promise<DiffResult | null> {
    const candidates = await this.getByChapter(chapterId);
    return (
      candidates.find(candidate => {
        if (candidate.algoVersion !== algoVersion) return false;
        const candidateRawHash = candidate.rawHash ?? candidate.rawVersionId;
        const candidateFanHash = candidate.fanHash ?? null;
        const candidateAiHash = candidate.aiHash ?? null;
        return (
          candidateRawHash === rawHash &&
          candidateAiHash === (aiHash ?? null) &&
          candidateFanHash === (fanHash ?? null)
        );
      }) || null
    );
  }

  static async deleteByChapter(chapterId: string): Promise<void> {
    await withWriteTxn(
      STORE_NAMES.DIFF_RESULTS,
      async (_txn, stores) => {
        const store = stores[STORE_NAMES.DIFF_RESULTS];
        const index = store.index('by_chapter');
        const records = (await promisifyRequest(index.getAll(chapterId))) as DiffResult[];
        for (const record of records) {
          const key = [
            record.chapterId,
            record.aiVersionId,
            normalizeFanVersionId(record.fanVersionId),
            record.rawVersionId,
            record.algoVersion,
          ];
          await promisifyRequest(store.delete(key));
        }
      },
      DOMAIN,
      'operations',
      'deleteByChapter'
    );
  }

  static async getAll(): Promise<DiffResult[]> {
    try {
      return await withReadTxn(
        STORE_NAMES.DIFF_RESULTS,
        async (_txn, stores) => {
          const store = stores[STORE_NAMES.DIFF_RESULTS];
          const records = (await promisifyRequest(store.getAll())) as DiffResult[];
          return records
            .map(mapFromStorage)
            .filter((record): record is DiffResult => Boolean(record))
            .sort((a, b) => (b.analyzedAt || 0) - (a.analyzedAt || 0));
        },
        DOMAIN,
        'operations',
        'getAll'
      );
    } catch {
      return [];
    }
  }
}
