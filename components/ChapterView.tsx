
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { FeedbackItem, Footnote, UsageMetrics } from '../types';
import Loader from './Loader';
import { useTextSelection } from '../hooks/useTextSelection';
import FeedbackPopover from './FeedbackPopover';
import FeedbackDisplay from './FeedbackDisplay';
import RefreshIcon from './icons/RefreshIcon';
import useAppStore from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import Illustration from './Illustration';

const ChapterView: React.FC = () => {
  const contentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const { selection, clearSelection } = useTextSelection(contentRef);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  const {
    currentChapterId,
    chapters,
    isLoading,
    viewMode,
    settings,
    error,
    handleToggleLanguage,
    handleNavigate,
    addFeedback,
    deleteFeedback,
    updateFeedbackComment,
    handleRetranslateCurrent,
    cancelTranslation,
    isChapterLoading,
    isChapterTranslating,
    shouldEnableRetranslation,
    hasTranslationSettingsChanged,
    imageGenerationMetrics,
  } = useAppStore(useShallow(state => ({
    currentChapterId: state.currentChapterId,
    chapters: state.chapters,
    isLoading: state.isLoading,
    viewMode: state.viewMode,
    settings: state.settings,
    error: state.error,
    handleToggleLanguage: state.handleToggleLanguage,
    handleNavigate: state.handleNavigate,
    addFeedback: state.addFeedback,
    deleteFeedback: state.deleteFeedback,
    updateFeedbackComment: state.updateFeedbackComment,
    handleRetranslateCurrent: state.handleRetranslateCurrent,
    cancelTranslation: state.cancelTranslation,
    isChapterLoading: state.isChapterLoading,
    isChapterTranslating: state.isChapterTranslating,
    shouldEnableRetranslation: state.shouldEnableRetranslation,
    hasTranslationSettingsChanged: state.hasTranslationSettingsChanged,
    imageGenerationMetrics: state.imageGenerationMetrics,
  })));

  const chapter = currentChapterId ? chapters.get(currentChapterId) : null;
  const translationResult = chapter?.translationResult;
  const feedbackForChapter = chapter?.feedback ?? [];

  const handleFeedbackSubmit = (feedback: Omit<FeedbackItem, 'id'>) => {
    if (!currentChapterId) return;
    addFeedback(currentChapterId, feedback);
    clearSelection();
  };

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

  const renderFootnotes = (footnotes: Footnote[] | undefined) => {
    if (!footnotes || footnotes.length === 0) return null;
    return (
        <div className="mt-12 pt-6 border-t border-gray-300 dark:border-gray-600">
            <h3 className="text-lg font-bold mb-4 font-sans">Notes</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm">
                {footnotes.map((note) => {
                    // Normalize marker to match inline refs which use digits-only (e.g., [1] -> 1)
                    const raw = String(note.marker ?? '');
                    const normalizedMarker = raw.replace(/^\[|\]$/g, '');
                    return (
                      <li key={raw} id={`footnote-def-${normalizedMarker}`} className="text-gray-600 dark:text-gray-400">
                        {parseAndRender(note.text)}{' '}
                        <a href={`#footnote-ref-${normalizedMarker}`} className="text-blue-500 hover:underline">↑</a>
                      </li>
                    );
                })}
            </ol>
        </div>
    );
  }
  
  const parseAndRender = (text: string): React.ReactNode[] => {
    const parts = text.split(/(\[\d+\]|<i>[\s\S]*?<\/i>|<b>[\s\S]*?<\/b>|\*[\s\S]*?\*|\[ILLUSTRATION-\d+\]|<br\s*\/?>)/g).filter(Boolean);

    return parts.map((part, index) => {
      const illustrationMatch = part.match(/^(\[ILLUSTRATION-\d+\])$/);
      if (illustrationMatch) {
        return <Illustration key={index} marker={illustrationMatch[1]} />;
      }

      const footnoteMatch = part.match(/^\[(\d+)\]$/);
      if (footnoteMatch) {
        const marker = footnoteMatch[1];
        return (
          <sup key={index} id={`footnote-ref-${marker}`} className="font-sans">
            <a href={`#footnote-def-${marker}`} className="text-blue-500 hover:underline no-underline">[{marker}]</a>
          </sup>
        );
      }
      if (part.startsWith('<i>') && part.endsWith('</i>')) {
        return <i key={index}>{parseAndRender(part.slice(3, -4))}</i>;
      }
      if (part.startsWith('<b>') && part.endsWith('</b>')) {
        return <b key={index}>{parseAndRender(part.slice(3, -4))}</b>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <i key={index}>{parseAndRender(part.slice(1, -1))}</i>;
      }
      if (part.match(/^<br\s*\/?>$/)) {
        return <br key={index} />;
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

    const currentChapterTranslating = currentChapterId ? isChapterTranslating(currentChapterId) : false;
    
    if (viewMode === 'english' && currentChapterTranslating && !translationResult) {
      return <Loader text={`Translating with ${settings.provider}...`} />;
    }

    if (viewMode === 'english' && !translationResult && !error) {
      return <Loader text={`Translating with ${settings.provider}...`} />;
    }
    
    return (
       <div className="relative">
         {isEditing ? (
           <textarea
             value={editedContent}
             onChange={(e) => setEditedContent(e.target.value)}
             className={`w-full min-h-[400px] p-4 border border-blue-300 dark:border-blue-600 rounded-lg bg-blue-50 dark:bg-blue-900/20 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 ${settings.fontStyle === 'serif' ? 'font-serif' : 'font-sans'}`}
             style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
             placeholder="Edit the translation..."
             autoFocus
           />
         ) : (
           <div 
             ref={contentRef} 
             className={`prose prose-lg dark:prose-invert max-w-none whitespace-pre-wrap ${settings.fontStyle === 'serif' ? 'font-serif' : 'font-sans'}`}
             style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
           >
             {viewMode === 'english' ? parseAndRender(contentToDisplay) : contentToDisplay}
           </div>
         )}
       </div>
    )
  };
  
  const shouldShowPopover = viewMode === 'english' && selection;
  // Version selector moved to SessionInfo top bar

  // Footnote navigation within the reader container
  useEffect(() => {
    const container = viewRef.current;
    if (!container) return;

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a') as HTMLAnchorElement | null;
      const href = anchor?.getAttribute('href') || '';
      if (anchor && href.startsWith('#footnote-')) {
        e.preventDefault();
        const id = href.slice(1);
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
          try { history.replaceState(null, '', `#${id}`); } catch {}
        }
      }
    };

    container.addEventListener('click', onClick);
    return () => container.removeEventListener('click', onClick);
  }, [viewRef, viewMode, currentChapterId]);

  // Handle hash navigation (e.g., when hash already set or on back navigation)
  useEffect(() => {
    const handleHash = () => {
      const hash = typeof location !== 'undefined' ? location.hash : '';
      if (hash && hash.startsWith('#footnote-')) {
        const id = hash.slice(1);
        const el = document.getElementById(id);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
      }
    };
    window.addEventListener('hashchange', handleHash);
    // Run once on mount or when chapter changes
    handleHash();
    return () => window.removeEventListener('hashchange', handleHash);
  }, [currentChapterId, viewMode]);

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

  const ImageMetricsDisplay = ({ metrics }: { metrics: { count: number; totalTime: number; totalCost: number; lastModel?: string } }) => (
    <div className="text-xs text-center text-gray-500 dark:text-gray-400 mt-1">
      Generated {metrics.count} images{metrics.lastModel ? ` with ${metrics.lastModel}` : ''} in {metrics.totalTime.toFixed(2)}s (~${metrics.totalCost.toFixed(5)})
    </div>
  );

  return (
    <div ref={viewRef} className="relative w-full max-w-4xl mx-auto mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8">
      {chapter && (
        <header className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
          <h1 className={`text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 text-center ${settings.fontStyle === 'serif' ? 'font-serif' : 'font-sans'}`}>
            {displayTitle}
          </h1>

          <div className="flex justify-between items-center">
            <button
                onClick={() => chapter.prevUrl && handleNavigate(chapter.prevUrl)}
                disabled={!chapter.prevUrl || isLoading.fetching}
                className="px-5 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                &larr; Previous
            </button>
            
            <div className="flex justify-center items-center gap-4">
              {chapter?.originalUrl && (
                <a 
                  href={chapter.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline font-semibold text-gray-600 dark:text-gray-300 hidden sm:inline"
                  title="View original source"
                >
                  Source:
                </a>
              )}
              <span className="font-semibold text-gray-600 dark:text-gray-300 hidden sm:inline">Language:</span>
              <div className="relative inline-flex items-center p-1 bg-gray-200 dark:bg-gray-700 rounded-full">
                <button
                  onClick={() => handleToggleLanguage('original')}
                  className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${viewMode === 'original' ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow' : 'text-gray-600 dark:text-gray-400'}`}
                >
                  Original
                </button>
                {hasFanTranslation && (
                  <button
                    onClick={() => handleToggleLanguage('fan')}
                    className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${viewMode === 'fan' ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow' : 'text-gray-600 dark:text-gray-400'}`}
                  >
                    Fan
                  </button>
                )}
                <button
                  onClick={() => handleToggleLanguage('english')}
                  className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${viewMode === 'english' ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow' : 'text-gray-600 dark:text-gray-400'}`}
                >
                  English
                </button>
              </div>
              {viewMode === 'english' && (
                <button
                  onClick={() => {
                    if (!currentChapterId) return;
                    if (isChapterTranslating(currentChapterId)) {
                      cancelTranslation(currentChapterId);
                    } else {
                      handleRetranslateCurrent();
                    }
                  }}
                  disabled={!shouldEnableRetranslation(currentChapterId || '') && !(currentChapterId && isChapterTranslating(currentChapterId))}
                  className={`p-2 rounded-full border transition-all duration-200 ${
                    currentChapterId && isChapterTranslating(currentChapterId)
                      ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/40'
                      : shouldEnableRetranslation(currentChapterId || '')
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300'
                      : 'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  }`}
                  title={currentChapterId && isChapterTranslating(currentChapterId) ? 'Cancel translation' : 'Retranslate chapter'}
                >
                  <RefreshIcon className={`w-5 h-5 ${currentChapterId && isChapterTranslating(currentChapterId) ? 'animate-spin' : ''}`} />
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
          {viewMode === 'english' && translationResult?.usageMetrics && (
            <MetricsDisplay metrics={translationResult.usageMetrics} />
          )}
          {viewMode === 'english' && imageGenerationMetrics && (
            <ImageMetricsDisplay metrics={imageGenerationMetrics} />
          )}
        </header>
      )}

      <div className="min-h-[400px]">
        {renderContent()}
        {viewMode === 'english' && renderFootnotes(translationResult?.footnotes)}
        {viewMode === 'english' && feedbackForChapter.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Reader Feedback
              </h3>
              <FeedbackDisplay 
                  feedback={feedbackForChapter}
                  onDelete={(id) => currentChapterId && deleteFeedback(currentChapterId, id)}
                  onUpdate={(id, comment) => currentChapterId && updateFeedbackComment(currentChapterId, id, comment)}
                  onScrollToText={handleScrollToText}
              />
            </div>
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
