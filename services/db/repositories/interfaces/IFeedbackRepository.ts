import type { FeedbackItem } from '../../../../types';
import type { FeedbackRecord } from '../../types';

export interface IFeedbackRepository {
  storeFeedback(chapterUrl: string, feedback: FeedbackItem, translationId?: string): Promise<void>;
  getFeedbackByChapter(chapterUrl: string): Promise<FeedbackRecord[]>;
  updateFeedbackComment(feedbackId: string, comment: string): Promise<void>;
  deleteFeedback(feedbackId: string): Promise<void>;
  getAllFeedback(): Promise<FeedbackRecord[]>;
}
