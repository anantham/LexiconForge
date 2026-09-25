import { useCallback } from 'react';
import type { FeedbackItem, SelectionFeedback } from '../types';
import { useAppStore } from '../store';

interface FeedbackSubmission extends Omit<FeedbackItem, 'id' | 'timestamp' | 'chapterId'> {}

interface UseFeedbackActionsDeps {
  currentChapterId: string | null;
  showNotification?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  handleIllustrationRequest: (selection: string) => void;
  clearSelection: () => void;
}

export const useFeedbackActions = ({
  currentChapterId,
  showNotification,
  handleIllustrationRequest,
  clearSelection,
}: UseFeedbackActionsDeps) => {
  const addFeedback = useAppStore((s) => s.addFeedback);
  const deleteFeedback = useAppStore((s) => s.deleteFeedback);
  const updateFeedbackComment = useAppStore((s) => s.updateFeedbackComment);

  const mapFeedbackTypeToCategory = useCallback((type?: FeedbackItem['type']): FeedbackSubmission['category'] => {
    switch (type) {
      case '👍':
        return 'positive';
      case '👎':
        return 'negative';
      case '?':
        return 'question';
      case '🎨':
        return 'illustration';
      default:
        return 'unknown';
    }
  }, []);

  const handleFeedbackSubmit = useCallback(
    (feedback: SelectionFeedback) => {
      if (!currentChapterId) return;
      if (feedback.type === '🎨') {
        handleIllustrationRequest(feedback.selection);
      } else {
        const submission: FeedbackSubmission = {
          type: feedback.type,
          selection: feedback.selection,
          comment: feedback.comment,
          text: feedback.selection,
          category: mapFeedbackTypeToCategory(feedback.type),
        };
        addFeedback(currentChapterId, submission);
      }
      clearSelection();
    },
    [currentChapterId, addFeedback, handleIllustrationRequest, clearSelection, mapFeedbackTypeToCategory]
  );

  return {
    handleFeedbackSubmit,
    deleteFeedback,
    updateFeedbackComment,
  };
};
