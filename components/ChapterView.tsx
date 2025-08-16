
import React, { useRef, useMemo, useState } from 'react';
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
  const [showAllVersionFeedback, setShowAllVersionFeedback] = useState(false);
  
  const {
    currentUrl,
    sessionData,
    isLoading,
    showEnglish,
    settings,
    feedbackHistory,
    versionFeedback,
    isDirty,
    error,
    handleToggleLanguage,
    handleNavigate,
    addFeedback,
    deleteFeedback,
    updateFeedbackComment,
    handleRetranslateCurrent,
    isUrlTranslating,
    shouldEnableRetranslation,
    hasTranslationSettingsChanged,
    switchTranslationVersion,
    deleteTranslationVersion,
    loadTranslationVersions,
    generatedImages,
    imageGenerationMetrics
  } = useAppStore(useShallow(state => ({
    currentUrl: state.currentUrl,
    sessionData: state.sessionData,
    isLoading: state.isLoading,
    showEnglish: state.showEnglish,
    settings: state.settings,
    feedbackHistory: state.feedbackHistory,
    versionFeedback: state.versionFeedback,
    isDirty: state.isDirty,
    error: state.error,
    handleToggleLanguage: state.handleToggleLanguage,
    handleNavigate: state.handleNavigate,
    addFeedback: state.addFeedback,
    deleteFeedback: state.deleteFeedback,
    updateFeedbackComment: state.updateFeedbackComment,
    handleRetranslateCurrent: state.handleRetranslateCurrent,
    isUrlTranslating: state.isUrlTranslating,
    shouldEnableRetranslation: state.shouldEnableRetranslation,
    hasTranslationSettingsChanged: state.hasTranslationSettingsChanged,
    switchTranslationVersion: state.switchTranslationVersion,
    deleteTranslationVersion: state.deleteTranslationVersion,
    loadTranslationVersions: state.loadTranslationVersions,
    generatedImages: state.generatedImages,
    imageGenerationMetrics: state.imageGenerationMetrics,
  })));
  
  const chapter = currentUrl ? sessionData[currentUrl]?.chapter : null;
  const translationResult = currentUrl ? sessionData[currentUrl]?.translationResult : null;
  const availableVersions = currentUrl ? sessionData[currentUrl]?.availableVersions || [] : [];
  const activeVersion = currentUrl ? sessionData[currentUrl]?.activeVersion : null;
  
  // Get version-specific feedback or all feedback based on toggle
  const feedbackForChapter = useMemo(() => {
    if (!currentUrl) return [];
    
    if (showAllVersionFeedback) {
      // Show all feedback from all versions
      const allFeedback: FeedbackItem[] = [];
      
      // Add legacy feedback
      if (feedbackHistory[currentUrl]) {
        allFeedback.push(...feedbackHistory[currentUrl]);
      }
      
      // Add version-specific feedback
      const urlVersions = versionFeedback[currentUrl];
      if (urlVersions) {
        Object.values(urlVersions).forEach(versionFeedbackList => {
          allFeedback.push(...versionFeedbackList);
        });
      }
      
      // Remove duplicates based on ID (in case legacy and version feedback overlap)
      const uniqueFeedback = allFeedback.filter((feedback, index, array) => 
        array.findIndex(f => f.id === feedback.id) === index
      );
      
      return uniqueFeedback;
    }
    
    // Show only current version feedback
    if (!activeVersion) return [];
    
    const versionKey = activeVersion.toString();
    const versionSpecificFeedback = versionFeedback[currentUrl]?.[versionKey];
    if (versionSpecificFeedback) {
      return versionSpecificFeedback;
    }
    
    // Fallback to legacy feedback if no version-specific feedback exists
    return feedbackHistory[currentUrl] || [];
  }, [currentUrl, activeVersion, versionFeedback, feedbackHistory, showAllVersionFeedback]);

  const handleFeedbackSubmit = (feedback: Omit<FeedbackItem, 'id'>) => {
    addFeedback(feedback);
    clearSelection();
  };

  const handleScrollToText = (selectedText: string) => {
    if (!contentRef.current) return;
    
    // Find the text in the content
    const walker = document.createTreeWalker(
      contentRef.current,
      NodeFilter.SHOW_TEXT,
      null,
    );
    
    let node;
    while (node = walker.nextNode()) {
      const textContent = node.textContent || '';
      const index = textContent.indexOf(selectedText);
      if (index !== -1) {
        // Found the text, get the parent element to scroll to
        const parentElement = node.parentElement;
        if (parentElement) {
          parentElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest'
          });
          
          // Highlight the text temporarily
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + selectedText.length);
          
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
          
          // Clear selection after 2 seconds
          setTimeout(() => {
            selection?.removeAllRanges();
          }, 2000);
          
          break;
        }
      }
    }
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
                       {parseAndRender(note.text)} <a href={`#footnote-ref-${note.marker}`} className="text-blue-500 hover:underline">↑</a>
                    </li>
                ))}
            </ol>
        </div>
    );
  }
  
  const parseAndRender = (text: string): React.ReactNode[] => {
    const parts = text.split(/(\[\d+\]|<i>[\s\S]*?<\/i>|<b>[\s\S]*?<\/b>|\*[\s\S]*?\*|\[ILLUSTRATION-\d+\]|<br\s*\/?>)/g).filter(Boolean);

    return parts.map((part, index) => {
      // Illustration
      const illustrationMatch = part.match(/^(\[ILLUSTRATION-\d+\])$/);
      if (illustrationMatch) {
        return <Illustration key={index} marker={illustrationMatch[1]} />;
      }

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
      // HTML line breaks
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

    // Check if THIS specific URL is being translated
    const currentUrlTranslating = currentUrl ? isUrlTranslating(currentUrl) : false;
    
    // console.log(`[ChapterView Debug] Render check for ${currentUrl}:`);
    // console.log(`[ChapterView Debug] - showEnglish: ${showEnglish}`);
    // console.log(`[ChapterView Debug] - currentUrlTranslating: ${currentUrlTranslating}`);
    // console.log(`[ChapterView Debug] - translationResult: ${!!translationResult}`);
    // console.log(`[ChapterView Debug] - error: ${!!error}`);
    // console.log(`[ChapterView Debug] - First condition (showEnglish && currentUrlTranslating && !translationResult): ${showEnglish && currentUrlTranslating && !translationResult}`);
    // console.log(`[ChapterView Debug] - Second condition (showEnglish && !translationResult && !error): ${showEnglish && !translationResult && !error}`);
    
    if (showEnglish && currentUrlTranslating && !translationResult) {
      // console.log(`[ChapterView Debug] Showing loader - first condition met`);
      return <Loader text={`Translating with ${settings.provider}...`} />;
    }

    // Only show loader if we're in English mode, no translation result, AND no error
    if (showEnglish && !translationResult && !error) {
      // console.log(`[ChapterView Debug] Showing loader - second condition met`);
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

  // Dynamic tooltip for retranslation button
  const getRetranslationTooltip = () => {
    if (!currentUrl) return "Re-translate this chapter";
    
    const currentUrlTranslating = isUrlTranslating(currentUrl);
    if (currentUrlTranslating) {
      return `Translating with ${settings.provider} ${settings.model}...`;
    }
    
    const settingsChanged = hasTranslationSettingsChanged(currentUrl);
    const feedbackChanged = isDirty;
    
    if (settingsChanged && feedbackChanged) {
      return `Re-translate with ${settings.provider} ${settings.model} and new feedback`;
    } else if (settingsChanged) {
      return `Re-translate with ${settings.provider} ${settings.model}`;
    } else if (feedbackChanged) {
      return "Re-translate with new feedback";
    } else {
      return `Re-translate with ${settings.provider} ${settings.model}`;
    }
  };

  // Helper function to get model abbreviation (provider + model specific)
  const getModelAbbreviation = (provider: string, model: string) => {
    // Gemini models
    if (provider === 'Gemini') {
      switch (model) {
        case 'gemini-2.5-pro': return 'GM25Pro';
        case 'gemini-2.5-flash': return 'GM25Flash';
        case 'gemini-2.5-flash-lite': return 'GM25Lite';
        default: return 'GM' + model.replace('gemini-', '').replace('.', '').replace('-', '');
      }
    }
    
    // OpenAI models
    if (provider === 'OpenAI') {
      switch (model) {
        case 'gpt-5': return 'G5';
        case 'gpt-5-mini': return 'G5Mini';
        case 'gpt-5-nano': return 'G5Nano';
        case 'gpt-5-chat-latest': return 'G5Chat';
        case 'gpt-4.1': return 'G41';
        case 'gpt-4.1-mini': return 'G41Mini';
        case 'gpt-4.1-nano': return 'G41Nano';
        case 'gpt-4o': return 'G4o';
        case 'gpt-4o-mini': return 'G4oMini';
        default: 
          // Handle date suffixes like gpt-5-2025-01-12
          const baseModel = model.replace(/-\d{4}-\d{2}-\d{2}$/, '');
          return getModelAbbreviation(provider, baseModel);
      }
    }
    
    // DeepSeek models
    if (provider === 'DeepSeek') {
      switch (model) {
        case 'deepseek-chat': return 'DSChat';
        case 'deepseek-reasoner': return 'DSR1';
        case 'deepseek-coder': return 'DSCode';
        default: return 'DS' + model.replace('deepseek-', '').replace('-', '');
      }
    }
    
    // Claude models (future support)
    if (provider === 'Claude') {
      return 'C' + model.replace('claude-', '').replace('.', '').replace('-', '');
    }
    
    // Fallback for unknown providers/models
    const providerAbbrev = provider.substring(0, 2).toUpperCase();
    const modelAbbrev = model.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6);
    return providerAbbrev + modelAbbrev;
  };

  // Helper function to format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // Version dropdown component
  const VersionDropdown = () => {
    if (!currentUrl || !showEnglish || availableVersions.length <= 1) return null;

    return (
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Translation Versions:</span>
          <select
            value={activeVersion || ''}
            onChange={(e) => {
              const version = parseInt(e.target.value);
              if (version && currentUrl) {
                switchTranslationVersion(currentUrl, version);
              }
            }}
            className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white"
          >
            {availableVersions.map((version) => (
              <option key={version.id} value={version.version}>
                v{version.version} - {formatTimestamp(version.createdAt)} - {getModelAbbreviation(version.provider, version.model)} - T={version.temperature}
              </option>
            ))}
          </select>
        </div>
        {availableVersions.length > 1 && (
          <button
            onClick={() => {
              if (activeVersion && currentUrl && availableVersions.length > 1) {
                if (confirm(`Delete version ${activeVersion}? This cannot be undone.`)) {
                  deleteTranslationVersion(currentUrl, activeVersion);
                }
              }
            }}
            disabled={availableVersions.length <= 1}
            className="ml-3 px-3 py-2 text-xs bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded hover:bg-red-200 dark:hover:bg-red-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Delete current version"
          >
            🗑️ Delete
          </button>
        )}
      </div>
    );
  };

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

  const ImageMetricsDisplay = ({ metrics }: { metrics: { count: number; totalTime: number; totalCost: number; } }) => (
    <div className="text-xs text-center text-gray-500 dark:text-gray-400 mt-1">
      Generated {metrics.count} images in {metrics.totalTime.toFixed(2)}s (~${metrics.totalCost.toFixed(5)})
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
                  disabled={!shouldEnableRetranslation(currentUrl || '') || (currentUrl ? isUrlTranslating(currentUrl) : false)}
                  className={`p-2 rounded-full border transition-all duration-200 ${
                    currentUrl && isUrlTranslating(currentUrl)
                      ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700 cursor-wait'
                      : shouldEnableRetranslation(currentUrl || '')
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300'
                      : 'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  }`}
                  title={getRetranslationTooltip()}
                >
                  <RefreshIcon className={`w-5 h-5 ${currentUrl && isUrlTranslating(currentUrl) ? 'animate-spin' : ''}`} />
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
          {showEnglish && imageGenerationMetrics && (
            <ImageMetricsDisplay metrics={imageGenerationMetrics} />
          )}
          
          {/* Version Management Section */}
          {showEnglish && <VersionDropdown />}
        </header>
      )}

      <div className="min-h-[400px]">
        {renderContent()}
        {showEnglish && renderFootnotes(translationResult?.footnotes)}
        {showEnglish && feedbackForChapter.length > 0 && (
            <div className="mt-8">
              {/* Feedback Toggle */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  Reader Feedback
                </h3>
                <button
                  onClick={() => setShowAllVersionFeedback(!showAllVersionFeedback)}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    showAllVersionFeedback
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  } hover:bg-blue-50 dark:hover:bg-blue-900/20`}
                  title={showAllVersionFeedback ? 'Show only current version feedback' : 'Show feedback from all versions'}
                >
                  {showAllVersionFeedback ? 'Current Version Only' : 'All Versions'}
                </button>
              </div>
              
              <FeedbackDisplay 
                  feedback={feedbackForChapter}
                  onDelete={deleteFeedback}
                  onUpdate={updateFeedbackComment}
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