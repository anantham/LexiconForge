import React from 'react';
import type { DiffColor } from '../../services/diff/types';
import styles from './DiffPip.module.css';

interface DiffPipProps {
  colors: DiffColor[];
  onClick: () => void;
  confidence?: number;
  'aria-label'?: string;
}

type DiffPipColor = DiffColor;

const COLOR_PRIORITY: Record<DiffPipColor, number> = {
  red: 0,
  orange: 1,
  purple: 2,
  blue: 3,
  grey: 4,
  green: 5,
};

const normalizeColor = (color: DiffPipColor): DiffPipColor => {
  if (color === 'green') {
    return 'orange';
  }
  return color;
};

export function DiffPip({ colors, onClick, confidence, 'aria-label': ariaLabel }: DiffPipProps) {
  const normalizedColors = Array.from(
    new Set(colors.map(normalizeColor))
  ) as DiffPipColor[];

  // Sort colors by priority
  const sortedColors = [...normalizedColors].sort((a, b) => COLOR_PRIORITY[a] - COLOR_PRIORITY[b]);

  // Stacking logic: max 2 visible + halo for 3+
  const visibleColors = sortedColors.slice(0, 2);
  const hasHalo = sortedColors.length > 2;
  const clampedConfidence = typeof confidence === 'number' ? Math.min(Math.max(confidence, 0), 1) : 1;
  const pipOpacity = 0.3 + clampedConfidence * 0.7;

  if (visibleColors.length === 1) {
    // Single color: solid pip
    return (
      <button
        className={styles.pip}
        style={{ backgroundColor: `var(--diff-${visibleColors[0]})`, opacity: pipOpacity }}
        onClick={onClick}
        aria-label={ariaLabel || `Diff marker: ${visibleColors[0]}`}
      />
    );
  }

  // Multiple colors: stacked pips
  return (
    <div
      className={`${styles.pipContainer} ${hasHalo ? styles.hasHalo : ''}`}
      data-testid="diff-pip-container"
    >
      {visibleColors.map((color, index) => (
        <button
          key={`${color}-${index}`}
          className={`${styles.pip} ${styles.stacked}`}
          style={{
            backgroundColor: `var(--diff-${color})`,
            transform: `translateX(${index * 4}px)`,
            opacity: pipOpacity,
          }}
          onClick={onClick}
          aria-label={ariaLabel || `Diff marker: ${sortedColors.join(', ')}`}
        />
      ))}
    </div>
  );
}
