import React, { useMemo } from 'react';
import useAppStore from '../store/useAppStore';
import SettingsIcon from './icons/SettingsIcon';
import { useShallow } from 'zustand/react/shallow';
import { SessionChapterData } from '../store/useAppStore';

const SessionInfo: React.FC = () => {
    const {
        currentUrl,
        sessionData,
        handleNavigate,
        exportSession,
        setShowSettingsModal
    } = useAppStore(useShallow(state => ({
        currentUrl: state.currentUrl,
        sessionData: state.sessionData,
        handleNavigate: state.handleNavigate,
        exportSession: state.exportSession,
        setShowSettingsModal: state.setShowSettingsModal,
    })));
    
    const getChapterNumber = (title: string): number | null => {
      if (!title) return null;
      // This regex finds the first sequence of digits in the string.
      const match = title.match(/\d+/);
      return match ? parseInt(match[0], 10) : null;
    };
    
    const sortedChapters = useMemo(() => {
        return Object.entries(sessionData)
            .map(([url, data]) => ({ url, data }))
            .sort((a, b) => {
                const titleA = a.data.translationResult?.translatedTitle || a.data.chapter.title || '';
                const titleB = b.data.translationResult?.translatedTitle || b.data.chapter.title || '';

                const numA = getChapterNumber(titleA);
                const numB = getChapterNumber(titleB);

                if (numA !== null && numB !== null) {
                    if (numA !== numB) return numA - numB;
                }
                
                if (numA !== null) return -1; // A has a number, B does not. A comes first.
                if (numB !== null) return 1;  // B has a number, A does not. B comes first.

                // Fallback to URL sorting if no numbers are found in titles for a stable order
                return a.url.localeCompare(b.url);
            });
    }, [sessionData]);

    const sessionIsEmpty = sortedChapters.length === 0;

    const handleChapterSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newUrl = e.target.value;
        if(newUrl) {
            handleNavigate(newUrl);
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
            {sortedChapters.map(({ url, data }) => {
              if (!data) return null; 
              const title = data.translationResult?.translatedTitle || data.chapter.title || 'Untitled Chapter';
              return (
                <option key={url} value={url}>
                  {title}
                </option>
              );
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
        <button
            onClick={exportSession}
            disabled={sessionIsEmpty}
            className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition duration-300 ease-in-out"
        >
            Export Session
        </button>
      </div>
    </div>
  );
};

export default SessionInfo;