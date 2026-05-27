import React, { useState, useCallback } from 'react';
import ChapterContent from './ChapterContent';
import FootnotesPanel from './FootnotesPanel';
import ReaderFeedbackPanel from './ReaderFeedbackPanel';
import InlineCommentMarkers from './InlineCommentMarkers';
import ChapterSelectionOverlay from './ChapterSelectionOverlay';
import ComparisonPortal from './ComparisonPortal';
import FooterNavigation from './FooterNavigation';
import InterleavedReader from './InterleavedReader';
import AudioPlayer from '../AudioPlayer';
import { useAppStore } from '../../store';
import { alignWords } from '../../services/wordAlignment';
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
  handleFeedbackSubmit: (feedback: { type: FeedbackItem['type']; selection: string; comment?: string }) => void;
  clearSelection: () => void;
  viewRef: React.RefObject<HTMLDivElement>;
  chapterContentProps: React.ComponentProps<typeof ChapterContent>;
  comparisonPortalProps: Omit<React.ComponentProps<typeof ComparisonPortal>, 'viewMode'>;
  footerProps: React.ComponentProps<typeof FooterNavigation>;
  audioProps: React.ComponentProps<typeof AudioPlayer>;
  onDeleteFeedback: (id: string) => void;
  onUpdateFeedback: (id: string, comment: string) => void;
  onScrollToText: (text: string) => void;
  onSelfInsert?: () => void;
  enableSillyTavern?: boolean;
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
  onSelfInsert,
  enableSillyTavern,
}) => {
  const enableAudio = useAppStore((s) => s.settings.enableAudio ?? false);
  const showInlineComments = useAppStore((s) => s.settings.showInlineComments ?? true);
  // Issue #15 wire-up — opt-in via settings flag.
  const enableInterleavedView = useAppStore((s) => s.settings.enableInterleavedView ?? false);
  const settings = useAppStore((s) => s.settings);
  const updateChapter = useAppStore((s) => (s as any).updateChapter);
  const [computingAlignment, setComputingAlignment] = useState(false);

  // Issue #15 — trigger word alignment via Phase 1 service. Persisted on
  // chapter via store action; cached forever per (chapterId, translationVersionId).
  const handleRequestAlignment = useCallback(async () => {
    if (!chapter || !translationResult?.translation || computingAlignment) return;
    setComputingAlignment(true);
    try {
      const alignment = await alignWords({
        source: chapter.content,
        target: translationResult.translation,
        sourceLang: chapter.sourceLanguage || 'auto',
        targetLang: chapter.targetLanguage || 'en',
        settings,
        translationVersionId: translationResult?.id ?? null,
      });
      if (chapter.id && updateChapter) {
        updateChapter(chapter.id, { wordAlignment: alignment });
      }
    } catch (err) {
      console.warn('[ReaderBody] Word alignment failed (non-fatal):', err);
    } finally {
      setComputingAlignment(false);
    }
  }, [chapter, translationResult, settings, updateChapter, computingAlignment]);

  // The interleaved view replaces ChapterContent's English render only when:
  //   1. opt-in flag is on
  //   2. user is viewing english (alignment is source↔target, original/fan don't apply)
  //   3. translation exists
  const showInterleaved = enableInterleavedView && viewMode === 'english' && !!translationResult?.translation;

  return (
    <>
      <div className="relative">
        {showInterleaved ? (
          <InterleavedReader
            source={chapter?.content || ''}
            target={translationResult.translation}
            alignment={chapter?.wordAlignment ?? null}
            glossary={settings.glossary}
            sourceLang={chapter?.sourceLanguage || undefined}
            targetLang={chapter?.targetLanguage || 'en'}
            apiKeys={{
              deepl: settings.deeplApiKey,
              google: settings.googleTranslateApiKey,
            }}
            onRequestAlignment={handleRequestAlignment}
            isComputingAlignment={computingAlignment}
          />
        ) : (
          <ChapterContent {...chapterContentProps} />
        )}
        {!showInterleaved && showInlineComments && viewMode === 'english' && feedbackForChapter.length > 0 && (
          // key forces remount on translation-version switch so positions
          // recompute against the new DOM. See issues/16-version-switch-comments-vanish/.
          // The feedback ref alone doesn't change on setActiveTranslationVersion,
          // so InlineCommentMarkers' useCallback deps wouldn't fire its effect.
          <InlineCommentMarkers
            key={translationResult?.id ?? translationResult?.version ?? 'default'}
            feedback={feedbackForChapter}
            contentRef={chapterContentProps.contentRef}
            onScrollToText={onScrollToText}
          />
        )}
      </div>
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
        onSelfInsert={onSelfInsert}
        enableSillyTavern={enableSillyTavern}
      />
      <ComparisonPortal viewMode={viewMode} {...comparisonPortalProps} />
      {chapter && <FooterNavigation {...footerProps} />}
      {enableAudio && <AudioPlayer {...audioProps} />}
    </>
  );
};

export default ReaderBody;
