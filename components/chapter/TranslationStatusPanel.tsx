import React, { useState, useEffect, useRef } from 'react';
import type { UsageMetrics } from '../../types';
import type { ImageGenerationMetrics } from '../../services/imageGenerationService';
import { apiMetricsService } from '../../services/apiMetricsService';

interface Props {
  viewMode: 'original' | 'fan' | 'english';
  isLoading: boolean;
  isTranslating: boolean;
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
  // Issue #13: track source + confidence so the compact timer can match
  // ChapterContent's transparency about data-quality and suppress numeric
  // ETA when we have no signal at all.
  const [source, setSource] = useState<'model' | 'provider' | 'global' | 'default' | null>(null);
  const [sampleCount, setSampleCount] = useState<number>(0);
  const startRef = useRef(Date.now());
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    apiMetricsService.getAverageTranslationTime(model || '', provider).then((data) => {
      setEstimatedTotal(data.avgTimeSeconds);
      setSource(data.source);
      setSampleCount(data.sampleCount);
    });
  }, [model, provider]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Issue #13: when source === 'default' (no historical data), suppress the
  // numeric ETA and show "Estimating…" — pretending we know is misleading.
  if (source === 'default') {
    return (
      <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">
        · {elapsed}s · estimating…
      </span>
    );
  }

  const remaining = estimatedTotal ? Math.max(0, Math.ceil(estimatedTotal - elapsed)) : null;
  const sourceLabel = source === 'model'
    ? `${sampleCount} past call${sampleCount === 1 ? '' : 's'}`
    : source === 'provider'
    ? `${sampleCount} provider calls`
    : source === 'global'
    ? `${sampleCount} global`
    : null;

  return (
    <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">
      · {elapsed}s{remaining !== null && remaining > 0 ? ` / ~${remaining + elapsed}s` : remaining === 0 ? ' · almost done' : ''}
      {sourceLabel && <span className="ml-1 opacity-70">({sourceLabel})</span>}
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
  providerLabel,
  modelLabel,
  usageMetrics,
  showUsageMetrics,
  imageMetrics,
  showImageMetrics,
}) => {
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
