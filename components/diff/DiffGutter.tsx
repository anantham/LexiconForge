import React, { useEffect, useState, useRef } from 'react';
import { DiffPip } from './DiffPip';
import type { DiffMarker } from '../../services/diff/types';
import styles from './DiffGutter.module.css';

interface DiffGutterProps {
  markers: DiffMarker[];
  onMarkerClick: (marker: DiffMarker) => void;
}

export function DiffGutter({ markers, onMarkerClick }: DiffGutterProps) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>(0);

  useEffect(() => {
    // Calculate total scrollable content height
    const updateHeight = () => {
      const content = document.querySelector('[data-translation-content]') as HTMLElement;
      if (content) {
        setContentHeight(content.scrollHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [markers]);

  if (markers.length === 0) return null;

  return (
    <div ref={gutterRef} className={styles.gutter} aria-label="Diff markers">
      {markers.map((marker) => {
        // Calculate position as percentage of content height
        const scrollPercentage = contentHeight > 0
          ? (marker.aiRange.start / contentHeight) * 100
          : marker.position * 10; // Fallback to position-based

        return (
          <div
            key={marker.chunkId}
            className={styles.gutterMarker}
            style={{ top: `${scrollPercentage}%` }}
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
