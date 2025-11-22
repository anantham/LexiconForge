import React from 'react';

interface FooterNavigationProps {
  prevUrl?: string | null;
  nextUrl?: string | null;
  isLoading: boolean;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
}

const FooterNavigation: React.FC<FooterNavigationProps> = ({
  prevUrl,
  nextUrl,
  isLoading,
  onNavigatePrev,
  onNavigateNext,
}) => (
  <footer className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
    <button
      onClick={onNavigatePrev}
      disabled={!prevUrl || isLoading}
      className="px-5 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
    >
      &larr; Previous
    </button>
    <button
      onClick={onNavigateNext}
      disabled={!nextUrl || isLoading}
      className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 disabled:cursor-not-allowed transition"
    >
      Next &rarr;
    </button>
  </footer>
);

export default FooterNavigation;
