import { indexedDBService } from '../../services/indexeddb';
import type { DiffResult } from '../../services/diff/types';

export class DiffResultsRepo {
  private readonly STORE_NAME = 'diffResults';

  /**
   * Save a diff result to IndexedDB
   */
  async save(diffResult: DiffResult): Promise<void> {
    const db = await indexedDBService.openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put(diffResult);

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

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get([chapterId, aiVersionId, fanVersionId, rawVersionId, algoVersion]);

      request.onsuccess = () => resolve(request.result || null);
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
        const results = (request.result as DiffResult[]) || [];
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
      const request = store.delete([chapterId, aiVersionId, fanVersionId, rawVersionId, algoVersion]);

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
        const request = store.delete([r.chapterId, r.aiVersionId, r.fanVersionId, r.rawVersionId, r.algoVersion]);

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
}
