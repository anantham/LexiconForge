import React from 'react';
import { createPortal } from 'react-dom';
import type { ComparisonChunk } from '../../hooks/useComparisonPortal';

interface Props {
  viewMode: 'original' | 'fan' | 'english';
  comparisonChunk: ComparisonChunk | null;
  comparisonPortalNode: HTMLElement | null;
  comparisonExpanded: boolean;
  setComparisonExpanded: (expanded: boolean) => void;
  comparisonLoading: boolean;
  comparisonError: string | null;
  showRawComparison: boolean;
  setShowRawComparison: (show: boolean) => void;
  dismissComparison: () => void;
}

const ComparisonPortal: React.FC<Props> = ({
  viewMode,
  comparisonChunk,
  comparisonPortalNode,
  comparisonExpanded,
  setComparisonExpanded,
  comparisonLoading,
  comparisonError,
  showRawComparison,
  setShowRawComparison,
  dismissComparison,
}) => {
  if (viewMode !== 'english' || !comparisonChunk || !comparisonPortalNode) {
    return null;
  }

  const toggleRaw = () => setShowRawComparison(!showRawComparison);

  return createPortal(
    comparisonExpanded ? (
      <div className="mt-4 rounded-xl border border-teal-500/60 dark:border-teal-400/40 bg-teal-100/70 dark:bg-teal-900/50 shadow-lg px-4 py-3 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-teal-700 dark:text-teal-300">
              Comparison with fan translation
            </h3>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              Selected:&nbsp;
              <span className="font-medium text-gray-800 dark:text-gray-100">{comparisonChunk.selection}</span>
            </p>
            {typeof comparisonChunk.confidence === 'number' && !Number.isNaN(comparisonChunk.confidence) && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Confidence {(Math.max(0, Math.min(1, comparisonChunk.confidence)) * 100).toFixed(0)}%
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {comparisonChunk.rawExcerpt && (
              <button
                onClick={toggleRaw}
                className="flex items-center gap-1 text-xs px-3 py-1 rounded bg-amber-200 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 hover:bg-amber-300 dark:hover:bg-amber-900/60 transition"
                title={showRawComparison ? 'Show fan translation' : 'Show raw text'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path d="M12 4a1 1 0 011 1v1.079A6.001 6.001 0 0118 12a1 1 0 11-2 0 4 4 0 10-4 4 1 1 0 010 2 6 6 0 01-5.917-5H4a1 1 0 110-2h2.083A6 6 0 0112 4zm7 8a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1zm-7 7a1 1 0 011-1h.917A6.001 6.001 0 0118 12a1 1 0 112 0 8 8 0 01-7.083 7.917V20a1 1 0 01-2 0v-1a7.963 7.963 0 01-3.535-.917A1 1 0 018.5 16.5a1 1 0 011.366.366A6 6 0 0011 19a1 1 0 011 1z" />
                </svg>
                <span>{showRawComparison ? 'Fan translation' : 'Raw text'}</span>
              </button>
            )}
            <button
              className="text-xs text-teal-600 dark:text-teal-300 hover:underline"
              onClick={() => setComparisonExpanded(false)}
            >
              Collapse
            </button>
            <button
              className="text-xs text-red-500 dark:text-red-400 hover:underline"
              onClick={dismissComparison}
            >
              Dismiss
            </button>
          </div>
        </div>
        {comparisonLoading && (
          <p className="text-xs text-gray-500 dark:text-gray-300">Loading comparison…</p>
        )}
        {comparisonError && (
          <p className="text-xs text-red-600 dark:text-red-400">{comparisonError}</p>
        )}
        {!comparisonLoading && !comparisonError && (
          <div className="space-y-3 text-sm">
            {(() => {
              const before = showRawComparison
                ? comparisonChunk.rawContextBefore ?? comparisonChunk.fanContextBefore
                : comparisonChunk.fanContextBefore;
              return before ? (
                <p className="text-gray-600 dark:text-gray-400">{before}</p>
              ) : null;
            })()}
            <div
              className={`rounded-lg px-3 py-2 ${
                showRawComparison
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100'
                  : 'bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100'
              }`}
            >
              {showRawComparison
                ? comparisonChunk.rawExcerpt || 'Raw excerpt unavailable.'
                : comparisonChunk.fanExcerpt || 'Fan excerpt unavailable.'}
            </div>
            {(() => {
              const after = showRawComparison
                ? comparisonChunk.rawContextAfter ?? comparisonChunk.fanContextAfter
                : comparisonChunk.fanContextAfter;
              return after ? (
                <p className="text-gray-600 dark:text-gray-400">{after}</p>
              ) : null;
            })()}
          </div>
        )}
      </div>
    ) : (
      <div className="mt-4 flex items-center gap-3 rounded-full bg-teal-100/70 dark:bg-teal-900/40 px-3 py-2">
        <button
          className="text-xs font-medium text-teal-700 dark:text-teal-200 hover:underline"
          onClick={() => setComparisonExpanded(true)}
        >
          Show fan comparison
        </button>
        <button
          className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
          onClick={dismissComparison}
        >
          Dismiss
        </button>
      </div>
    ),
    comparisonPortalNode
  );
};

export default ComparisonPortal;
