import { useMemo } from 'react';
import { useDiffMarkers } from './useDiffMarkers';
import { useDiffNavigation } from './useDiffNavigation';
import type { DiffMarkerVisibilitySettings } from '../types';
import type { UiDiffMarker } from '../components/chapter/diffVisibility';
import { mapMarkerForVisibility } from '../components/chapter/diffVisibility';

export const useChapterDiffs = (
  chapterId: string | null,
  visibilitySettings: DiffMarkerVisibilitySettings,
  heatmapEnabled: boolean
) => {
  const { markers, loading } = useDiffMarkers(chapterId);

  const visibleMarkers = useMemo(
    () =>
      markers
        .map((marker) => mapMarkerForVisibility(marker, visibilitySettings))
        .filter((marker): marker is UiDiffMarker => marker !== null),
    [markers, visibilitySettings]
  );

  const markersByPosition = useMemo(() => {
    const map = new Map<number, UiDiffMarker[]>();
    for (const marker of visibleMarkers) {
      const list = map.get(marker.position);
      if (list) {
        list.push(marker);
      } else {
        map.set(marker.position, [marker]);
      }
    }
    return map;
  }, [visibleMarkers]);

  useDiffNavigation(visibleMarkers, heatmapEnabled);

  return {
    diffMarkersLoading: loading,
    visibleMarkers,
    markersByPosition,
  };
};
