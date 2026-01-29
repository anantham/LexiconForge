/**
 * ExportModal - Export options dialog for JSON/EPUB export
 *
 * Extracted from SessionInfo.tsx for better separation of concerns.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store';
import { telemetryService } from '../../services/telemetryService';

const formatSize = (bytes?: number | null): string => {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${Math.max(bytes, 0).toFixed(0)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 10 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
};

const DEFAULT_EXPORT_OPTIONS = {
  includeChapters: true,
  includeTelemetry: true,
  includeImages: true,
};

export interface ExportProgress {
  phase: 'preparing' | 'processing' | 'finalizing' | 'done';
  current: number;
  total: number;
  message: string;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublishClick: () => void;
  sessionIsEmpty: boolean;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  onPublishClick,
  sessionIsEmpty,
}) => {
  const chapters = useAppStore(s => s.chapters);
  const exportSessionData = useAppStore(s => s.exportSessionData);
  const exportEpub = useAppStore(s => s.exportEpub);
  const exportProgress = useAppStore(s => s.exportProgress);
  const setExportProgress = useAppStore(s => s.setExportProgress);
  const setShowSettingsModal = useAppStore(s => s.setShowSettingsModal);

  const [exportOptions, setExportOptions] = useState(() => ({ ...DEFAULT_EXPORT_OPTIONS }));
  const [imageUsage, setImageUsage] = useState<{ images: number; totalSizeMB: number } | null>(null);
  const [telemetrySizeBytes, setTelemetrySizeBytes] = useState<number | null>(null);

  const isExporting = exportProgress !== null && exportProgress.phase !== 'done';

  const approxChapterSizeBytes = useMemo(() => {
    try {
      if (typeof TextEncoder === 'undefined') return null;
      const encoder = new TextEncoder();
      let total = 0;
      chapters.forEach((chapter: any) => {
        total += encoder.encode(chapter?.title || '').length;
        total += encoder.encode(chapter?.content || '').length;
        if (chapter?.translationResult?.translation) {
          total += encoder.encode(chapter.translationResult.translation).length;
        }
        if (chapter?.translationResult?.footnotes) {
          total += encoder.encode(JSON.stringify(chapter.translationResult.footnotes)).length;
        }
        if (Array.isArray(chapter?.feedback)) {
          total += encoder.encode(JSON.stringify(chapter.feedback)).length;
        }
      });
      return total;
    } catch {
      return null;
    }
  }, [chapters]);

  const imageSizeBytes = imageUsage ? imageUsage.totalSizeMB * 1024 * 1024 : null;
  const imageUsageLabel = imageUsage
    ? `${formatSize(imageSizeBytes)} • ${imageUsage.images} asset${imageUsage.images === 1 ? '' : 's'}`
    : 'calculating…';
  const telemetrySizeLabel = formatSize(telemetrySizeBytes);
  const chapterSizeLabel = formatSize(approxChapterSizeBytes);
  const imagesDisabled = !exportOptions.includeChapters;
  const hasJsonContent = exportOptions.includeChapters || exportOptions.includeTelemetry || exportOptions.includeImages;

  // Load sizes when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setImageUsage(null);
    setTelemetrySizeBytes(null);

    (async () => {
      try {
        const telemetryJson = telemetryService.exportTelemetry();
        if (!cancelled) {
          let bytes: number;
          try {
            bytes = new TextEncoder().encode(telemetryJson ?? '').length;
          } catch {
            bytes = telemetryJson ? telemetryJson.length : 0;
          }
          setTelemetrySizeBytes(bytes);
        }
      } catch {
        if (!cancelled) setTelemetrySizeBytes(null);
      }

      try {
        const imageCache = await import('../../services/imageCacheService');
        if (cancelled) return;
        if (typeof window !== 'undefined' && imageCache.ImageCacheStore.isSupported()) {
          const stats = await imageCache.ImageCacheStore.getUsage();
          if (!cancelled) setImageUsage(stats);
        } else if (!cancelled) {
          setImageUsage({ images: 0, totalSizeMB: 0 });
        }
      } catch (error) {
        console.warn('[Export] Failed to inspect image cache usage', error);
        if (!cancelled) setImageUsage(null);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen]);

  const handleExportOptionChange = (key: keyof typeof exportOptions) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setExportOptions(prev => {
      const next = { ...prev, [key]: checked };
      if (key === 'includeChapters' && !checked) {
        next.includeImages = false;
      }
      if (key === 'includeImages' && checked) {
        next.includeChapters = true;
      }
      return next;
    });
  };

  const handleExportFormat = async (format: 'json' | 'epub') => {
    setExportProgress({ phase: 'preparing', current: 0, total: 1, message: 'Starting export...' });
    try {
      if (format === 'json') {
        const hasContent = exportOptions.includeChapters || exportOptions.includeTelemetry || exportOptions.includeImages;
        if (!hasContent) {
          alert('Select at least one data type to include in the JSON export.');
          setExportProgress(null);
          return;
        }
        await exportSessionData(exportOptions);
      } else {
        // EPUB export - check for metadata and cover image
        let novelMeta: { title?: string; author?: string; coverImage?: any } = {};
        try {
          const stored = localStorage.getItem('novelMetadata');
          if (stored) novelMeta = JSON.parse(stored);
        } catch {}

        const missingFields: string[] = [];
        if (!novelMeta.title?.trim()) missingFields.push('Title');
        if (!novelMeta.author?.trim()) missingFields.push('Author');

        if (missingFields.length > 0) {
          const proceed = confirm(
            `The following metadata fields are empty:\n• ${missingFields.join('\n• ')}\n\n` +
            `Your EPUB will have generic metadata. Would you like to continue anyway?\n\n` +
            `(Click Cancel to go to Settings → Novel Info to fill in the details)`
          );
          if (!proceed) {
            setExportProgress(null);
            onClose();
            setShowSettingsModal(true);
            return;
          }
        }

        if (!novelMeta.coverImage?.cacheKey) {
          const proceed = confirm(
            `No cover image selected for your EPUB.\n\n` +
            `Would you like to continue without a cover?\n\n` +
            `(Click Cancel to go to Settings → Novel Info to select a cover from your gallery)`
          );
          if (!proceed) {
            setExportProgress(null);
            onClose();
            setShowSettingsModal(true);
            return;
          }
        }

        await exportEpub();
      }
      onClose();
    } catch (error: any) {
      console.error('[Export] Export failed:', error);
      alert(`Export failed: ${error.message || 'Unknown error'}`);
    } finally {
      setTimeout(() => setExportProgress(null), 1500);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Choose Export Format</h3>

        <div className="space-y-4">
          <fieldset className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-3">
            <legend className="text-sm font-semibold text-gray-700 dark:text-gray-200 px-1">JSON contents</legend>
            <label className="flex items-start gap-3 text-sm text-gray-800 dark:text-gray-200">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={exportOptions.includeChapters}
                onChange={handleExportOptionChange('includeChapters')}
              />
              <span className="flex-1">
                Chapters & versions
                <span className="block text-xs text-gray-500 dark:text-gray-400">~{chapterSizeLabel}</span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-gray-800 dark:text-gray-200">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={exportOptions.includeTelemetry}
                onChange={handleExportOptionChange('includeTelemetry')}
              />
              <span className="flex-1">
                Telemetry events
                <span className="block text-xs text-gray-500 dark:text-gray-400">~{telemetrySizeLabel}</span>
              </span>
            </label>
            <label className={`flex items-start gap-3 text-sm ${imagesDisabled ? 'opacity-60 cursor-not-allowed' : 'text-gray-800 dark:text-gray-200'}`}>
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={exportOptions.includeImages}
                onChange={handleExportOptionChange('includeImages')}
                disabled={imagesDisabled}
              />
              <span className="flex-1">
                Illustrations (Cache API)
                <span className="block text-xs text-gray-500 dark:text-gray-400">{imageUsageLabel}</span>
                {imagesDisabled && (
                  <span className="block text-xs text-amber-600 dark:text-amber-400 mt-1">Enable chapters to attach illustrations.</span>
                )}
              </span>
            </label>
          </fieldset>

          {/* Export Progress Bar */}
          {exportProgress && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  {exportProgress.phase === 'done' ? '✓ Complete' : 'Exporting...'}
                </span>
                <span className="text-xs text-blue-600 dark:text-blue-300">
                  {exportProgress.current}/{exportProgress.total}
                </span>
              </div>
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 mb-2">
                <div
                  className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((exportProgress.current / Math.max(exportProgress.total, 1)) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300 truncate">
                {exportProgress.message}
              </p>
            </div>
          )}

          <button
            onClick={() => handleExportFormat('json')}
            disabled={isExporting || !hasJsonContent}
            className="w-full p-4 text-left border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="font-medium text-gray-900 dark:text-gray-100">Export JSON</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {hasJsonContent ? 'Download a session snapshot with your selected data.' : 'Select at least one data type to enable JSON export.'}
            </div>
          </button>

          <button
            onClick={() => handleExportFormat('epub')}
            disabled={isExporting}
            className="w-full p-4 text-left border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="font-medium text-gray-900 dark:text-gray-100">Export EPUB</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Generate a readable e-book with the active translations and images</div>
          </button>

          <div className="border-t border-gray-200 dark:border-gray-600 my-2" />

          <button
            onClick={onPublishClick}
            disabled={isExporting || sessionIsEmpty}
            className="w-full p-4 text-left border-2 border-purple-200 dark:border-purple-600 rounded-lg hover:border-purple-500 dark:hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="font-medium text-gray-900 dark:text-gray-100">Publish to Library</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Save to local git repo (metadata.json + session.json)
            </div>
          </button>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ExportModal;
