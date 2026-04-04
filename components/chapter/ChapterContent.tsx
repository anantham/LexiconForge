import React, { useState, useEffect, useRef } from 'react';
import Loader from '../Loader';
import DiffParagraphs from './DiffParagraphs';
import InlineEditToolbar from './InlineEditToolbar';
import TranslationEditor from './TranslationEditor';
import { apiMetricsService } from '../../services/apiMetricsService';
import type { AppSettings, Chapter, DiffMarkerVisibilitySettings } from '../../types';
import type { TokenizationResult } from './translationTokens';
import type { UiDiffMarker } from './diffVisibility';
import type { InlineEditState } from '../../hooks/useInlineTranslationEditor';
import { clientTelemetry } from '../../services/clientTelemetry';
import type { TelemetryErrorContext } from '../../types/telemetry';

interface ChapterContentProps {
  chapter: Chapter | null;
  settings: AppSettings;
  isGlobalLoading: boolean;
  isTranslating: boolean;
  isHydrating: boolean;
  editableContainerRef: React.RefObject<HTMLDivElement>;
  contentRef: React.RefObject<HTMLDivElement>;
  isEditing: boolean;
  editedContent: string;
  onEditChange: (value: string) => void;
  translationTokensData: TokenizationResult;
  markersByPosition: Map<number, UiDiffMarker[]>;
  markerVisibilitySettings: DiffMarkerVisibilitySettings;
  diffMarkersLoading: boolean;
  onMarkerClick: (marker: UiDiffMarker) => void;
  inlineEditState: InlineEditState | null;
  toolbarCoords: { top: number; left: number } | null;
  saveInlineEdit: () => void;
  cancelInlineEdit: () => void;
  toggleInlineNewVersion: () => void;
  contentToDisplay: React.ReactNode;
  providerLabel: string;
  modelLabel?: string;
  renderEnglishDiffs: boolean;
  showEnglishLoader: boolean;
  translationError?: string | null;
  translationErrorTelemetry?: TelemetryErrorContext | null;
}

const ChapterContent: React.FC<ChapterContentProps> = ({
  chapter,
  settings,
  isGlobalLoading,
  isTranslating,
  isHydrating,
  editableContainerRef,
  contentRef,
  isEditing,
  editedContent,
  onEditChange,
  translationTokensData,
  markersByPosition,
  markerVisibilitySettings,
  diffMarkersLoading,
  onMarkerClick,
  inlineEditState,
  toolbarCoords,
  saveInlineEdit,
  cancelInlineEdit,
  toggleInlineNewVersion,
  contentToDisplay,
  providerLabel,
  modelLabel,
  renderEnglishDiffs,
  showEnglishLoader,
  translationError,
  translationErrorTelemetry,
}) => {
  React.useEffect(() => {
    if (!translationError) {
      return;
    }

    clientTelemetry.emit({
      eventType: 'ui_error_rendered',
      failureType: translationErrorTelemetry?.failureType ?? 'unknown',
      surface: 'ui_render',
      severity: translationErrorTelemetry?.expected ? 'warning' : 'error',
      expected: translationErrorTelemetry?.expected ?? false,
      userVisible: true,
      provider: translationErrorTelemetry?.provider ?? settings.provider,
      model: translationErrorTelemetry?.model ?? settings.model,
      chapterId: translationErrorTelemetry?.chapterId ?? null,
      errorMessage: translationError,
      dedupeAll: true,
    });
  }, [
    settings.model,
    settings.provider,
    translationError,
    translationErrorTelemetry?.chapterId,
    translationErrorTelemetry?.expected,
    translationErrorTelemetry?.failureType,
    translationErrorTelemetry?.model,
    translationErrorTelemetry?.provider,
  ]);

  if (isGlobalLoading) {
    return <Loader text="Fetching chapter raws..." />;
  }

  if (!chapter) {
    return (
      <div className="text-center py-10 text-gray-500 dark:text-gray-400">
        <h2 className="text-2xl font-bold mb-2">Welcome!</h2>
        <p>Enter a web novel chapter URL above to get started.</p>
      </div>
    );
  }

  if (translationError) {
    return (
      <div className="text-center py-10">
        <div className="inline-block max-w-md p-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">Translation Failed</h3>
          <p className="text-sm text-red-600 dark:text-red-400 whitespace-pre-line">{translationError}</p>
        </div>
      </div>
    );
  }

  if (showEnglishLoader) {
    return (
      <TranslationCountdownLoader
        provider={providerLabel}
        model={modelLabel}
      />
    );
  }

  if (isHydrating && !isTranslating) {
    return <Loader text="Loading chapter from cache..." />;
  }

  return (
    <div className="relative" ref={editableContainerRef}>
      {isEditing ? (
        <TranslationEditor value={editedContent} onChange={onEditChange} settings={settings} />
      ) : (
        <div
          ref={contentRef}
          data-translation-content
          className={`prose prose-lg dark:prose-invert max-w-none whitespace-pre-wrap ${settings.fontStyle === 'serif' ? 'font-serif' : 'font-sans'}`}
          style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
        >
          {renderEnglishDiffs ? (
            <DiffParagraphs
              translationTokensData={translationTokensData}
              markersByPosition={markersByPosition}
              showHeatmap={settings.showDiffHeatmap !== false}
              markerVisibilitySettings={markerVisibilitySettings}
              diffMarkersLoading={diffMarkersLoading}
              onMarkerClick={onMarkerClick}
            />
          ) : (
            contentToDisplay
          )}
        </div>
      )}

      {inlineEditState && toolbarCoords && (
        <InlineEditToolbar
          inlineEditState={inlineEditState}
          toolbarCoords={toolbarCoords}
          onSave={saveInlineEdit}
          onCancel={cancelInlineEdit}
          onToggleNewVersion={toggleInlineNewVersion}
        />
      )}
    </div>
  );
};

/** Countdown loader for translation — uses historical timing data */
const TranslationCountdownLoader: React.FC<{ provider: string; model?: string }> = ({ provider, model }) => {
  const [estimatedTotal, setEstimatedTotal] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [source, setSource] = useState<string>('');
  const startRef = useRef(Date.now());
  const fetchedRef = useRef(false);

  // Fetch historical average once on mount
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    apiMetricsService.getAverageTranslationTime(model || '', provider).then((data) => {
      setEstimatedTotal(data.avgTimeSeconds);
      setSource(data.source === 'default' ? '' : `${data.sampleCount} past calls`);
    });
  }, [model, provider]);

  // Tick elapsed every second
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const remaining = estimatedTotal ? Math.max(0, Math.ceil(estimatedTotal - elapsed)) : null;
  const progress = estimatedTotal && estimatedTotal > 0
    ? Math.min(100, (elapsed / estimatedTotal) * 100)
    : null;

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">
        Translating with {provider}{model ? ` — ${model}` : ''}...
      </p>
      {remaining !== null && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {remaining > 0 ? `~${remaining}s remaining` : 'Almost done...'}
          {source && <span className="ml-1 text-xs text-gray-400">({source})</span>}
        </p>
      )}
      {progress !== null && (
        <div className="mt-3 w-48 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{elapsed}s elapsed</p>
    </div>
  );
};

export default ChapterContent;
