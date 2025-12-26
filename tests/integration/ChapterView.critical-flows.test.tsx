/**
 * ChapterView Critical User Flows
 *
 * This file intentionally contains ONLY Flow #1 (diff markers).
 *
 * Other flows were split out to keep files small and to place layout/perf
 * assertions into Playwright where the browser can provide real geometry:
 * - Flow #2 (inline edit): `tests/integration/ChapterView.inline-edit.test.tsx`
 * - Flow #3/#4 (perf + media/layout): `tests/e2e/chapterview.*.spec.ts`
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ChapterView from '../../components/ChapterView';
import type { DiffMarker } from '../../services/diff/types';

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

if (!HTMLElement.prototype.scrollIntoView) {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    writable: true,
    value: vi.fn(),
  });
}

vi.mock('../../components/AudioPlayer', () => ({
  __esModule: true,
  default: () => null,
}));

const mockChapter = {
  id: 'test-chapter-001',
  title: 'Mock Chapter',
  content: 'Original content paragraph one.',
  prevUrl: null as string | null,
  nextUrl: null as string | null,
  fanTranslation: null as string | null,
  translationResult: null as any,
};

// Mock dependencies
vi.mock('../../store', () => ({
  useAppStore: vi.fn((selector) => {
    const state = {
      settings: {
        fontSize: 16,
        fontStyle: 'sans' as const,
        lineHeight: 1.6,
        showDiffHeatmap: true,
        diffMarkerVisibility: {
          fan: true,
          rawLoss: true,
          rawGain: true,
          sensitivity: true,
          stylistic: true,
        }
      },
      chapters: new Map([[mockChapter.id, mockChapter]]),
      currentChapterId: 'test-chapter-001',
      viewMode: 'english',
      setViewMode: vi.fn(),
      showNotification: vi.fn(),
      updateTranslationInline: vi.fn(),
      isTranslationActive: () => false,
      activeTranslations: {},
      hydratingChapters: {},
      isLoading: {
        fetching: false,
      },
      shouldEnableRetranslation: () => false,
      translationResults: new Map([[mockChapter.id, mockChapter.translationResult]]),
    };
    return selector ? selector(state) : state;
  })
}));

vi.mock('../../hooks/useDiffMarkers', () => ({
  useDiffMarkers: vi.fn(() => ({
    markers: [],
    loading: false,
  }))
}));

vi.mock('../../hooks/useDiffNavigation', () => ({
  useDiffNavigation: vi.fn(() => ({
    currentIndex: 0,
    totalMarkers: 0,
    navigateToNext: vi.fn(),
    navigateToPrevious: vi.fn(),
  }))
}));

/**
 * Test helpers
 */
const createMockTranslation = (paragraphCount: number = 3): string => {
  const paragraphs: string[] = [];
  for (let i = 0; i < paragraphCount; i++) {
    paragraphs.push(`This is paragraph ${i + 1} of the translation.`);
  }
  return paragraphs.join('<br><br>');
};

const createMockDiffMarkers = (count: number): DiffMarker[] => {
  const markers: DiffMarker[] = [];
  for (let i = 0; i < count; i++) {
    markers.push({
      chunkId: `para-${i}-test`,
      colors: ['blue', 'orange'],
      reasons: ['fan-divergence', 'raw-divergence'],
      explanations: [`Marker ${i + 1} explanation`],
      aiRange: { start: i * 100, end: (i + 1) * 100 },
      position: i,
    });
  }
  return markers;
};

describe('ChapterView: Critical Flow #1 - Diff Markers Visible & Positioned', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChapter.translationResult = null;
  });

  afterEach(() => {
    mockChapter.translationResult = null;
  });

  it('[Flow 1] renders diff markers in gutter with correct counts', async () => {
    const { useDiffMarkers } = await import('../../hooks/useDiffMarkers');

    const mockMarkers = createMockDiffMarkers(5);
    vi.mocked(useDiffMarkers).mockReturnValue({
      markers: mockMarkers,
      loading: false,
    });

    const translation = createMockTranslation(5);
    mockChapter.translationResult = {
      translatedTitle: 'Test Chapter',
      translation,
      proposal: null,
      footnotes: [],
      suggestedIllustrations: [],
      usageMetrics: {
        totalTokens: 100,
        promptTokens: 60,
        completionTokens: 40,
        estimatedCost: 0.001,
        requestTime: 2,
        provider: 'Gemini',
        model: 'gemini-2.5-flash',
      }
    };

    render(<ChapterView />);

    const gutters = await screen.findAllByTestId('diff-gutter');
    expect(gutters.length).toBeGreaterThan(0);

    const pips = Array.from(document.querySelectorAll('[data-testid^="diff-pip-"]'));
    expect(pips.length).toBeGreaterThan(0);
    expect(pips.length).toBeGreaterThanOrEqual(mockMarkers.length);
  });

  it('[Flow 1] clicking marker pip scrolls to correct paragraph', async () => {
    const { useDiffMarkers } = await import('../../hooks/useDiffMarkers');

    const mockMarkers = createMockDiffMarkers(3);
    vi.mocked(useDiffMarkers).mockReturnValue({
      markers: mockMarkers,
      loading: false,
    });

    const translation = createMockTranslation(3);
    mockChapter.translationResult = {
      translatedTitle: 'Test',
      translation,
      proposal: null,
      footnotes: [],
      suggestedIllustrations: [],
      usageMetrics: {
        totalTokens: 100,
        promptTokens: 60,
        completionTokens: 40,
        estimatedCost: 0.001,
        requestTime: 2,
        provider: 'Gemini',
        model: 'gemini-2.5-flash',
      }
    };

    render(<ChapterView />);

    await waitFor(() => {
      const pips = document.querySelectorAll('[data-testid^="diff-pip-"]');
      expect(pips.length).toBeGreaterThan(0);
    });

    const scrollSpy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});

    const firstMarkerContainer = Array.from(document.querySelectorAll('[data-testid^="diff-pip-"]'))[0] as HTMLElement;
    const firstButton = within(firstMarkerContainer).getAllByRole('button')[0];
    fireEvent.click(firstButton);

    const diffPosition = firstMarkerContainer.getAttribute('data-diff-position');
    const firstParagraph = diffPosition
      ? document.querySelector(`[data-diff-position="${diffPosition}"]`)
      : null;
    expect(scrollSpy).toHaveBeenCalled();
    expect(scrollSpy.mock.instances[0]).toBe(firstParagraph);

    scrollSpy.mockRestore();
  });
});
