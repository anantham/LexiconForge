import type { FeedbackItem } from '../../../types';
import { feedbackRepository } from '../repositories/instances';

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
