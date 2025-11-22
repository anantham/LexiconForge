import React from 'react';
import { DiffMarkersPanel } from './DiffMarkersPanel';
import type { TokenizationResult } from './translationTokens';
import type { UiDiffMarker } from './diffVisibility';
import type { DiffMarkerVisibilitySettings } from '../../types';

interface Props {
  translationTokensData: TokenizationResult;
  markersByPosition: Map<number, UiDiffMarker[]>;
  showHeatmap: boolean;
  markerVisibilitySettings: DiffMarkerVisibilitySettings;
  diffMarkersLoading: boolean;
  onMarkerClick: (marker: UiDiffMarker) => void;
}

const DiffParagraphs: React.FC<Props> = ({
  translationTokensData,
  markersByPosition,
  showHeatmap,
  markerVisibilitySettings,
  diffMarkersLoading,
  onMarkerClick,
}) => (
  <div className="space-y-6">
    {translationTokensData.paragraphs.map((paragraph) => (
      <DiffMarkersPanel
        key={paragraph.chunkId}
        paragraph={paragraph}
        markersByPosition={markersByPosition}
        showHeatmap={showHeatmap}
        markerVisibilitySettings={markerVisibilitySettings}
        diffMarkersLoading={diffMarkersLoading}
        onMarkerClick={onMarkerClick}
      />
    ))}
  </div>
);

export default DiffParagraphs;
