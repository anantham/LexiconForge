import React, { useState, useEffect, useRef } from 'react';
import RefreshIcon from '../icons/RefreshIcon';
import type { UsageMetrics } from '../../types';
import type { ImageGenerationMetrics } from '../../services/imageGenerationService';
import { apiMetricsService } from '../../services/apiMetricsService';

interface Props {
  currentChapterId: string | null;
  viewMode: 'original' | 'fan' | 'english';
  isLoading: boolean;
  isTranslating: boolean;
  canManualRetranslate: boolean;
  retranslateSettingsChanged: boolean;
  isRetranslationActive: boolean;
  onRetranslateClick: () => void;
  providerLabel?: string;
  modelLabel?: string;
  usageMetrics: UsageMetrics | null;
  showUsageMetrics: boolean;
  imageMetrics: ImageGenerationMetrics | null;
  showImageMetrics: boolean;
}

/** Compact inline timer for retranslation — shows elapsed and ETA */
const RetranslationTimer: React.FC<{ provider: string; model?: string }> = ({ provider, model }) => {
  const [elapsed, setElapsed] = useState(0);
  const [estimatedTotal, setEstimatedTotal] = useState<number | null>(null);
  const startRef = useRef(Date.now());
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    apiMetricsService.getAverageTranslationTime(model || '', provider).then((data) => {
      setEstimatedTotal(data.avgTimeSeconds);
    });
  }, [model, provider]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const remaining = estimatedTotal ? Math.max(0, Math.ceil(estimatedTotal - elapsed)) : null;

  return (
    <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">
      · {elapsed}s{remaining !== null && remaining > 0 ? ` / ~${remaining + elapsed}s` : remaining === 0 ? ' · almost done' : ''}
    </span>
  );
};

const formatActualParams = (params?: UsageMetrics['actualParams']) => {
  if (!params) return '';
  const entries: string[] = [];
  if (params.temperature !== undefined) entries.push(`temp=${params.temperature}`);
  if (params.topP !== undefined) entries.push(`top_p=${params.topP}`);
  if (params.frequencyPenalty !== undefined) entries.push(`freq_pen=${params.frequencyPenalty}`);
  if (params.presencePenalty !== undefined) entries.push(`pres_pen=${params.presencePenalty}`);
  if (params.seed !== undefined && params.seed !== null) entries.push(`seed=${params.seed}`);
  return entries.length ? ` [${entries.join(', ')}]` : '';
};

const TranslationStatusPanel: React.FC<Props> = ({
  viewMode,
  isLoading,
  isTranslating,
  canManualRetranslate,
  retranslateSettingsChanged,
  isRetranslationActive,
  onRetranslateClick,
  providerLabel,
  modelLabel,
  usageMetrics,
  showUsageMetrics,
  imageMetrics,
  showImageMetrics,
}) => {
  const retranslateDisabled = !canManualRetranslate && !isRetranslationActive;
  const buttonClasses = isRetranslationActive
    ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/40'
    : canManualRetranslate && retranslateSettingsChanged
      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300'
      : canManualRetranslate
        ? 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
        : 'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';

  return (
    <div className="space-y-2 mb-4">
      {isTranslating && viewMode === 'english' && (
        <div className="text-xs text-center text-gray-500 dark:text-gray-400">
          Translating: <span className="font-semibold">{providerLabel}</span>
          {modelLabel ? ` — ${modelLabel}` : ''}
          <RetranslationTimer provider={providerLabel || ''} model={modelLabel} />
        </div>
      )}

      {showUsageMetrics && usageMetrics && !isLoading && !isTranslating && (
        <div className="text-xs text-center text-gray-500 dark:text-gray-400">
          {/* Handle unknown/missing metrics gracefully */}
          {usageMetrics.model && usageMetrics.model !== 'unknown' ? (
            <>
              Translated in {usageMetrics.requestTime.toFixed(2)}s with{' '}
              <span className="font-semibold">{usageMetrics.model}</span>
              {formatActualParams(usageMetrics.actualParams)} (~${usageMetrics.estimatedCost.toFixed(5)})
            </>
          ) : (
            <span className="italic text-gray-400 dark:text-gray-500">
              Translation metrics unavailable (legacy data)
            </span>
          )}
        </div>
      )}

      {showImageMetrics && imageMetrics && !isLoading && !isTranslating && (
        <div className="text-xs text-center text-gray-500 dark:text-gray-400">
          Generated {imageMetrics.count} images{imageMetrics.lastModel ? ` with ${imageMetrics.lastModel}` : ''}
          {' '}in {imageMetrics.totalTime.toFixed(2)}s (~${imageMetrics.totalCost.toFixed(5)})
        </div>
      )}
    </div>
  );
};

export default TranslationStatusPanel;
