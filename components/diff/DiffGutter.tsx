import React, { useRef } from 'react';
import { DiffPip } from './DiffPip';
import type { DiffMarker } from '../../services/diff/types';
import styles from './DiffGutter.module.css';

interface DiffGutterProps {
  markers: DiffMarker[];
  onMarkerClick: (marker: DiffMarker) => void;
}

export function DiffGutter({ markers, onMarkerClick }: DiffGutterProps) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const maxPosition = markers.reduce((max, marker) => Math.max(max, marker.position), 0);

  if (markers.length === 0) return null;

  return (
    <div ref={gutterRef} className={styles.gutter} aria-label="Diff markers">
      {markers.map((marker, index) => {
        const denominator = maxPosition > 0 ? maxPosition : 1;
        const scrollPercentage = maxPosition > 0
          ? (marker.position / denominator) * 100
          : 0;
        const clampedPercentage = Math.max(0, Math.min(scrollPercentage, 100));
        const key = `${marker.chunkId}-${index}`;

        return (
          <div
            key={key}
            className={styles.gutterMarker}
            style={{ top: `${clampedPercentage}%` }}
            data-position={marker.position}
          >
            <DiffPip
              colors={marker.colors}
              onClick={() => onMarkerClick(marker)}
              aria-label={`Diff at paragraph ${marker.position + 1}: ${marker.reasons.join(', ')}`}
            />
          </div>
        );
      })}
    </div>
  );
}
