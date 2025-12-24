/**
 * Tests for useChapterTelemetry hook
 *
 * This hook captures UX performance metrics:
 * 1. Component mount time
 * 2. Chapter ready time (after loading completes)
 * 3. Selection state changes (logged for debugging)
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React, { useState } from 'react';
import { useChapterTelemetry } from '../../hooks/useChapterTelemetry';

// Mock telemetryService
const capturePerformanceMock = vi.fn();
vi.mock('../../services/telemetryService', () => ({
  telemetryService: {
    capturePerformance: (...args: unknown[]) => capturePerformanceMock(...args),
  },
}));

// Mock debugLog
const debugLogMock = vi.fn();
vi.mock('../../utils/debug', () => ({
  debugLog: (...args: unknown[]) => debugLogMock(...args),
}));

interface TestComponentProps {
  selection?: { text: string; rect: DOMRect } | null;
  currentChapterId?: string | null;
  chapters?: Map<string, unknown>;
  chapter?: { id: string } | null;
  translationResult?: { translation: string } | null;
  isLoading?: { fetching: boolean };
  translationInProgress?: boolean;
  isHydratingCurrent?: boolean;
  viewMode?: 'original' | 'fan' | 'english';
  feedbackCount?: number;
}

const TestComponent: React.FC<TestComponentProps> = ({
  selection = null,
  currentChapterId = 'ch-1',
  chapters,
  chapter = { id: 'ch-1' },
  translationResult = { translation: 'text' },
  isLoading = { fetching: false },
  translationInProgress = false,
  isHydratingCurrent = false,
  viewMode = 'english' as const,
  feedbackCount = 0,
}) => {
  useChapterTelemetry({
    selection,
    currentChapterId,
    chapters:
      chapters ??
      (currentChapterId && chapter ? new Map([[currentChapterId, chapter]]) : new Map()),
    chapter,
    translationResult,
    isLoading,
    translationInProgress,
    isHydratingCurrent,
    viewMode,
    feedbackCount,
  });
  return <div data-testid="test-component">Rendered</div>;
};

describe('useChapterTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('mount performance', () => {
    it('captures mount time on initial render', () => {
      render(<TestComponent />);

      expect(capturePerformanceMock).toHaveBeenCalledWith(
        'ux:component:ChapterView:mount',
        expect.any(Number),
        expect.objectContaining({
          chapterId: 'ch-1',
          hasChapter: true,
        })
      );
    });

    it('reports hasChapter=false when chapter not in map initially', () => {
      render(
        <TestComponent
          currentChapterId="missing-chapter"
          chapters={new Map()}
          chapter={null}
          translationResult={null}
        />
      );

      expect(capturePerformanceMock).toHaveBeenCalledWith(
        'ux:component:ChapterView:mount',
        expect.any(Number),
        expect.objectContaining({
          chapterId: 'missing-chapter',
          hasChapter: false,
        })
      );
    });
  });

  describe('chapter ready performance', () => {
    it('captures ready time when chapter finishes loading', () => {
      // Start with loading state
      const { rerender } = render(
        <TestComponent
          isLoading={{ fetching: true }}
          chapter={null}
          translationResult={null}
        />
      );

      // Clear the mount call
      capturePerformanceMock.mockClear();

      // Simulate loading complete
      rerender(
        <TestComponent
          isLoading={{ fetching: false }}
          chapter={{ id: 'ch-1' }}
          translationResult={{ translation: 'Done' }}
        />
      );

      expect(capturePerformanceMock).toHaveBeenCalledWith(
        'ux:component:ChapterView:ready',
        expect.any(Number),
        expect.objectContaining({
          chapterId: 'ch-1',
          hasTranslation: true,
          viewMode: 'english',
          feedbackCount: 0,
        })
      );
    });

    it('does not capture ready if still loading', () => {
      const { rerender } = render(
        <TestComponent isLoading={{ fetching: true }} />
      );

      capturePerformanceMock.mockClear();

      // Still loading - should not capture ready
      rerender(<TestComponent isLoading={{ fetching: true }} />);

      expect(capturePerformanceMock).not.toHaveBeenCalledWith(
        'ux:component:ChapterView:ready',
        expect.any(Number),
        expect.anything()
      );
    });

    it('does not capture ready if translation in progress', () => {
      const { rerender } = render(
        <TestComponent translationInProgress={true} />
      );

      capturePerformanceMock.mockClear();

      rerender(<TestComponent translationInProgress={true} />);

      expect(capturePerformanceMock).not.toHaveBeenCalledWith(
        'ux:component:ChapterView:ready',
        expect.any(Number),
        expect.anything()
      );
    });
  });

  describe('selection logging', () => {
    it('logs selection updates via debugLog', () => {
      const rect = new DOMRect(100, 200, 50, 20);
      const selection = { text: 'Selected text for comparison', rect };

      render(<TestComponent selection={selection} />);

      expect(debugLogMock).toHaveBeenCalledWith(
        'comparison',
        'summary',
        '[ChapterView] Selection state updated',
        expect.objectContaining({
          text: 'Selected text for comparison',
          textLength: 28,
          rectTop: 200,
          rectLeft: 100,
        })
      );
    });

    it('truncates long selection text in log', () => {
      const longText = 'A'.repeat(100);
      const rect = new DOMRect();
      const selection = { text: longText, rect };

      render(<TestComponent selection={selection} />);

      expect(debugLogMock).toHaveBeenCalledWith(
        'comparison',
        'summary',
        '[ChapterView] Selection state updated',
        expect.objectContaining({
          text: 'A'.repeat(50) + '...',
          textLength: 100,
        })
      );
    });

    it('does not log when selection is null', () => {
      render(<TestComponent selection={null} />);

      expect(debugLogMock).not.toHaveBeenCalled();
    });
  });
});
