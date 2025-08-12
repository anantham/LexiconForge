
import React, { useRef, useMemo } from 'react';
import { FeedbackItem, Footnote, UsageMetrics } from '../types';
import Loader from './Loader';
import { useTextSelection } from '../hooks/useTextSelection';
import FeedbackPopover from './FeedbackPopover';
import FeedbackDisplay from './FeedbackDisplay';
import RefreshIcon from './icons/RefreshIcon';
import useAppStore from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';


const ChapterView: React.FC = () => {
  const contentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const { selection, clearSelection } = useTextSelection(contentRef);
  
  const {
    currentUrl,
    sessionData,
    isLoading,
    showEnglish,
    settings,
    feedbackHistory,
    isDirty,
    handleToggleLanguage,
    handleNavigate,
    addFeedback,
    deleteFeedback,
    updateFeedbackComment,
    handleRetranslateCurrent,
    isUrlTranslating
  } = useAppStore(useShallow(state => ({
    currentUrl: state.currentUrl,
    sessionData: state.sessionData,
    isLoading: state.isLoading,
    showEnglish: state.showEnglish,
    settings: state.settings,
    feedbackHistory: state.feedbackHistory,
    isDirty: state.isDirty,
    handleToggleLanguage: state.handleToggleLanguage,
    handleNavigate: state.handleNavigate,
    addFeedback: state.addFeedback,
    deleteFeedback: state.deleteFeedback,
    updateFeedbackComment: state.updateFeedbackComment,
    handleRetranslateCurrent: state.handleRetranslateCurrent,
    isUrlTranslating: state.isUrlTranslating,
  })));
  
  const chapter = currentUrl ? sessionData[currentUrl]?.chapter : null;
  const translationResult = currentUrl ? sessionData[currentUrl]?.translationResult : null;
  const feedbackForChapter = (currentUrl && feedbackHistory[currentUrl]) ? feedbackHistory[currentUrl] : [];

  const handleFeedbackSubmit = (feedback: Omit<FeedbackItem, 'id'>) => {
    addFeedback(feedback);
    clearSelection();
  };

  const displayTitle = useMemo(() => {
    if (showEnglish && translationResult?.translatedTitle) {
      return translationResult.translatedTitle;
    }
    return chapter?.title ?? '';
  }, [showEnglish, chapter, translationResult]);

  const contentToDisplay = useMemo(() => {
    if (showEnglish) {
      return translationResult?.translation ?? '';
    }
    return chapter?.content ?? '';
  }, [showEnglish, chapter, translationResult]);

  const renderFootnotes = (footnotes: Footnote[] | undefined) => {
    if (!footnotes || footnotes.length === 0) return null;
    return (
        <div className="mt-12 pt-6 border-t border-gray-300 dark:border-gray-600">
            <h3 className="text-lg font-bold mb-4 font-sans">Notes</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm">
                {footnotes.map((note) => (
                    <li key={note.marker} id={`footnote-def-${note.marker}`} className="text-gray-600 dark:text-gray-400">
                       {note.text} <a href={`#footnote-ref-${note.marker}`} className="text-blue-500 hover:underline">↑</a>
                    </li>
                ))}
            </ol>
        </div>
    );
  }
  
  const parseAndRender = (text: string): React.ReactNode[] => {
    const parts = text.split(/(\[\d+\]|<i>.*?<\/i>|<b>.*?<\/b>|\*.*?\*)/g).filter(Boolean);

    return parts.map((part, index) => {
      // Footnote
      const footnoteMatch = part.match(/^\[(\d+)\]$/);
      if (footnoteMatch) {
        const marker = footnoteMatch[1];
        return (
          <sup key={index} id={`footnote-ref-${marker}`} className="font-sans">
            <a href={`#footnote-def-${marker}`} className="text-blue-500 hover:underline no-underline">[{marker}]</a>
          </sup>
        );
      }
      // Italic
      if (part.startsWith('<i>') && part.endsWith('</i>')) {
        return <i key={index}>{parseAndRender(part.slice(3, -4))}</i>;
      }
      // Bold
      if (part.startsWith('<b>') && part.endsWith('</b>')) {
        return <b key={index}>{parseAndRender(part.slice(3, -4))}</b>;
      }
      // Markdown italic (legacy)
      if (part.startsWith('*') && part.endsWith('*')) {
        return <i key={index}>{parseAndRender(part.slice(1, -1))}</i>;
      }
      return part;
    });
  };

  const renderContent = () => {
    if (isLoading.fetching) {
      return <Loader text="Fetching chapter..." />;
    }
    if (!chapter) {
      return (
        <div className="text-center py-10 text-gray-500 dark:text-gray-400">
          <h2 className="text-2xl font-bold mb-2">Welcome!</h2>
          <p>Enter a web novel chapter URL above to get started.</p>
        </div>
      );
    }

    // Check if THIS specific URL is being translated
    const currentUrlTranslating = currentUrl ? isUrlTranslating(currentUrl) : false;
    
    if (showEnglish && currentUrlTranslating && !translationResult) {
      return <Loader text={`Translating with ${settings.provider}...`} />;
    }

    // If we have cached translation result, show it even if other chapters are translating
    if (showEnglish && !translationResult) {
      return <Loader text={`Translating with ${settings.provider}...`} />;
    }
    
    return (
       <div 
         ref={contentRef} 
         className={`prose prose-lg dark:prose-invert max-w-none whitespace-pre-wrap ${settings.fontStyle === 'serif' ? 'font-serif' : 'font-sans'}`}
         style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
        >
         {showEnglish ? parseAndRender(contentToDisplay) : contentToDisplay}
       </div>
    )
  };
  
  const shouldShowPopover = showEnglish && selection;

  const NavigationControls = () => chapter && (
    <div className="flex justify-between items-center w-full">
        <button
            onClick={() => chapter.prevUrl && handleNavigate(chapter.prevUrl)}
            disabled={!chapter.prevUrl || isLoading.fetching}
            className="px-5 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            &larr; Previous
        </button>
        <button
            onClick={() => chapter.nextUrl && handleNavigate(chapter.nextUrl)}
            disabled={!chapter.nextUrl || isLoading.fetching}
            className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 disabled:cursor-not-allowed transition"
        >
            Next &rarr;
        </button>
    </div>
  );

  const MetricsDisplay = ({ metrics }: { metrics: UsageMetrics }) => (
    <div className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
      Translated in {metrics.requestTime.toFixed(2)}s with <span className="font-semibold">{metrics.model}</span> (~${metrics.estimatedCost.toFixed(5)})
    </div>
  );

  return (
    <div ref={viewRef} className="relative w-full max-w-4xl mx-auto mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8">
      {chapter && (
        <header className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
          <h1 className={`text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 text-center ${settings.fontStyle === 'serif' ? 'font-serif' : 'font-sans'}`}>
            {displayTitle}
          </h1>

          {/* Top Navigation */}
          <div className="flex justify-between items-center">
            <button
                onClick={() => chapter.prevUrl && handleNavigate(chapter.prevUrl)}
                disabled={!chapter.prevUrl || isLoading.fetching}
                className="px-5 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                &larr; Previous
            </button>
            
            <div className="flex justify-center items-center gap-4">
              <span className="font-semibold text-gray-600 dark:text-gray-300 hidden sm:inline">Language:</span>
              <div className="relative inline-flex items-center p-1 bg-gray-200 dark:bg-gray-700 rounded-full">
                <button
                  onClick={() => handleToggleLanguage(false)}
                  className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${!showEnglish ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow' : 'text-gray-600 dark:text-gray-400'}`}
                >
                  Original
                </button>
                <button
                  onClick={() => handleToggleLanguage(true)}
                  className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${showEnglish ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow' : 'text-gray-600 dark:text-gray-400'}`}
                >
                  English
                </button>
              </div>
              {showEnglish && (
                <button
                  onClick={handleRetranslateCurrent}
                  disabled={!isDirty || (currentUrl ? isUrlTranslating(currentUrl) : false)}
                  className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition"
                  title="Re-translate with new feedback"
                >
                  <RefreshIcon className="w-5 h-5" />
                </button>
              )}
            </div>

            <button
                onClick={() => chapter.nextUrl && handleNavigate(chapter.nextUrl)}
                disabled={!chapter.nextUrl || isLoading.fetching}
                className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 disabled:cursor-not-allowed transition"
              >
                Next &rarr;
            </button>
          </div>
          {showEnglish && translationResult?.usageMetrics && (
            <MetricsDisplay metrics={translationResult.usageMetrics} />
          )}
        </header>
      )}

      <div className="min-h-[400px]">
        {renderContent()}
        {showEnglish && renderFootnotes(translationResult?.footnotes)}
        {showEnglish && feedbackForChapter.length > 0 && (
            <FeedbackDisplay 
                feedback={feedbackForChapter}
                onDelete={deleteFeedback}
                onUpdate={updateFeedbackComment}
            />
        )}
      </div>

      {shouldShowPopover && (
        <FeedbackPopover
          selectionText={selection.text}
          position={selection.rect}
          positioningParentRef={viewRef}
          onFeedback={handleFeedbackSubmit}
        />
      )}

      {chapter && (
        <footer className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <NavigationControls />
        </footer>
      )}
    </div>
  );
};

export default ChapterView;