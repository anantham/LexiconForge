/**
 * StorageDiagnosticsSection - Memory and disk usage display
 *
 * Extracted from AdvancedPanel for better separation of concerns.
 * Handles RAM stats, disk stats, and cache clearing.
 */

import React from 'react';

interface RAMStats {
  totalChapters: number;
  chaptersWithTranslations: number;
  chaptersWithImages: number;
  imagesInCache: number;
  imagesInRAM: number;
  estimatedRAM: {
    totalMB: number;
    chapterContentBytes: number;
    base64ImageBytes: number;
  };
  warnings?: string[];
}

interface DiskDiagnostics {
  disk: {
    totalChapters: number;
    totalTranslations: number;
    totalImages: number;
    imagesInCache: number;
    imagesLegacy: number;
  };
  quota: {
    usedMB: number;
    quotaMB: number;
    percentUsed: number;
  } | null;
}

interface StorageDiagnosticsSectionProps {
  expanded: boolean;
  onToggleExpanded: () => void;
  ramStats: RAMStats | null;
  diskDiagnostics: DiskDiagnostics | null;
  loadingDiskStats: boolean;
  clearingCache: boolean;
  onClearImageCache: () => void;
}

export const StorageDiagnosticsSection: React.FC<StorageDiagnosticsSectionProps> = ({
  expanded,
  onToggleExpanded,
  ramStats,
  diskDiagnostics,
  loadingDiskStats,
  clearingCache,
  onClearImageCache,
}) => {
  return (
    <>
      <fieldset className="border border-gray-300 dark:border-gray-600 rounded-md p-4">
        <legend className="text-lg font-semibold px-2 text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleExpanded}
            className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            aria-label={expanded ? 'Collapse diagnostics' : 'Expand diagnostics'}
          >
            <svg
              className={`w-5 h-5 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Memory & Storage Diagnostics
          </button>
        </legend>
        {expanded && (
          <div className="space-y-6 mt-4">
            {ramStats ? (
              <>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                    RAM (Current Session)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                      <div className="text-xs text-blue-600 dark:text-blue-400 uppercase font-medium">Chapters Loaded</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{ramStats.totalChapters}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        {ramStats.chaptersWithTranslations} translated • {ramStats.chaptersWithImages} with images
                      </div>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                      <div className="text-xs text-blue-600 dark:text-blue-400 uppercase font-medium">RAM Usage</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {ramStats.estimatedRAM.totalMB.toFixed(2)} MB
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        Content: {(ramStats.estimatedRAM.chapterContentBytes / 1024 / 1024).toFixed(2)} MB
                        {ramStats.estimatedRAM.base64ImageBytes > 0 && (
                          <> • Legacy Images: {(ramStats.estimatedRAM.base64ImageBytes / 1024 / 1024).toFixed(2)} MB</>
                        )}
                      </div>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                      <div className="text-xs text-blue-600 dark:text-blue-400 uppercase font-medium">Images (RAM)</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {ramStats.imagesInCache + ramStats.imagesInRAM}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        {ramStats.imagesInCache} cached • {ramStats.imagesInRAM} legacy
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded text-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">Memory diagnostics unavailable.</div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                Disk (IndexedDB Storage)
              </h4>
              {loadingDiskStats ? (
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded text-center">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Loading disk statistics...</div>
                </div>
              ) : diskDiagnostics ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                      <div className="text-xs text-green-600 dark:text-green-400 uppercase font-medium">Total Chapters</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {diskDiagnostics.disk.totalChapters}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        {diskDiagnostics.disk.totalTranslations} translation
                        {diskDiagnostics.disk.totalTranslations !== 1 ? 's' : ''} stored
                      </div>
                    </div>
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                      <div className="text-xs text-green-600 dark:text-green-400 uppercase font-medium">Total Images</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {diskDiagnostics.disk.totalImages}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        {diskDiagnostics.disk.imagesInCache} in cache • {diskDiagnostics.disk.imagesLegacy} legacy
                      </div>
                    </div>
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                      <div className="text-xs text-green-600 dark:text-green-400 uppercase font-medium">Quota Usage</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {diskDiagnostics.quota ? `${diskDiagnostics.quota.usedMB} MB` : 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        {diskDiagnostics.quota
                          ? `${diskDiagnostics.quota.percentUsed}% of ${diskDiagnostics.quota.quotaMB} MB`
                          : 'Quota information unavailable'}
                      </div>
                    </div>
                  </div>
                  {diskDiagnostics.disk.imagesInCache > 0 && (
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={onClearImageCache}
                        disabled={clearingCache}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                      >
                        {clearingCache ? 'Clearing...' : `Clear Image Cache (${diskDiagnostics.disk.imagesInCache} images)`}
                      </button>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Export with images first to preserve them
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded text-center">
                  <div className="text-sm text-gray-500 dark:text-gray-400">No disk diagnostics available.</div>
                </div>
              )}
            </div>
          </div>
        )}
      </fieldset>

      {ramStats?.warnings?.length ? (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
          <div className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Warnings</div>
          <ul className="space-y-1">
            {ramStats.warnings.map((warning: string, idx: number) => (
              <li key={idx} className="text-xs text-yellow-700 dark:text-yellow-300">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p>
          <strong>Understanding the Stats:</strong>
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>RAM:</strong> Shows only chapters currently loaded in this browser tab
          </li>
          <li>
            <strong>Disk:</strong> Shows all chapters/images stored in IndexedDB (shared across tabs)
          </li>
          <li>For optimal performance, keep loaded chapters under 50</li>
          <li>Legacy base64 images use significantly more RAM than cache-stored images</li>
          <li>Run migration scripts to move existing images to cache storage</li>
          <li>Clear session data to free up memory if experiencing performance issues</li>
        </ul>
      </div>
    </>
  );
};

export default StorageDiagnosticsSection;
