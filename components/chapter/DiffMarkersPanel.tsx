import React, { useMemo } from 'react';
import type { DiffMarkerVisibilitySettings } from '../../types';
import { DiffPip } from '../diff/DiffPip';
import type { TranslationParagraph } from './translationTokens';
import type { UiDiffMarker } from './diffVisibility';

interface DiffMarkersPanelProps {
  paragraph: TranslationParagraph;
  markersByPosition: Map<number, UiDiffMarker[]>;
  showHeatmap: boolean;
  markerVisibilitySettings: DiffMarkerVisibilitySettings;
  diffMarkersLoading: boolean;
  onMarkerClick: (marker: UiDiffMarker) => void;
}

export const DiffMarkersPanel: React.FC<DiffMarkersPanelProps> = ({
  paragraph,
  markersByPosition,
  showHeatmap,
  markerVisibilitySettings,
  diffMarkersLoading,
  onMarkerClick,
}) => {
  const markersForParagraph = useMemo(() => (!diffMarkersLoading && markersByPosition.get(paragraph.position)) || [], [
    diffMarkersLoading,
    markersByPosition,
    paragraph.position,
  ]);
  const hasMarkers = showHeatmap && markersForParagraph.length > 0;
  const primaryGreyExplanation =
    markersForParagraph[0]?.displayExplanations?.[0]?.trim() || '';

  return (
    <div
      data-lf-chunk={paragraph.chunkId}
      data-diff-position={paragraph.position}
      data-testid={`diff-paragraph-${paragraph.chunkId}`}
      className={`relative scroll-mt-32 ${showHeatmap ? 'pr-12' : ''}`}
    >
      {showHeatmap && (
        <div
          className="pointer-events-none absolute top-1 right-0 flex flex-col items-end gap-2"
          data-testid="diff-gutter"
        >
          {hasMarkers ? (
            markersForParagraph.map((marker, markerIdx) => (
              <div
                key={`${paragraph.chunkId}-marker-${markerIdx}`}
                className="pointer-events-auto group/marker"
                data-testid={`diff-pip-${marker.chunkId}`}
                data-diff-position={marker.position}
              >
                <DiffPip
                  colors={marker.displayColors}
                  onClick={() => onMarkerClick(marker)}
                  confidence={marker.confidence}
                  aria-label={`Diff marker for paragraph ${paragraph.position + 1}`}
                />
                {marker.displayExplanations.length > 0 && (
                  <div className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/marker:opacity-100 transition-opacity duration-150 bg-gray-900 text-white text-xs leading-relaxed rounded-md px-3 py-2 shadow-lg max-w-xs">
                    {marker.displayReasons.map((reason, reasonIdx) => (
                      <div key={`${marker.chunkId}-reason-${reasonIdx}`} className="mt-1 first:mt-0">
                        <span className="font-semibold capitalize">{reason.replace(/-/g, ' ')}:</span>
                        <span className="ml-1">{marker.displayExplanations[reasonIdx] || 'No explanation provided.'}</span>
                      </div>
                    ))}
                    {typeof marker.confidence === 'number' && (
                      <div className="mt-2 text-xs text-gray-300">
                        Confidence {(Math.round((marker.confidence || 0) * 100))}%
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <span className="block w-2 h-2 rounded-full opacity-0" />
          )}
        </div>
      )}
      <div className="whitespace-pre-wrap leading-relaxed" data-lf-type="text">
        {paragraph.nodes}
        {hasMarkers &&
          markerVisibilitySettings.stylistic &&
          markersForParagraph.length === 1 &&
          markersForParagraph[0].displayColors.includes('grey') &&
          primaryGreyExplanation && (
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {primaryGreyExplanation}
          </div>
        )}
      </div>
    </div>
  );
};
