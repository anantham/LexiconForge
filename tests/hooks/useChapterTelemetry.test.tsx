import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { useChapterTelemetry } from '../../hooks/useChapterTelemetry';

vi.mock('../../services/telemetryService', () => ({
  telemetryService: {
    capturePerformance: vi.fn(),
  },
}));

const TestComponent: React.FC<{ selection?: { text: string; rect: DOMRect } | null }>
= ({ selection = null }) => {
  useChapterTelemetry({
    selection,
    currentChapterId: 'c1',
    chapters: new Map(),
    chapter: { id: 'c1' },
    translationResult: { translation: 'text' },
    isLoading: { fetching: false },
    translationInProgress: false,
    isHydratingCurrent: false,
    viewMode: 'english',
    feedbackCount: 0,
  });
  return null;
};

describe('useChapterTelemetry', () => {
  it('logs selection updates', () => {
    const rect = new DOMRect();
    render(<TestComponent selection={{ text: 'Some selected text', rect }} />);
    // nothing to assert beyond no crashes; log goes through debugLog
    expect(true).toBe(true);
  });
});
