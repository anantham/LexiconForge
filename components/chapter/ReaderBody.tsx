import React from 'react';
import ChapterContent from './ChapterContent';
import FootnotesPanel from './FootnotesPanel';
import ReaderFeedbackPanel from './ReaderFeedbackPanel';
import ChapterSelectionOverlay from './ChapterSelectionOverlay';
import ComparisonPortal from './ComparisonPortal';
import FooterNavigation from './FooterNavigation';
import AudioPlayer from '../AudioPlayer';
import { useAppStore } from '../../store';
import type { Chapter, FeedbackItem } from '../../types';

interface ReaderBodyProps {
  chapter: Chapter | null;
  viewMode: 'original' | 'fan' | 'english';
  translationResult: any;
  feedbackForChapter: FeedbackItem[];
  selection: { text: string; rect: DOMRect } | null;
  isTouch: boolean;
  inlineEditActive: boolean;
  canCompare: boolean;
  comparisonLoading: boolean;
  beginInlineEdit: () => void;
  handleCompareRequest: () => void;
  handleFeedbackSubmit: (feedback: { type: FeedbackItem['type']; selection: string }) => void;
  clearSelection: () => void;
  viewRef: React.RefObject<HTMLDivElement>;
  chapterContentProps: React.ComponentProps<typeof ChapterContent>;
  comparisonPortalProps: Omit<React.ComponentProps<typeof ComparisonPortal>, 'viewMode'>;
  footerProps: React.ComponentProps<typeof FooterNavigation>;
  audioProps: React.ComponentProps<typeof AudioPlayer>;
  onDeleteFeedback: (id: string) => void;
  onUpdateFeedback: (id: string, comment: string) => void;
  onScrollToText: (text: string) => void;
}

const ReaderBody: React.FC<ReaderBodyProps> = ({
  chapter,
  viewMode,
  translationResult,
  feedbackForChapter,
  selection,
  isTouch,
  inlineEditActive,
  canCompare,
  comparisonLoading,
  beginInlineEdit,
  handleCompareRequest,
  handleFeedbackSubmit,
  clearSelection,
  viewRef,
  chapterContentProps,
  comparisonPortalProps,
  footerProps,
  audioProps,
  onDeleteFeedback,
  onUpdateFeedback,
  onScrollToText,
}) => {
  const enableAudio = useAppStore((s) => s.settings.enableAudio ?? false);

  return (
    <>
      <ChapterContent {...chapterContentProps} />
      <FootnotesPanel
        chapterId={chapter?.id ?? null}
        footnotes={viewMode === 'english' ? translationResult?.footnotes : undefined}
      />
      <ReaderFeedbackPanel
        feedback={feedbackForChapter}
        viewMode={viewMode}
        onDelete={onDeleteFeedback}
        onUpdate={onUpdateFeedback}
        onScrollToText={onScrollToText}
      />
      <ChapterSelectionOverlay
        selection={selection}
        viewMode={viewMode}
        isTouch={isTouch}
        inlineEditActive={inlineEditActive}
        canCompare={canCompare}
        comparisonLoading={comparisonLoading}
        beginInlineEdit={beginInlineEdit}
        handleCompareRequest={handleCompareRequest}
        handleFeedbackSubmit={handleFeedbackSubmit}
        clearSelection={clearSelection}
        viewRef={viewRef}
      />
      <ComparisonPortal viewMode={viewMode} {...comparisonPortalProps} />
      {chapter && <FooterNavigation {...footerProps} />}
      {enableAudio && <AudioPlayer {...audioProps} />}
    </>
  );
};

export default ReaderBody;
