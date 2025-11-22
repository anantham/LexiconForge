import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import type { FeedbackItem } from '../../../types';
import { FeedbackRepository } from '../../../services/db/repositories/FeedbackRepository';

const DB_NAME = 'feedback-repo-test';
const FEEDBACK_STORE = 'feedback';

const baseFeedback: FeedbackItem = {
  id: 'feedback-1',
  text: 'Great translation!',
  category: 'general',
  timestamp: Date.now(),
  chapterId: 'chapter-1',
  selection: 'Foo bar',
  type: '👍',
  comment: 'Loved it',
};

let db: IDBDatabase;
let repo: FeedbackRepository;

const openTestDb = async (): Promise<IDBDatabase> => {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const upgradeDb = request.result;
      if (!upgradeDb.objectStoreNames.contains(FEEDBACK_STORE)) {
        const store = upgradeDb.createObjectStore(FEEDBACK_STORE, { keyPath: 'id' });
        store.createIndex('chapterUrl', 'chapterUrl', { unique: false });
        store.createIndex('translationId', 'translationId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const deleteDb = async () =>
  new Promise<void>(resolve => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });

beforeEach(async () => {
  await deleteDb();
  db = await openTestDb();
  repo = new FeedbackRepository({
    getDb: () => Promise.resolve(db),
    stores: { FEEDBACK: FEEDBACK_STORE },
  });
});

afterEach(async () => {
  db.close();
  await deleteDb();
});

describe('FeedbackRepository', () => {
  it('stores and retrieves feedback sorted by createdAt', async () => {
    await repo.storeFeedback('chapter-1', baseFeedback, 'translation-1');
    await repo.storeFeedback('chapter-1', { ...baseFeedback, id: 'feedback-2', comment: 'Second' }, 'translation-1');

    const results = await repo.getFeedbackByChapter('chapter-1');
    expect(results).toHaveLength(2);
    expect(results[0].type).toBe('positive');
    expect(results[0].comment).toBeDefined();
  });

  it('updates feedback comments', async () => {
    await repo.storeFeedback('chapter-2', baseFeedback, undefined);
    await repo.updateFeedbackComment(baseFeedback.id, 'Updated comment');
    const results = await repo.getFeedbackByChapter('chapter-2');
    expect(results[0].comment).toBe('Updated comment');
  });

  it('deletes feedback entries and lists all feedback', async () => {
    await repo.storeFeedback('chapter-3', baseFeedback, undefined);
    await repo.storeFeedback('chapter-4', { ...baseFeedback, id: 'feedback-3', chapterId: 'chapter-4' }, undefined);

    let all = await repo.getAllFeedback();
    expect(all).toHaveLength(2);

    await repo.deleteFeedback(baseFeedback.id);
    all = await repo.getAllFeedback();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('feedback-3');
  });
});
