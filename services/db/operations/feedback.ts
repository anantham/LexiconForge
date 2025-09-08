import { indexedDBService } from '../../indexeddb';
import type { FeedbackItem } from '../../../types';

export class FeedbackOps {
  static async store(chapterUrl: string, feedback: FeedbackItem, translationId?: string) {
    return indexedDBService.storeFeedback(chapterUrl, feedback, translationId);
  }
  static async get(chapterUrl: string) {
    return indexedDBService.getFeedback(chapterUrl);
  }
  static async getAll() {
    return indexedDBService.getAllFeedback();
  }
}
