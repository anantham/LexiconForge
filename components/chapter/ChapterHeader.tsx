import React from 'react';
import RefreshIcon from '../icons/RefreshIcon';
type ViewMode = 'original' | 'fan' | 'english';

interface ChapterHeaderProps {
  title: string;
  fontStyle: 'sans' | 'serif';
  targetLanguageLabel: string;
  viewMode: ViewMode;
  hasFanTranslation: boolean;
  sourceUrl?: string | null;
  suttaStudioUrl?: string | null;
  onToggleLanguage: (mode: ViewMode) => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
  showRetranslateButton?: boolean;
  retranslateDisabled?: boolean;
  isRetranslationActive?: boolean;
  onRetranslateClick?: () => void;
}

const languageButtonClasses = (
  isActive: boolean
) =>
  `px-4 py-1 text-sm font-semibold rounded-full transition-colors ${
    isActive ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow' : 'text-gray-600 dark:text-gray-400'
  }`;

const mobileLanguageButtonClasses = (
  isActive: boolean
) =>
  `px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
    isActive ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow' : 'text-gray-600 dark:text-gray-400'
  }`;

const ChapterHeader: React.FC<ChapterHeaderProps> = ({
  title,
  fontStyle,
  targetLanguageLabel,
  viewMode,
  hasFanTranslation,
  sourceUrl,
  suttaStudioUrl,
  onToggleLanguage,
  onNavigatePrev,
  onNavigateNext,
  prevDisabled,
  nextDisabled,
  showRetranslateButton,
  retranslateDisabled,
  isRetranslationActive,
  onRetranslateClick,
}) => {
  const languageToggle = (variant: 'desktop' | 'mobile') => (
    <div className="relative inline-flex items-center p-1 bg-gray-200 dark:bg-gray-700 rounded-full">
      <button
        onClick={() => onToggleLanguage('original')}
        className={variant === 'desktop' ? languageButtonClasses(viewMode === 'original') : mobileLanguageButtonClasses(viewMode === 'original')}
      >
        Original
      </button>
      {hasFanTranslation && (
        <button
          onClick={() => onToggleLanguage('fan')}
          className={variant === 'desktop' ? languageButtonClasses(viewMode === 'fan') : mobileLanguageButtonClasses(viewMode === 'fan')}
        >
          Fan
        </button>
      )}
      <button
        onClick={() => onToggleLanguage('english')}
        className={variant === 'desktop' ? languageButtonClasses(viewMode === 'english') : mobileLanguageButtonClasses(viewMode === 'english')}
      >
        {targetLanguageLabel}
      </button>
    </div>
  );

  return (
    <header className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
      <h1
        className={`text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 text-center ${
          fontStyle === 'serif' ? 'font-serif' : 'font-sans'
        }`}
      >
        {title}
      </h1>

      <div className="hidden md:flex justify-between items-center">
        <button
          onClick={onNavigatePrev}
          disabled={prevDisabled}
          className="px-5 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          &larr; Previous
        </button>

        <div className="flex justify-center items-center gap-4 ml-6">
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline font-semibold text-sm"
              title="View original source"
            >
              Source
            </a>
          )}
          {suttaStudioUrl && (
            <a
              href={suttaStudioUrl}
              className="w-9 h-9 rounded-full flex items-center justify-center border border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10 transition"
              title="Open Sutta Studio"
              aria-label="Open Sutta Studio"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 3l2.1 4.3L18 9.4l-4.2 2 1.2 4.6L12 13.8 9 16l1.2-4.6-4.2-2 3.9-2.1L12 3z"
                />
              </svg>
            </a>
          )}
          {languageToggle('desktop')}
          {showRetranslateButton && (
            <button
              onClick={onRetranslateClick}
              disabled={retranslateDisabled}
              className={`p-2 rounded-full border transition-all duration-200 ${
                isRetranslationActive
                  ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/40'
                  : retranslateDisabled
                    ? 'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    : 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300'
              }`}
              title={isRetranslationActive ? 'Cancel translation' : 'Retranslate chapter'}
            >
              <RefreshIcon className={`w-4 h-4 ${isRetranslationActive ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        <div className="flex items-center justify-end">
          <button
            onClick={onNavigateNext}
            disabled={nextDisabled}
            className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 disabled:cursor-not-allowed transition"
          >
            Next &rarr;
          </button>
        </div>
      </div>

      <div className="md:hidden space-y-3">
        <div className="flex justify-between items-center">
          <button
            onClick={onNavigatePrev}
            disabled={prevDisabled}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
          >
            &larr; Prev
          </button>
          <button
            onClick={onNavigateNext}
            disabled={nextDisabled}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 disabled:cursor-not-allowed transition text-sm"
          >
            Next &rarr;
          </button>
        </div>

            <div className="flex justify-center items-center gap-3">
              {languageToggle('mobile')}
              {suttaStudioUrl && (
                <a
                  href={suttaStudioUrl}
                  className="w-8 h-8 rounded-full flex items-center justify-center border border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10 transition"
                  title="Open Sutta Studio"
                  aria-label="Open Sutta Studio"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M12 3l2.1 4.3L18 9.4l-4.2 2 1.2 4.6L12 13.8 9 16l1.2-4.6-4.2-2 3.9-2.1L12 3z"
                    />
                  </svg>
                </a>
              )}
              {showRetranslateButton && (
                <button
                  onClick={onRetranslateClick}
                  disabled={retranslateDisabled}
                  className={`p-2 rounded-full border transition-all duration-200 ${
                    isRetranslationActive
                      ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/40'
                      : retranslateDisabled
                        ? 'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        : 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300'
                  }`}
                  title={isRetranslationActive ? 'Cancel translation' : 'Retranslate chapter'}
                >
                  <RefreshIcon className={`w-4 h-4 ${isRetranslationActive ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
      </div>

    </header>
  );
};

export default ChapterHeader;
