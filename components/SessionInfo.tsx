import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useAppStore from '../store/useAppStore';
import SettingsIcon from './icons/SettingsIcon';
import { useShallow } from 'zustand/react/shallow';
import { SessionChapterData } from '../store/useAppStore';
import { ImportTransformationService } from '../services/importTransformationService';

/**
 * Extracts a chapter number from a string.
 * It looks for standalone numbers or numbers prefixed with "Chapter".
 * @param str The string to parse.
 * @returns The chapter number, or null if not found.
 */
const getChapterNumber = (str: string): number | null => {
    if (!str) return null;

    // Attempt to match "Chapter 123", "ch 123", "123", etc.
    const match = str.match(/(?:chapter|ch|ตอนที่|ตอน)?[\s.]*(\d+)/i);

    if (match && match[1]) {
        const num = parseInt(match[1], 10);
        // Basic validation to avoid giant numbers from other parts of the URL/string
        if (num >= 0 && num < 100000) {
            return num;
        }
    }
    return null;
};

const SessionInfo: React.FC = () => {
    const {
        currentUrl,
        sessionData,
        urlHistory, // <-- Get the urlHistory
        handleNavigate,
        exportSession,
        exportEpub,
        setShowSettingsModal
    } = useAppStore(useShallow(state => ({
        currentUrl: state.currentUrl,
        sessionData: state.sessionData,
        urlHistory: state.urlHistory, // <-- Get the urlHistory
        handleNavigate: state.handleNavigate,
        exportSession: state.exportSession,
        exportEpub: state.exportEpub,
        setShowSettingsModal: state.setShowSettingsModal,
    })));
    
    const [showExportModal, setShowExportModal] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    
    // Enhanced chapter data with stable IDs for React keys
    const [stableChapters, setStableChapters] = useState<Array<{
        stableId: string;
        url: string;
        data: any;
        title: string;
        chapterNumber: number;
    }>>([]);

    // Load stable chapters asynchronously
    useEffect(() => {
        const loadStableChapters = async () => {
            try {
                const chaptersWithStableKeys = await ImportTransformationService.getChaptersForReactRendering();
                console.log('[SessionInfo] Loaded chapters with stable keys:', chaptersWithStableKeys.length);
                setStableChapters(chaptersWithStableKeys);
            } catch (error) {
                console.error('[SessionInfo] Failed to load stable chapters:', error);
                // Fallback to legacy behavior if stable system fails
                setStableChapters([]);
            }
        };

        // Only load stable chapters if we have sessionData
        if (Object.keys(sessionData).length > 0) {
            loadStableChapters();
        } else {
            setStableChapters([]);
        }
    }, [sessionData]);

    // Fallback to legacy sorting when stable system unavailable
    const legacySortedChapters = useMemo(() => {
        // Only use legacy system when stable chapters are not available
        if (stableChapters.length > 0) return [];

        const chapterMap = new Map<string, { url: string, data: SessionChapterData }>();
        Object.entries(sessionData).forEach(([url, data]) => {
            if (data?.chapter) {
                chapterMap.set(url, { url, data });
            }
        });

        if (chapterMap.size === 0) return [];

        // Find the starting nodes (heads) of all chapter chains
        const heads = new Set(chapterMap.values());
        for (const chapter of chapterMap.values()) {
            const prevUrl = chapter.data.chapter.prevUrl;
            if (prevUrl && chapterMap.has(prevUrl)) {
                heads.delete(chapter); // This node is not a head because something points to it
            }
        }

        // Build the chains by following nextUrl from each head
        const chains: Array<{ url: string, data: SessionChapterData }[]> = [];
        for (const head of heads) {
            const currentChain: { url: string, data: SessionChapterData }[] = [];
            let currentNode: { url: string, data: SessionChapterData } | undefined = head;
            while (currentNode) {
                currentChain.push(currentNode);
                const nextUrl = currentNode.data.chapter.nextUrl;
                // Ensure we don't add chapters that aren't in the session, preventing infinite loops
                currentNode = nextUrl && chapterMap.has(nextUrl) ? chapterMap.get(nextUrl) : undefined;
            }
            chains.push(currentChain);
        }

        // Sort the chains using the hybrid, multi-level logic
        chains.sort((chainA, chainB) => {
            const firstA = chainA[0];
            const firstB = chainB[0];

            const titleA = firstA.data.translationResult?.translatedTitle || firstA.data.chapter.title || '';
            const titleB = firstB.data.translationResult?.translatedTitle || firstB.data.chapter.title || '';

            // 1. Primary Sort: By number in the title
            const numA_title = getChapterNumber(titleA);
            const numB_title = getChapterNumber(titleB);
            if (numA_title !== null && numB_title !== null && numA_title !== numB_title) {
                return numA_title - numB_title;
            }

            // 2. Tie-breaker: By number in the URL
            const numA_url = getChapterNumber(firstA.url);
            const numB_url = getChapterNumber(firstB.url);
            if (numA_url !== null && numB_url !== null && numA_url !== numB_url) {
                return numA_url - numB_url;
            }

            // 3. Final Tie-breaker: Alphabetical URL sort for stability
            return firstA.url.localeCompare(firstB.url);
        });

        // Flatten the sorted chains into a single list
        return chains.flat();
    }, [sessionData, stableChapters.length]);

    // Use stable chapters if available, otherwise fall back to legacy
    const sortedChapters = stableChapters.length > 0 ? stableChapters : legacySortedChapters;

    const sessionIsEmpty = sortedChapters.length === 0;

    const handleChapterSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newUrl = e.target.value;
        if(newUrl) {
            handleNavigate(newUrl);
        }
    }

    const handleExportFormat = async (format: 'json' | 'epub') => {
        setIsExporting(true);
        try {
            if (format === 'json') {
                exportSession();
            } else {
                await exportEpub();
            }
            setShowExportModal(false);
        } catch (error: any) {
            console.error('[Export] Export failed:', error);
            alert(`Export failed: ${error.message || 'Unknown error'}`);
        } finally {
            setIsExporting(false);
        }
    }

  return (
    <div className="w-full max-w-4xl mx-auto -mt-2 mb-6 p-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-b-xl shadow-lg flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-gray-200 dark:border-gray-700">
      <div className="flex-grow w-full sm:w-auto flex items-center gap-2">
        <label htmlFor="chapter-select" className="font-semibold text-gray-600 dark:text-gray-300 flex-shrink-0">
          Chapter:
        </label>
        {sessionIsEmpty ? (
          <span className="text-sm text-gray-500 dark:text-gray-400">No chapter loaded</span>
        ) : (
          <select
            id="chapter-select"
            value={currentUrl || ''}
            onChange={handleChapterSelect}
            disabled={sessionIsEmpty}
            className="flex-grow w-full px-3 py-2 text-sm text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border-2 border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            aria-label="Select a chapter to navigate to"
          >
            {sortedChapters.map((chapter) => {
              // Handle both stable and legacy chapter formats
              if (stableChapters.length > 0) {
                // Use stable chapter format with stable ID as key
                const stableChapter = chapter as { stableId: string; url: string; data: any; title: string; chapterNumber: number };
                const title = stableChapter.data?.translationResult?.translatedTitle || stableChapter.title || 'Untitled Chapter';
                return (
                  <option key={stableChapter.stableId} value={stableChapter.url}>
                    {title}
                  </option>
                );
              } else {
                // Legacy format fallback
                const legacyChapter = chapter as { url: string; data: SessionChapterData };
                if (!legacyChapter.data) return null;
                const title = legacyChapter.data.translationResult?.translatedTitle || legacyChapter.data.chapter.title || 'Untitled Chapter';
                // Create render-cycle unique key to handle React.StrictMode double-rendering
                const chapterKey = `${legacyChapter.url}-${legacyChapter.data.chapter.chapterNumber}-${Math.random().toString(36).substring(2, 15)}`;
                return (
                  <option key={chapterKey} value={legacyChapter.url}>
                    {title}
                  </option>
                );
              }
            })}
          </select>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-center">
        <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold rounded-full shadow-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            title="Settings"
        >
            <SettingsIcon className="w-5 h-5"/>
        </button>
        <div className="relative">
          <button
              onClick={() => setShowExportModal(true)}
              disabled={sessionIsEmpty || isExporting}
              className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition duration-300 ease-in-out"
          >
              {isExporting ? 'Exporting...' : 'Export Session'}
          </button>
          
          {/* Export Format Modal */}
          {showExportModal && createPortal(
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowExportModal(false)}>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Choose Export Format</h3>
                
                <div className="space-y-3">
                  <button
                    onClick={() => handleExportFormat('json')}
                    disabled={isExporting}
                    className="w-full p-4 text-left border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">JSON Format</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Export session data as JSON file for backup or sharing</div>
                  </button>
                  
                  <button
                    onClick={() => handleExportFormat('epub')}
                    disabled={isExporting}
                    className="w-full p-4 text-left border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">EPUB Format</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Generate readable e-book with active translations and images</div>
                  </button>
                </div>
                
                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => setShowExportModal(false)}
                    disabled={isExporting}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionInfo;