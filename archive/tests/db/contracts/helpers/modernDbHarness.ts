import 'fake-indexeddb/auto';
import type { Chapter } from '../../../../types';
import { ChapterOps } from '../../../../services/db/operations';
import { DB_NAME, resetConnection } from '../../../../services/db/core/connection';

const deleteModernDb = async (): Promise<void> => {
  await new Promise<void>(resolve => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
};

export const resetModernDb = async (): Promise<void> => {
  resetConnection();
  await deleteModernDb();
};

export const storeChapterForTest = async (chapter: Chapter): Promise<void> => {
  const normalized: Chapter = {
    ...chapter,
    originalUrl: chapter.originalUrl ?? chapter.url,
  };
  await ChapterOps.store(normalized);
};
