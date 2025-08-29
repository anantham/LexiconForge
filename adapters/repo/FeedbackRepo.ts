import { indexedDBService } from '../../services/indexeddb';
import type { FeedbackItem } from '../../types';

export interface FeedbackRepo {
  storeFeedback(chapterUrl: string, feedback: FeedbackItem, translationId?: string): Promise<void>;
  getFeedback(chapterUrl: string): Promise<any[]>;
  getAllFeedback(): Promise<any[]>;
}

export const feedbackRepo: FeedbackRepo = {
  storeFeedback: (chapterUrl, feedback, translationId) => 
    indexedDBService.storeFeedback(chapterUrl, feedback, translationId),
  getFeedback: (chapterUrl) => indexedDBService.getFeedback(chapterUrl),
  getAllFeedback: () => indexedDBService.getAllFeedback(),
};