import React from 'react';
import type { DiffColor } from '../../services/diff/types';
import styles from './DiffPip.module.css';

interface DiffPipProps {
  colors: DiffColor[];
  onClick: () => void;
  'aria-label'?: string;
}

const COLOR_PRIORITY: Record<DiffColor, number> = {
  orange: 0,
  red: 1,
  green: 2,
  grey: 3
};

export function DiffPip({ colors, onClick, 'aria-label': ariaLabel }: DiffPipProps) {
  // Sort colors by priority
  const sortedColors = [...colors].sort((a, b) => COLOR_PRIORITY[a] - COLOR_PRIORITY[b]);

  // Stacking logic: max 2 visible + halo for 3+
  const visibleColors = sortedColors.slice(0, 2);
  const hasHalo = sortedColors.length > 2;

  if (visibleColors.length === 1) {
    // Single color: solid pip
    return (
      <button
        className={styles.pip}
        style={{ backgroundColor: `var(--diff-${visibleColors[0]})` }}
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
            transform: `translateX(${index * 4}px)`
          }}
          onClick={onClick}
          aria-label={ariaLabel || `Diff marker: ${sortedColors.join(', ')}`}
        />
      ))}
    </div>
  );
}
