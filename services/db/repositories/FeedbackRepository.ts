import type { FeedbackItem } from '../../../types';
import {
  promisifyRequest,
  runTransaction,
  type TransactionMode,
} from '../core/txn';
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

  private async withStore<T>(
    mode: TransactionMode,
    operationName: string,
    fn: (store: IDBObjectStore) => Promise<T> | T
  ): Promise<T> {
    const db = await this.deps.getDb();
    const storeName = this.deps.stores.FEEDBACK;
    return runTransaction(
      db,
      storeName,
      mode,
      (_transaction, stores) => fn(stores[storeName]),
      'feedback',
      'FeedbackRepository',
      operationName
    );
  }

  async storeFeedback(
    chapterUrl: string,
    feedback: FeedbackItem,
    translationId?: string
  ): Promise<void> {
    const legacyFeedback = feedback as FeedbackItem & {
      createdAt?: string | number | Date;
    };
    const record: FeedbackRecord = {
      id: feedback.id || generateId(),
      chapterUrl,
      translationId,
      type: mapEmojiToFeedbackType(feedback.type),
      selection: feedback.selection ?? '',
      comment: feedback.comment ?? '',
      createdAt: legacyFeedback.createdAt
        ? new Date(legacyFeedback.createdAt).toISOString()
        : new Date().toISOString(),
    };

    await this.withStore('readwrite', 'storeFeedback', async store => {
      await promisifyRequest(store.put(record));
    });
  }

  async getFeedbackByChapter(chapterUrl: string): Promise<FeedbackRecord[]> {
    return this.withStore('readonly', 'getFeedbackByChapter', async store => {
      const index = store.index('chapterUrl');
      const items = await promisifyRequest<FeedbackRecord[]>(
        index.getAll(IDBKeyRange.only(chapterUrl))
      );
      return items.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }

  async updateFeedbackComment(feedbackId: string, comment: string): Promise<void> {
    await this.withStore('readwrite', 'updateFeedbackComment', async store => {
      const record = await promisifyRequest<FeedbackRecord | undefined>(
        store.get(feedbackId)
      );
      if (!record) return;

      await promisifyRequest(store.put({ ...record, comment }));
    });
  }

  async deleteFeedback(feedbackId: string): Promise<void> {
    await this.withStore('readwrite', 'deleteFeedback', async store => {
      await promisifyRequest(store.delete(feedbackId));
    });
  }

  async getAllFeedback(): Promise<FeedbackRecord[]> {
    return this.withStore('readonly', 'getAllFeedback', async store => {
      return promisifyRequest<FeedbackRecord[]>(store.getAll());
    });
  }
}
