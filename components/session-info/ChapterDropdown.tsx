/**
 * ChapterDropdown - Chapter navigation dropdown
 *
 * Extracted from SessionInfo.tsx for better separation of concerns.
 */

import React from 'react';
import { useAppStore } from '../../store';
import { useChapterDropdownOptions } from '../../hooks/useChapterDropdownOptions';

interface ChapterDropdownProps {
  currentChapterId: string | null;
}

export const ChapterDropdown: React.FC<ChapterDropdownProps> = ({ currentChapterId }) => {
  const handleNavigate = useAppStore(s => s.handleNavigate);
  const chapters = useAppStore(s => s.chapters);
  const { options: chapterOptions, isLoading: summariesLoading, isEmpty: sessionIsEmpty } = useChapterDropdownOptions();

  const handleChapterSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedChapter = chapterOptions.find(c => c.stableId === selectedId);
    if (selectedChapter) {
      const fallback = chapters.get(selectedId || '');
      const targetUrl = selectedChapter.canonicalUrl || fallback?.canonicalUrl || fallback?.originalUrl;
      if (targetUrl) {
        handleNavigate(targetUrl);
      }
    }
  };

  if (summariesLoading) {
    return <span className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">Loading chapters…</span>;
  }

  if (sessionIsEmpty) {
    return <span className="text-sm text-gray-500 dark:text-gray-400">No chapter loaded</span>;
  }

  return (
    <select
      id="chapter-select"
      value={currentChapterId || ''}
      onChange={handleChapterSelect}
      disabled={sessionIsEmpty || summariesLoading}
      className="flex-grow w-full sm:w-auto min-w-[12rem] max-w-full px-3 py-2 text-sm text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border-2 border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
      aria-label="Select a chapter to navigate to"
    >
      {chapterOptions.map((chapter) => (
        <option key={chapter.stableId} value={chapter.stableId}>
          {chapter.displayLabel}
        </option>
      ))}
    </select>
  );
};

export default ChapterDropdown;
