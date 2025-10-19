import { describe, it, expect } from 'vitest';
import type { DiffMarker } from '../../../services/diff/types';
import type { DiffMarkerVisibilitySettings } from '../../../types';
import { __testables } from '../../../components/ChapterView';

const { mapMarkerForVisibility } = __testables;

const baseMarker: DiffMarker = {
  chunkId: 'para-0-test',
  colors: ['grey'],
  reasons: ['no-change'],
  aiRange: { start: 0, end: 20 },
  position: 0,
};

const fullVisibility: DiffMarkerVisibilitySettings = {
  fan: true,
  rawLoss: true,
  rawGain: true,
  sensitivity: true,
  stylistic: true,
};

describe('ChapterView mapMarkerForVisibility', () => {
  it('trims whitespace-only explanations', () => {
    const markerWithWhitespace: DiffMarker = {
      ...baseMarker,
      explanations: ['   '],
    };

    const result = mapMarkerForVisibility(markerWithWhitespace, fullVisibility);

    expect(result).not.toBeNull();
    expect(result?.displayExplanations[0]).toBe('');
  });

  it('preserves meaningful explanations', () => {
    const explanation = 'Fan translation adds cultural note.';
    const markerWithExplanation: DiffMarker = {
      ...baseMarker,
      reasons: ['fan-divergence'],
      explanations: [explanation],
    };

    const result = mapMarkerForVisibility(markerWithExplanation, fullVisibility);

    expect(result).not.toBeNull();
    expect(result?.displayExplanations[0]).toBe(explanation);
  });
});
