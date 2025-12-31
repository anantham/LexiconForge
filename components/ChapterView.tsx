
import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import Loader from './Loader';
import { useTextSelection } from '../hooks/useTextSelection';
import { useFeedbackActions } from '../hooks/useFeedbackActions';
import { useAppStore } from '../store';
import AudioPlayer from './AudioPlayer';
import { TranslationPersistenceService } from '../services/translationPersistenceService';
import { debugLog } from '../utils/debug';
import { HtmlRepairService } from '../services/translate/HtmlRepairService';
import { useComparisonPortal } from '../hooks/useComparisonPortal';
import { DiffPip } from './diff/DiffPip';
import {
  DEFAULT_DIFF_MARKER_VISIBILITY,
  resolveMarkerVisibility,
} from './chapter/diffVisibility';
import ChapterSelectionOverlay from './chapter/ChapterSelectionOverlay';
import { useIsTouch } from '../hooks/useIsTouch';
import { useFootnoteNavigation } from '../hooks/useFootnoteNavigation';
import { useTokenizedContent } from '../hooks/useTokenizedContent';
import { useChapterTelemetry } from '../hooks/useChapterTelemetry';
import ReaderView from './chapter/ReaderView';

const ChapterView: React.FC = () => {
  const contentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const { selection, clearSelection } = useTextSelection(contentRef);
  const isTouch = useIsTouch();

  // Log selection state changes for comparison workflow
  useEffect(() => {
    if (selection) {
      debugLog('comparison', 'summary', '[ChapterView] Selection state updated', {
        text: selection.text.slice(0, 50) + (selection.text.length > 50 ? '...' : ''),
        textLength: selection.text.length,
        rectTop: selection.rect.top,
        rectLeft: selection.rect.left
      });
    }
    // Note: We don't log when selection is cleared to avoid noise
  }, [selection]);

  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  // <-- REFACTOR: Use new individual selectors
  const currentChapterId = useAppStore(s => s.currentChapterId);
  const chapters = useAppStore(s => s.chapters);
  const isLoading = useAppStore(s => s.isLoading);
  const viewMode = useAppStore(s => s.viewMode);
  const settings = useAppStore(s => s.settings);
  const activePromptTemplate = useAppStore(s => s.activePromptTemplate);
  const error = useAppStore(s => s.error);
  const handleToggleLanguage = useAppStore(s => s.setViewMode);
  const handleNavigate = useAppStore(s => s.handleNavigate);
  const handleRetranslateCurrent = useAppStore(s => s.handleRetranslateCurrent);
  const cancelTranslation = useAppStore(s => s.cancelTranslation);
  const isTranslationActive = useAppStore(s => s.isTranslationActive);
  const shouldEnableRetranslation = useAppStore(s => s.shouldEnableRetranslation);
  const imageGenerationMetrics = useAppStore(s => s.imageGenerationMetrics);
  const hydratingMap = useAppStore(s => s.hydratingChapters);
  const chapterAudioMap = useAppStore(s => s.chapterAudioMap);
  const showNotification = useAppStore(s => s.showNotification);
  const loadExistingImages = useAppStore(s => s.loadExistingImages);

  const editableContainerRef = useRef<HTMLDivElement>(null);
    const chapter = currentChapterId ? chapters.get(currentChapterId) : null;
  const translationResult = chapter?.translationResult;
  const feedbackForChapter = chapter?.feedback ?? [];
  const fanTranslation = (chapter as any)?.fanTranslation as string | undefined;
  const canCompare = viewMode === 'english' && !!fanTranslation;
  const translationInProgress = currentChapterId ? isTranslationActive(currentChapterId) : false;
  const isHydratingCurrent = currentChapterId ? !!hydratingMap[currentChapterId] : false;
  useChapterTelemetry({
    selection,
    currentChapterId,
    chapters,
    chapter,
    translationResult,
    isLoading,
    translationInProgress,
    isHydratingCurrent,
    viewMode,
    feedbackCount: feedbackForChapter.length,
  });

  const retranslateSettingsChanged = currentChapterId ? shouldEnableRetranslation(currentChapterId) : false;
  // Subscribe to activeTranslations state for reactive updates
  const activeTranslations = useAppStore(s => s.activeTranslations);
  const isRetranslationActive = currentChapterId ? (currentChapterId in activeTranslations || isTranslationActive(currentChapterId)) : false;
  const canManualRetranslate = !!translationResult;
  const targetLanguageLabel = settings.targetLanguage || 'English';
  const handleRetranslateClick = useCallback((origin: 'desktop' | 'mobile' = 'desktop') => {
    if (!currentChapterId) return;
    console.log(`🔘 [ChapterView] Retranslate button clicked (${origin}), chapterId:`, currentChapterId);
    const isActive = isTranslationActive(currentChapterId);
    console.log('🔘 [ChapterView] isTranslationActive result:', isActive);
    if (isActive) {
      console.log('🔴 [ChapterView] Cancelling translation');
      cancelTranslation(currentChapterId);
    } else {
      console.log('🟢 [ChapterView] Starting retranslation');
      handleRetranslateCurrent();
    }
  }, [currentChapterId, isTranslationActive, cancelTranslation, handleRetranslateCurrent]);
  const showUsageMetrics = Boolean(
    viewMode === 'english' &&
      translationResult?.usageMetrics &&
      !isLoading.fetching &&
      !translationInProgress &&
      !isHydratingCurrent
  );
  const showImageMetrics = Boolean(
    viewMode === 'english' &&
      imageGenerationMetrics &&
      !isLoading.fetching &&
      !translationInProgress &&
      !isHydratingCurrent
  );
  const showEnglishLoader = viewMode === 'english' && !translationResult && (translationInProgress || !error);

    // DIAGNOSTIC: Log chapter data when it changes
  useEffect(() => {
    if (chapter && translationResult) {
      debugLog('translation', 'full', '[ChapterView] Chapter Data Update', {
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        hasTranslation: !!translationResult,
        translationLength: translationResult.translation?.length || 0,
        footnotes: translationResult.footnotes?.length || 0,
        footnotesData: translationResult.footnotes,
        suggestedIllustrations: translationResult.suggestedIllustrations?.length || 0,
        illustrationsData: translationResult.suggestedIllustrations,
        viewMode
      });
    }
  }, [chapter?.id, translationResult, viewMode]);

  useEffect(() => {
    if (
      !currentChapterId ||
      typeof loadExistingImages !== 'function' ||
      !(translationResult?.suggestedIllustrations?.length)
    ) {
      return;
    }

    void loadExistingImages(currentChapterId).catch(error => {
      console.warn('[ChapterView] Failed to hydrate existing images:', error);
    });
  }, [currentChapterId, translationResult?.suggestedIllustrations?.length, loadExistingImages]);

  // Apply HTML repair on display (Option 3: belt and suspenders approach)
  // This repairs old translations immediately without retranslation
  // New translations are also repaired on save in translationService.ts
  const repairedTranslation = useMemo(() => {
    const rawTranslation = translationResult?.translation ?? '';
    if (!rawTranslation || !settings.enableHtmlRepair) {
      return rawTranslation;
    }

    const { html, stats } = HtmlRepairService.repair(rawTranslation, {
      enabled: true,
      verbose: false
    });

    if (stats.applied.length > 0) {
      debugLog('translation', 'summary', `[ChapterView] Applied ${stats.applied.length} display-time HTML repairs:`, stats.applied);
    }

    return html;
  }, [translationResult?.translation, settings.enableHtmlRepair]);

  const resolveChunkElement = useCallback((node: Node | null): HTMLElement | null => {
    if (!node) return null;
    if (node instanceof HTMLElement && node.dataset.lfChunk) return node;
    const baseElement = node instanceof HTMLElement ? node : (node as Text | null)?.parentElement;
    if (!baseElement) return null;
    const element = baseElement.closest('[data-lf-chunk]');
    return element as HTMLElement | null;
  }, []);

  const markerVisibilitySettings = useMemo(
    () => resolveMarkerVisibility(settings.diffMarkerVisibility),
    [settings.diffMarkerVisibility]
  );

  const {
    translationTokensData,
    inlineEditState,
    toolbarCoords,
    beginInlineEdit,
    toggleInlineNewVersion,
    saveInlineEdit,
    cancelInlineEdit,
    diffMarkersLoading,
    markersByPosition,
    handleDiffMarkerClick,
  } = useTokenizedContent({
    currentChapterId,
    chapterId: chapter?.id ?? null,
    viewMode,
    translationResult,
    activePromptTemplate,
    settings,
    showNotification,
    resolveChunkElement,
    editableContainerRef,
    markerVisibilitySettings,
    showDiffHeatmap: settings.showDiffHeatmap !== false,
  });

  const {
    comparisonChunk,
    comparisonLoading,
    comparisonError,
    showRawComparison,
    setShowRawComparison,
    comparisonExpanded,
    setComparisonExpanded,
    comparisonPortalNode,
    handleCompareRequest,
    dismissComparison,
  } = useComparisonPortal({
    currentChapterId,
    canCompare,
    translationResult,
    fanTranslation,
    chapterContent: chapter?.content ?? '',
    settings,
    showNotification,
    resolveChunkElement,
    repairedTranslation,
    contentRef,
    clearSelection,
  });

  const handleIllustrationRequest = useCallback((selection: string) => {
    debugLog('image', 'summary', '[ChapterView] handleIllustrationRequest called:', {
      currentChapterId,
      selectionLength: selection?.length
    });
    if (!currentChapterId) {
      console.warn('[ChapterView] handleIllustrationRequest: No currentChapterId - cannot generate illustration');
      showNotification('Cannot generate illustration: no chapter selected', 'warning');
      return;
    }
    useAppStore.getState().generateIllustrationForSelection(currentChapterId, selection);
  }, [currentChapterId, showNotification]);

  const { handleFeedbackSubmit, deleteFeedback, updateFeedbackComment } = useFeedbackActions({
    currentChapterId,
    handleIllustrationRequest,
    showNotification,
    clearSelection,
  });
  const handleScrollToText = (selectedText: string) => {
    if (!contentRef.current) return;
    const walker = document.createTreeWalker(contentRef.current, NodeFilter.SHOW_TEXT, null);
    let node;
    while (node = walker.nextNode()) {
      const textContent = node.textContent || '';
      const index = textContent.indexOf(selectedText);
      if (index !== -1) {
        const parentElement = node.parentElement;
        if (parentElement) {
          parentElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + selectedText.length);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
          setTimeout(() => selection?.removeAllRanges(), 2000);
          break;
        }
      }
    }
  };

  const displayTitle = useMemo(() => {
    if (viewMode === 'english' && translationResult?.translatedTitle) {
      return translationResult.translatedTitle;
    }
    return chapter?.title ?? '';
  }, [viewMode, chapter, translationResult]);

  const contentToDisplay = useMemo(() => {
    switch (viewMode) {
      case 'english':
        return translationResult?.translation ?? '';
      case 'fan':
        return (chapter as any)?.fanTranslation ?? '';
      case 'original':
      default:
        return chapter?.content ?? '';
    }
  }, [viewMode, chapter, translationResult]);

  

  const hasFanTranslation = useMemo(() => {
    return !!(chapter as any)?.fanTranslation;
  }, [chapter]);

  useFootnoteNavigation(viewRef, viewMode, currentChapterId);

  const headerProps = {
    title: displayTitle,
    fontStyle: settings.fontStyle,
    targetLanguageLabel,
    viewMode,
    hasFanTranslation,
    sourceUrl: chapter?.originalUrl,
    onToggleLanguage: handleToggleLanguage,
    onNavigatePrev: chapter?.prevUrl ? () => handleNavigate(chapter.prevUrl) : undefined,
    onNavigateNext: chapter?.nextUrl ? () => handleNavigate(chapter.nextUrl) : undefined,
    prevDisabled: !chapter?.prevUrl || isLoading.fetching,
    nextDisabled: !chapter?.nextUrl || isLoading.fetching,
    showRetranslateButton: viewMode === 'english',
    retranslateDisabled: !canManualRetranslate && !isRetranslationActive,
    isRetranslationActive,
    onRetranslateClick: () => handleRetranslateClick(),
  };

  const statusProps = {
    currentChapterId,
    viewMode,
    isLoading: isLoading.fetching,
    isTranslating: translationInProgress,
    canManualRetranslate,
    retranslateSettingsChanged,
    isRetranslationActive,
    providerLabel: settings.provider,
    modelLabel: settings.model,
    usageMetrics: translationResult?.usageMetrics ?? null,
    showUsageMetrics,
    imageMetrics: imageGenerationMetrics ?? null,
    showImageMetrics,
  };

  const bodyProps = {
    chapter,
    viewMode,
    translationResult,
    feedbackForChapter,
    selection,
    isTouch,
    inlineEditActive: Boolean(inlineEditState),
    canCompare,
    comparisonLoading,
    beginInlineEdit,
    handleCompareRequest,
    handleFeedbackSubmit,
    clearSelection,
    viewRef,
    chapterContentProps: {
      chapter,
      settings,
      isGlobalLoading: isLoading.fetching,
      isTranslating: translationInProgress,
      isHydrating: isHydratingCurrent,
      editableContainerRef,
      contentRef,
      isEditing,
      editedContent,
      onEditChange: setEditedContent,
      translationTokensData,
      markersByPosition,
      markerVisibilitySettings,
      diffMarkersLoading,
      onMarkerClick: handleDiffMarkerClick,
      inlineEditState,
      toolbarCoords,
      saveInlineEdit,
      cancelInlineEdit,
      toggleInlineNewVersion,
      contentToDisplay,
      providerLabel: settings.provider,
      modelLabel: settings.model,
      renderEnglishDiffs: viewMode === 'english',
      showEnglishLoader,
    },
    comparisonPortalProps: {
      comparisonChunk,
      comparisonPortalNode,
      comparisonExpanded,
      setComparisonExpanded,
      comparisonLoading,
      comparisonError,
      showRawComparison,
      setShowRawComparison,
      dismissComparison,
    },
    footerProps: {
      prevUrl: chapter?.prevUrl,
      nextUrl: chapter?.nextUrl,
      isLoading: isLoading.fetching,
      onNavigatePrev: () => chapter?.prevUrl && handleNavigate(chapter.prevUrl),
      onNavigateNext: () => chapter?.nextUrl && handleNavigate(chapter.nextUrl),
    },
    audioProps: {
      chapterId: currentChapterId || '',
      isVisible: !!currentChapterId && !!chapter,
    },
    onDeleteFeedback: deleteFeedback,
    onUpdateFeedback: updateFeedbackComment,
    onScrollToText: handleScrollToText,
  };

  return <ReaderView viewRef={viewRef} chapter={chapter} headerProps={headerProps} statusProps={statusProps} bodyProps={bodyProps} />;
};

export default ChapterView;
