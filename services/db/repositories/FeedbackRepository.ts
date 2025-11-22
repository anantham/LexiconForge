import type { FeedbackItem } from '../../../types';
import type { FeedbackRecord } from '../types';
import type { IFeedbackRepository } from './interfaces/IFeedbackRepository';

interface FeedbackRepositoryDeps {
  getDb: () => Promise<IDBDatabase>;
  stores: {
    FEEDBACK: string;
  };
}

const generateId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const mapEmojiToFeedbackType = (
  emoji?: FeedbackItem['type']
): FeedbackRecord['type'] => {
  switch (emoji) {
    case '👍':
      return 'positive';
    case '👎':
      return 'negative';
    case '?':
    case '🎨':
    default:
      return 'suggestion';
  }
};

export class FeedbackRepository implements IFeedbackRepository {
  constructor(private readonly deps: FeedbackRepositoryDeps) {}

  private async runOnStore<T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => Promise<T> | T
  ): Promise<T> {
    const db = await this.deps.getDb();
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction([this.deps.stores.FEEDBACK], mode);
      const store = tx.objectStore(this.deps.stores.FEEDBACK);
      Promise.resolve(fn(store))
        .then(resolve)
        .catch(reject);
      tx.onerror = () => reject(tx.error);
    });
  }

  async storeFeedback(chapterUrl: string, feedback: FeedbackItem, translationId?: string): Promise<void> {
    const record: FeedbackRecord = {
      id: (feedback as any).id || generateId(),
      chapterUrl,
      translationId,
      type: mapEmojiToFeedbackType(feedback.type),
      selection: feedback.selection ?? '',
      comment: feedback.comment ?? '',
      createdAt:
        (feedback as any).createdAt
          ? new Date((feedback as any).createdAt).toISOString()
          : new Date().toISOString(),
    };

    await this.runOnStore('readwrite', async store => {
      await new Promise<void>((resolve, reject) => {
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  }

  async getFeedbackByChapter(chapterUrl: string): Promise<FeedbackRecord[]> {
    return this.runOnStore('readonly', store => {
      const index = store.index('chapterUrl');
      return new Promise<FeedbackRecord[]>((resolve, reject) => {
        const req = index.getAll(IDBKeyRange.only(chapterUrl));
        req.onsuccess = () => {
          const items = (req.result as FeedbackRecord[] | undefined) ?? [];
          resolve(
            items.sort(
              (a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            )
          );
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  async updateFeedbackComment(feedbackId: string, comment: string): Promise<void> {
    await this.runOnStore('readwrite', async store => {
      await new Promise<void>((resolve, reject) => {
        const req = store.get(feedbackId);
        req.onsuccess = () => {
          const record = req.result as FeedbackRecord | undefined;
          if (!record) {
            resolve();
            return;
          }
          record.comment = comment;
          const putReq = store.put(record);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  async deleteFeedback(feedbackId: string): Promise<void> {
    await this.runOnStore('readwrite', async store => {
      await new Promise<void>((resolve, reject) => {
        const req = store.delete(feedbackId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  }

  async getAllFeedback(): Promise<FeedbackRecord[]> {
    return this.runOnStore('readonly', store => {
      return new Promise<FeedbackRecord[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve((req.result as FeedbackRecord[]) || []);
        req.onerror = () => reject(req.error);
      });
    });
  }
}
