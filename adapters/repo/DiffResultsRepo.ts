import { indexedDBService } from '../../services/indexeddb';
import type { DiffResult } from '../../services/diff/types';

export class DiffResultsRepo {
  private readonly STORE_NAME = 'diffResults';

  private normalizeFanVersionId(value: string | null | undefined): string {
    return value ?? '';
  }

  private denormalizeFanVersionId(value: string | undefined): string | null {
    if (value === undefined) return null;
    return value === '' ? null : value;
  }

  private normalizeRecordForStorage(diffResult: DiffResult) {
    return {
      ...diffResult,
      fanVersionId: this.normalizeFanVersionId(diffResult.fanVersionId),
      aiHash: diffResult.aiHash ?? null,
      fanHash: diffResult.fanHash ?? null,
      rawHash: diffResult.rawHash ?? diffResult.rawVersionId,
    };
  }

  private normalizeRecordFromStorage(record: DiffResult | undefined | null): DiffResult | null {
    if (!record) return null;
    return {
      ...record,
      fanVersionId: this.denormalizeFanVersionId(record.fanVersionId ?? undefined),
      aiHash: record.aiHash ?? null,
      rawHash: record.rawHash ?? record.rawVersionId,
      fanHash: record.fanHash ?? null,
    };
  }

  /**
   * Save a diff result to IndexedDB
   */
  async save(diffResult: DiffResult): Promise<void> {
    const db = await indexedDBService.openDatabase();
    const record = this.normalizeRecordForStorage(diffResult);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retrieve a diff result by composite key
   */
  async get(
    chapterId: string,
    aiVersionId: string,
    fanVersionId: string | null,
    rawVersionId: string,
    algoVersion: string
  ): Promise<DiffResult | null> {
    const db = await indexedDBService.openDatabase();
    const normalizedFanId = this.normalizeFanVersionId(fanVersionId);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get([chapterId, aiVersionId, normalizedFanId, rawVersionId, algoVersion]);

      request.onsuccess = () => resolve(this.normalizeRecordFromStorage(request.result as DiffResult | null));
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all diff results for a chapter (sorted by analyzedAt desc)
   */
  async getByChapter(chapterId: string): Promise<DiffResult[]> {
    const db = await indexedDBService.openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('by_chapter');
      const request = index.getAll(chapterId);

      request.onsuccess = () => {
        const rawResults = (request.result as DiffResult[]) || [];
        const results = rawResults
          .map(r => this.normalizeRecordFromStorage(r))
          .filter((r): r is DiffResult => !!r);
        // Sort by analyzedAt descending
        results.sort((a, b) => b.analyzedAt - a.analyzedAt);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a specific diff result
   */
  async delete(
    chapterId: string,
    aiVersionId: string,
    fanVersionId: string | null,
    rawVersionId: string,
    algoVersion: string
  ): Promise<void> {
    const db = await indexedDBService.openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete([
        chapterId,
        aiVersionId,
        this.normalizeFanVersionId(fanVersionId),
        rawVersionId,
        algoVersion
      ]);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete all diff results for a chapter
   */
  async deleteByChapter(chapterId: string): Promise<void> {
    const results = await this.getByChapter(chapterId);
    const db = await indexedDBService.openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);

      let completed = 0;
      let errorOccurred = false;

      if (results.length === 0) {
        resolve();
        return;
      }

      results.forEach(r => {
        const request = store.delete([
          r.chapterId,
          r.aiVersionId,
          this.normalizeFanVersionId(r.fanVersionId),
          r.rawVersionId,
          r.algoVersion
        ]);

        request.onsuccess = () => {
          completed++;
          if (completed === results.length && !errorOccurred) {
            resolve();
          }
        };

        request.onerror = () => {
          if (!errorOccurred) {
            errorOccurred = true;
            reject(request.error);
          }
        };
      });
    });
  }

  /**
   * Find the most recent diff result matching hashes (fallback when IDs change)
   */
  async findByHashes(
    chapterId: string,
    aiHash: string,
    fanHash: string | null,
    rawHash: string,
    algoVersion: string
  ): Promise<DiffResult | null> {
    const candidates = await this.getByChapter(chapterId);
    return candidates.find(result => {
      if (result.algoVersion !== algoVersion) return false;

      const rawMatches = (result.rawHash ?? result.rawVersionId) === rawHash;
      if (!rawMatches) return false;

      // Require aiHash equality; if we never stored a hash we cannot trust this entry
      if (!result.aiHash) return false;
      if (result.aiHash !== aiHash) return false;

      // Fan hash must match when present on either side
      const expectedFanHash = fanHash ?? null;
      const candidateFanHash = result.fanHash ?? null;
      if (candidateFanHash !== expectedFanHash) return false;

      return true;
    }) || null;
  }
}
