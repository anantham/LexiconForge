
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FeedbackItem, Footnote, UsageMetrics } from '../types';
import Loader from './Loader';
import { useTextSelection } from '../hooks/useTextSelection';
import FeedbackPopover from './FeedbackPopover';
import FeedbackDisplay from './FeedbackDisplay';
import RefreshIcon from './icons/RefreshIcon';
import { useAppStore } from '../store';
import Illustration from './Illustration';
import AudioPlayer from './AudioPlayer';

// Touch detection hook using media queries
function useIsTouch() {
  const [isTouch, setIsTouch] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(hover: none) and (pointer: coarse)');
    const on = (e: MediaQueryListEvent | MediaQueryList) =>
      setIsTouch('matches' in e ? e.matches : (e as MediaQueryList).matches);
    on(mq);
    mq.addEventListener?.('change', on as any);
    return () => mq.removeEventListener?.('change', on as any);
  }, []);
  return isTouch;
}

// Simple bottom sheet that never overlaps the OS selection bubble
const SelectionSheet: React.FC<{
  text: string;
  onReact: (emoji: '👍' | '❤️' | '😂' | '🎨') => void;
  onCopy: () => void;
  onClose: () => void;
}> = ({ onReact, onCopy, onClose }) => {
  // Trap contextmenu only while visible (prevents Android long-press menu)
  React.useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', block, { passive: false });
    return () => document.removeEventListener('contextmenu', block as any);
  }, []);

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-[70] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-xl rounded-t-2xl bg-gray-900/95 text-white shadow-2xl p-3">
        <div className="flex items-center gap-2">
          <button className="p-3 text-xl" onClick={() => onReact('👍')}>👍</button>
          <button className="p-3 text-xl" onClick={() => onReact('❤️')}>❤️</button>
          <button className="p-3 text-xl" onClick={() => onReact('😂')}>😂</button>
          <button className="p-3 text-xl" onClick={() => onReact('🎨')}>🎨</button>
          <div className="grow" />
          <button 
            className="px-3 py-2 rounded bg-white/10" 
            onClick={() => {
              navigator.vibrate?.(10);
              onCopy();
            }}
          >
            Copy
          </button>
          <button className="px-3 py-2 rounded bg-white/10" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const ChapterView: React.FC = () => {
  const contentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const { selection, clearSelection } = useTextSelection(contentRef);
  const isTouch = useIsTouch();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  // <-- REFACTOR: Use new individual selectors
  const currentChapterId = useAppStore(s => s.currentChapterId);
  const chapters = useAppStore(s => s.chapters);
  const isLoading = useAppStore(s => s.isLoading);
  const viewMode = useAppStore(s => s.viewMode);
  const settings = useAppStore(s => s.settings);
  const error = useAppStore(s => s.error);
  const handleToggleLanguage = useAppStore(s => s.setViewMode);
  const handleNavigate = useAppStore(s => s.handleNavigate);
  const addFeedback = useAppStore(s => s.addFeedback);
  const deleteFeedback = useAppStore(s => s.deleteFeedback);
  const updateFeedbackComment = useAppStore(s => s.updateFeedbackComment);
  const handleRetranslateCurrent = useAppStore(s => s.handleRetranslateCurrent);
  const cancelTranslation = useAppStore(s => s.cancelTranslation);
  const isTranslationActive = useAppStore(s => s.isTranslationActive);
  const shouldEnableRetranslation = useAppStore(s => s.shouldEnableRetranslation);
  const imageGenerationMetrics = useAppStore(s => s.imageGenerationMetrics);
  const hydratingMap = useAppStore(s => s.hydratingChapters);
  const chapterAudioMap = useAppStore(s => s.chapterAudioMap);

  const chapter = currentChapterId ? chapters.get(currentChapterId) : null;
  const translationResult = chapter?.translationResult;
  const feedbackForChapter = chapter?.feedback ?? [];

  // Debug logging for chapter loading
  React.useEffect(() => {
    const fanTranslation = (chapter as any)?.fanTranslation;
    const hasFanTranslation = !!fanTranslation;
    
    // Debug logging muted to reduce console noise during normal development.
    // To enable detailed logs, uncomment the block below.
    /*
    console.log('[ChapterView] State update:', {
      currentChapterId,
      hasChapter: !!chapter,
      chaptersMapSize: chapters.size,
      chapterTitle: chapter?.title,
      chapterContent: chapter?.content ? `${chapter.content.length} chars` : 'no content',
      hasTranslation: !!translationResult,
      hasFanTranslation,
      fanTranslationLength: fanTranslation ? `${fanTranslation.length} chars` : 'none',
      isLoading: isLoading,
      viewMode,
      error,
      // Content lengths by mode
      contentLengths: {
        original: chapter?.content?.length || 0,
        fan: fanTranslation?.length || 0,
        english: translationResult?.translation?.length || 0
      }
    });
    */
    
    // Log fan translation status specifically
    if (chapter) {
      if (hasFanTranslation) {
        // Fan translation exists; keep quiet unless debugging is required.
        // console.log(`[ChapterView] ✅ Fan translation found: ${fanTranslation.length} characters`);
      } else {
        // console.log(`[ChapterView] ❌ No fan translation for chapter: ${chapter.title}`);
      }
    }
    
    if (currentChapterId && !chapter) {
      // Lightweight UI guard: suppress noisy error while chapter is being hydrated from cache.
      // The `hydratingChapters` map is set by IDB loader to indicate in-flight hydration.
      const isHydrating = !!hydratingMap?.[currentChapterId];
      if (isHydrating) {
        // Keep a low-verbosity debug entry so we can enable it during deeper diagnostics.
        // console.debug('[ChapterView] Waiting for chapter hydration:', { currentChapterId });
      } else {
        console.error('[ChapterView] Chapter ID exists but chapter not found in map:', {
          currentChapterId,
          availableChapterIds: Array.from(chapters.keys()).slice(0, 10) // First 10 IDs
        });
      }
    }
  }, [currentChapterId, chapter, chapters, translationResult, isLoading, viewMode, error]);

  const handleFeedbackSubmit = (feedback: Omit<FeedbackItem, 'id'>) => {
    if (!currentChapterId) return;
    if (feedback.type === '🎨') {
      // Call a new handler for illustration requests
      handleIllustrationRequest(feedback.selection);
    } else {
      addFeedback(currentChapterId, feedback);
    }
    clearSelection();
  };

  const handleIllustrationRequest = (selection: string) => {
    if (!currentChapterId) return;
    // This will be a new action in the store
    useAppStore.getState().generateIllustrationForSelection(currentChapterId, selection);
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
    if (!text) return [];
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
      return <Loader text="Fetching chapter raws..." />;
    }
    if (!chapter) {
      return (
        <div className="text-center py-10 text-gray-500 dark:text-gray-400">
          <h2 className="text-2xl font-bold mb-2">Welcome!</h2>
          <p>Enter a web novel chapter URL above to get started.</p>
        </div>
      );
    }

    const currentChapterTranslating = currentChapterId ? isTranslationActive(currentChapterId) : false;
    const isHydrating = currentChapterId ? !!hydratingMap[currentChapterId] : false;
    
    if (viewMode === 'english' && currentChapterTranslating && !translationResult) {
      return <Loader text={`Translating with ${settings.provider}${settings.model ? ' — ' + settings.model : ''}...`} />;
    }

    if (viewMode === 'english' && !translationResult && !error) {
      return <Loader text={`Translating with ${settings.provider}${settings.model ? ' — ' + settings.model : ''}...`} />;
    }

    // Only show cache hydration spinner when not actively translating
    if (isHydrating && !currentChapterTranslating) {
      return <Loader text="Loading chapter from cache..." />;
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
  
  const shouldShowPopover = viewMode === 'english' && selection && !isTouch;
  const shouldShowSheet = viewMode === 'english' && selection && isTouch;
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

  const MetricsDisplay = ({ metrics }: { metrics: UsageMetrics }) => {
    // Format actual parameters that were sent to API
    const formatParams = (params?: UsageMetrics['actualParams']) => {
      if (!params || Object.keys(params).length === 0) return '';
      
      const paramStrings = [];
      if (params.temperature !== undefined) paramStrings.push(`temp=${params.temperature}`);
      if (params.topP !== undefined) paramStrings.push(`top_p=${params.topP}`);
      if (params.frequencyPenalty !== undefined) paramStrings.push(`freq_pen=${params.frequencyPenalty}`);
      if (params.presencePenalty !== undefined) paramStrings.push(`pres_pen=${params.presencePenalty}`);
      if (params.seed !== undefined && params.seed !== null) paramStrings.push(`seed=${params.seed}`);
      
      return paramStrings.length > 0 ? ` [${paramStrings.join(', ')}]` : '';
    };
    
    return (
      <div className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
        Translated in {metrics.requestTime.toFixed(2)}s with <span className="font-semibold">{metrics.model}</span>{formatParams(metrics.actualParams)} (~${metrics.estimatedCost.toFixed(5)})
      </div>
    );
  };

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

          {/* Desktop: Single row layout */}
          <div className="hidden md:flex justify-between items-center">
            <button
                onClick={() => chapter.prevUrl && handleNavigate(chapter.prevUrl)}
                disabled={!chapter.prevUrl || isLoading.fetching}
                className="px-5 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                &larr; Previous
            </button>
            
            <div className="flex justify-center items-center gap-4 ml-6">
              {chapter?.originalUrl && (
                <a 
                  href={chapter.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline font-semibold text-gray-600 dark:text-gray-300"
                  title="View original source"
                >
                  Source:
                </a>
              )}
              <span className="font-semibold text-gray-600 dark:text-gray-300">Language:</span>
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
                  {settings.targetLanguage || 'English'}
                </button>
              </div>
              {viewMode === 'english' && (
                <button
                  onClick={() => {
                    if (!currentChapterId) return;
                    if (isTranslationActive(currentChapterId)) {
                      cancelTranslation(currentChapterId);
                    } else {
                      handleRetranslateCurrent();
                    }
                  }}
                  disabled={!shouldEnableRetranslation(currentChapterId || '') && !(currentChapterId && isTranslationActive(currentChapterId))}
                  className={`p-2 rounded-full border transition-all duration-200 ml-4 ${
                    currentChapterId && isTranslationActive(currentChapterId)
                      ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/40'
                      : shouldEnableRetranslation(currentChapterId || '')
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300'
                      : 'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  }`}
                  title={currentChapterId && isTranslationActive(currentChapterId) ? 'Cancel translation' : 'Retranslate chapter'}
                >
                  <RefreshIcon className={`w-5 h-5 ${currentChapterId && isTranslationActive(currentChapterId) ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            <div className="flex items-center justify-end">
              <button
                  onClick={() => chapter.nextUrl && handleNavigate(chapter.nextUrl)}
                  disabled={!chapter.nextUrl || isLoading.fetching}
                  className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 disabled:cursor-not-allowed transition"
                >
                  Next &rarr;
              </button>
            </div>
          </div>

          {/* Mobile: Two row layout */}
          <div className="md:hidden space-y-3">
            {/* Row 1: Prev/Next navigation */}
            <div className="flex justify-between items-center">
              <button
                  onClick={() => chapter.prevUrl && handleNavigate(chapter.prevUrl)}
                  disabled={!chapter.prevUrl || isLoading.fetching}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
                >
                  &larr; Prev
              </button>

              <button
                  onClick={() => chapter.nextUrl && handleNavigate(chapter.nextUrl)}
                  disabled={!chapter.nextUrl || isLoading.fetching}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 disabled:cursor-not-allowed transition text-sm"
                >
                  Next &rarr;
              </button>
            </div>

            {/* Row 2: Language toggle and retranslate */}
            <div className="flex justify-center items-center gap-3">
              <div className="relative inline-flex items-center p-1 bg-gray-200 dark:bg-gray-700 rounded-full">
                <button
                  onClick={() => handleToggleLanguage('original')}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${viewMode === 'original' ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow' : 'text-gray-600 dark:text-gray-400'}`}
                >
                  Original
                </button>
                {hasFanTranslation && (
                  <button
                    onClick={() => handleToggleLanguage('fan')}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${viewMode === 'fan' ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow' : 'text-gray-600 dark:text-gray-400'}`}
                  >
                    Fan
                  </button>
                )}
                <button
                  onClick={() => handleToggleLanguage('english')}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${viewMode === 'english' ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow' : 'text-gray-600 dark:text-gray-400'}`}
                >
                  {settings.targetLanguage || 'English'}
                </button>
              </div>
              
              {viewMode === 'english' && (
                <button
                  onClick={() => {
                    if (!currentChapterId) return;
                    if (isTranslationActive(currentChapterId)) {
                      cancelTranslation(currentChapterId);
                    } else {
                      handleRetranslateCurrent();
                    }
                  }}
                  disabled={!shouldEnableRetranslation(currentChapterId || '') && !(currentChapterId && isTranslationActive(currentChapterId))}
                  className={`p-2 rounded-full border transition-all duration-200 ${
                    currentChapterId && isTranslationActive(currentChapterId)
                      ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/40'
                      : shouldEnableRetranslation(currentChapterId || '')
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300'
                      : 'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  }`}
                  title={currentChapterId && isTranslationActive(currentChapterId) ? 'Cancel translation' : 'Retranslate chapter'}
                >
                  <RefreshIcon className={`w-4 h-4 ${currentChapterId && isTranslationActive(currentChapterId) ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          </div>
          {currentChapterId && isTranslationActive(currentChapterId) && (
            <div className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
              Translating: <span className="font-semibold">{settings.provider}</span>{settings.model ? ` — ${settings.model}` : ''}
            </div>
          )}
          {viewMode === 'english' && translationResult?.usageMetrics && !isLoading.fetching && !(currentChapterId ? isTranslationActive(currentChapterId) : false) && !(currentChapterId ? !!hydratingMap[currentChapterId] : false) && (
            <MetricsDisplay metrics={translationResult.usageMetrics} />
          )}
          {viewMode === 'english' && imageGenerationMetrics && !isLoading.fetching && !(currentChapterId ? isTranslationActive(currentChapterId) : false) && !(currentChapterId ? !!hydratingMap[currentChapterId] : false) && (
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
                  onDelete={(id) => deleteFeedback(id)}
                  onUpdate={(id, comment) => updateFeedbackComment(id, comment)}
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

      {shouldShowSheet && (
        <SelectionSheet
          text={selection.text}
          onReact={(emoji) => handleFeedbackSubmit({ type: emoji, selection: selection.text })}
          onCopy={async () => { 
            try { 
              await navigator.clipboard.writeText(selection.text); 
            } catch {} 
          }}
          onClose={() => clearSelection()}
        />
      )}

      {chapter && (
        <footer className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <NavigationControls />
        </footer>
      )}
      
      {/* Audio Player Section */}
      <AudioPlayer 
        chapterId={currentChapterId || ''} 
        isVisible={!!currentChapterId && !!chapter} 
      />
    </div>
  );
};

export default ChapterView;
