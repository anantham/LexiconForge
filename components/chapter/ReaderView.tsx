import React from 'react';
import ChapterHeader from './ChapterHeader';
import TranslationStatusPanel from './TranslationStatusPanel';
import ReaderBody from './ReaderBody';
import type { Chapter } from '../../types';

interface ReaderViewProps {
  viewRef: React.RefObject<HTMLDivElement>;
  chapter: Chapter | null;
  headerProps: React.ComponentProps<typeof ChapterHeader>;
  statusProps: React.ComponentProps<typeof TranslationStatusPanel>;
  bodyProps: React.ComponentProps<typeof ReaderBody>;
}

const ReaderView: React.FC<ReaderViewProps> = ({ viewRef, chapter, headerProps, statusProps, bodyProps }) => (
  <div
    ref={viewRef}
    data-chapter-content
    className="relative w-full max-w-4xl mx-auto mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8"
  >
    {chapter && (
      <>
        <ChapterHeader {...headerProps} />
        <TranslationStatusPanel {...statusProps} />
      </>
    )}
    <ReaderBody {...bodyProps} />
  </div>
);

export default ReaderView;
