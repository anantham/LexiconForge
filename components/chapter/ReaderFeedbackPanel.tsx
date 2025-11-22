import React from 'react';
import FeedbackDisplay from '../FeedbackDisplay';
import type { FeedbackItem } from '../../types';

type ViewMode = 'original' | 'fan' | 'english';

interface ReaderFeedbackPanelProps {
  feedback: FeedbackItem[];
  viewMode: ViewMode;
  onDelete: (feedbackId: string) => void;
  onUpdate: (feedbackId: string, comment: string) => void;
  onScrollToText: (selection: string) => void;
}

const ReaderFeedbackPanel: React.FC<ReaderFeedbackPanelProps> = ({
  feedback,
  viewMode,
  onDelete,
  onUpdate,
  onScrollToText,
}) => {
  if (viewMode !== 'english' || feedback.length === 0) {
    return null;
  }

  return (
    <section className="mt-8" aria-label="Reader feedback section">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
        Reader Feedback
      </h3>
      <FeedbackDisplay
        feedback={feedback}
        onDelete={onDelete}
        onUpdate={onUpdate}
        onScrollToText={onScrollToText}
      />
    </section>
  );
};

export default ReaderFeedbackPanel;
