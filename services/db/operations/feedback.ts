import type { FeedbackItem } from '../../../types';
import type { FeedbackRecord } from '../types';
import { feedbackRepository } from '../repositories/instances';

const FEEDBACK_TYPE_MAP: Record<string, '👍' | '👎' | '?'> = {
  positive: '👍',
  negative: '👎',
  suggestion: '?',
};

/**
 * Convert a FeedbackRecord (IDB shape) to a FeedbackItem (in-memory shape).
 * Used by `loadChapterFromIDB` to populate `chapter.feedback` on hydration,
 * and by `translationService` for context-building. The translationService
 * has its own private copy of this logic (pre-2026-05-04); a future cleanup
 * pass should consolidate.
 */
export const feedbackRecordToItem = (record: FeedbackRecord): FeedbackItem => ({
  id: record.id,
  text: record.comment,
  category: record.type,
  timestamp: new Date(record.createdAt).getTime(),
  chapterId: record.chapterUrl,
  selection: record.selection,
  type: FEEDBACK_TYPE_MAP[record.type] ?? '?',
  comment: record.comment,
});

export class FeedbackOps {
  static async store(chapterUrl: string, feedback: FeedbackItem, translationId?: string) {
    return feedbackRepository.storeFeedback(chapterUrl, feedback, translationId);
  }
  static async get(chapterUrl: string) {
    return feedbackRepository.getFeedbackByChapter(chapterUrl);
  }
  static async getAll() {
    return feedbackRepository.getAllFeedback();
  }
}
