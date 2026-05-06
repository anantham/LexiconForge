/**
 * Integration test for useChapterDropdownOptions — virtual catalog + IDB
 * summaries + in-memory chapters merge.
 *
 * Pre-fix: dropdown was bounded to chapters with summaries in IDB AND/OR
 * in-memory entries. For a 3500-chapter novel where you'd visited 13,
 * dropdown showed 13 rows.
 *
 * Post-fix: dropdown shows the FULL novel range from the registry, with
 * real summaries / in-memory data overlaid for chapters that have been
 * loaded. Virtual placeholders at chapter numbers that have a real
 * counterpart get dropped (no doubles).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useChapterDropdownOptions } from '../../hooks/useChapterDropdownOptions';
import { clearCatalogCache } from '../../services/chapterCatalog';
import type { ChapterSummary } from '../../types';

// Hoisted mocks ---------------------------------------------------------

const {
  storeState,
  fetchNovelByIdMock,
  resolveCompatibleVersionMock,
  getChapterSummariesByScopeMock,
  capturePerformanceMock,
} = vi.hoisted(() => {
  const storeState: any = {
    chapters: new Map(),
    activeNovelId: null,
    activeVersionId: null,
  };
  return {
    storeState,
    fetchNovelByIdMock: vi.fn(),
    resolveCompatibleVersionMock: vi.fn(),
    getChapterSummariesByScopeMock: vi.fn(),
    capturePerformanceMock: vi.fn(),
  };
});

vi.mock('../../store', () => ({
  useAppStore: vi.fn((selector: any) => (selector ? selector(storeState) : storeState)),
}));

vi.mock('../../services/registryService', () => ({
  RegistryService: {
    fetchNovelById: fetchNovelByIdMock,
    resolveCompatibleVersion: resolveCompatibleVersionMock,
  },
}));

vi.mock('../../services/importTransformationService', () => ({
  ImportTransformationService: {
    getChapterSummaries: vi.fn().mockResolvedValue([]),
    getChapterSummariesByScope: getChapterSummariesByScopeMock,
  },
}));

vi.mock('../../services/telemetryService', () => ({
  telemetryService: { capturePerformance: capturePerformanceMock },
}));

vi.mock('../../utils/debug', () => ({
  debugLog: vi.fn(),
}));

// Helpers ---------------------------------------------------------------

const realSummary = (
  stableId: string,
  chapterNumber: number,
  overrides: Partial<ChapterSummary> = {}
): ChapterSummary => ({
  stableId,
  canonicalUrl: `https://real/${stableId}`,
  title: `Real Title for ${chapterNumber}`,
  chapterNumber,
  hasTranslation: true,
  hasImages: false,
  ...overrides,
});

const resetState = () => {
  storeState.chapters = new Map();
  storeState.activeNovelId = null;
  storeState.activeVersionId = null;
  fetchNovelByIdMock.mockReset();
  resolveCompatibleVersionMock.mockReset();
  resolveCompatibleVersionMock.mockReturnValue({
    version: null,
    requestedVersionId: null,
    resolvedVersionId: null,
    warning: null,
  });
  getChapterSummariesByScopeMock.mockReset();
  getChapterSummariesByScopeMock.mockResolvedValue([]);
  clearCatalogCache();
};

// Tests -----------------------------------------------------------------

describe('useChapterDropdownOptions — virtual catalog merge', () => {
  beforeEach(resetState);

  it('returns only in-memory entries when activeNovelId is null (manual session)', async () => {
    storeState.chapters = new Map([
      ['ch-a', { id: 'ch-a', title: 'Manual Chapter', chapterNumber: 1, originalUrl: 'u' }],
    ]);

    const { result } = renderHook(() => useChapterDropdownOptions());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Registry should NOT be queried
    expect(fetchNovelByIdMock).not.toHaveBeenCalled();
    expect(result.current.options).toHaveLength(1);
    expect(result.current.options[0].chapterNumber).toBe(1);
  });

  it('projects the full novel range from the registry as virtual entries', async () => {
    storeState.activeNovelId = 'fmc';
    storeState.activeVersionId = null;
    fetchNovelByIdMock.mockResolvedValue({
      id: 'fmc',
      metadata: { chapterCount: 5 },
      versions: [],
    });

    const { result } = renderHook(() => useChapterDropdownOptions());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.options).toHaveLength(5);
    const numbers = result.current.options.map((o) => o.chapterNumber);
    expect(numbers).toEqual([1, 2, 3, 4, 5]);
    // All should be virtual (no real data loaded)
    expect(result.current.options.every((o) => o.stableId.startsWith('virtual:'))).toBe(true);
  });

  it('overlays real IDB summary on top of virtual placeholder for the same chapterNumber', async () => {
    storeState.activeNovelId = 'fmc';
    fetchNovelByIdMock.mockResolvedValue({
      id: 'fmc',
      metadata: { chapterCount: 3 },
      versions: [],
    });
    getChapterSummariesByScopeMock.mockResolvedValue([
      realSummary('real-ch2-id', 2, { translatedTitle: 'The Crucible' }),
    ]);

    const { result } = renderHook(() => useChapterDropdownOptions());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.options).toHaveLength(3);
    // Chapter 2: should be the real one, NOT the virtual placeholder
    const ch2 = result.current.options.find((o) => o.chapterNumber === 2);
    expect(ch2?.stableId).toBe('real-ch2-id');
    expect(ch2?.translatedTitle).toBe('The Crucible');
    expect(ch2?.hasTranslation).toBe(true);
    // Chapter 1 and 3: virtual placeholders
    const ch1 = result.current.options.find((o) => o.chapterNumber === 1);
    const ch3 = result.current.options.find((o) => o.chapterNumber === 3);
    expect(ch1?.stableId.startsWith('virtual:')).toBe(true);
    expect(ch3?.stableId.startsWith('virtual:')).toBe(true);
  });

  it('overlays in-memory data on top of both virtual and real summaries', async () => {
    storeState.activeNovelId = 'fmc';
    storeState.chapters = new Map([
      ['real-ch1-id', {
        id: 'real-ch1-id',
        title: 'In-Memory Title',
        chapterNumber: 1,
        novelId: 'fmc',
        libraryVersionId: null,
        originalUrl: 'u',
        translationResult: { translatedTitle: 'Fresh Title' },
      }],
    ]);
    fetchNovelByIdMock.mockResolvedValue({
      id: 'fmc',
      metadata: { chapterCount: 3 },
      versions: [],
    });
    getChapterSummariesByScopeMock.mockResolvedValue([
      realSummary('real-ch1-id', 1, { translatedTitle: 'Stale IDB Title' }),
    ]);

    const { result } = renderHook(() => useChapterDropdownOptions());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const ch1 = result.current.options.find((o) => o.chapterNumber === 1);
    expect(ch1?.stableId).toBe('real-ch1-id');
    // In-memory translatedTitle wins over IDB
    expect(ch1?.translatedTitle).toBe('Fresh Title');
  });

  it('falls back gracefully to IDB-only when registry fetch fails', async () => {
    storeState.activeNovelId = 'offline-novel';
    fetchNovelByIdMock.mockRejectedValue(new Error('network error'));
    getChapterSummariesByScopeMock.mockResolvedValue([
      realSummary('real-1', 1),
      realSummary('real-2', 2),
    ]);

    const { result } = renderHook(() => useChapterDropdownOptions());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // No virtual entries (catalog returned []), only the two real summaries
    expect(result.current.options).toHaveLength(2);
    expect(result.current.options.every((o) => !o.stableId.startsWith('virtual:'))).toBe(true);
  });

  it('handles a 3500-chapter novel without crashing (FMC-shaped scale)', async () => {
    storeState.activeNovelId = 'fmc-big';
    fetchNovelByIdMock.mockResolvedValue({
      id: 'fmc-big',
      metadata: { chapterCount: 3500 },
      versions: [],
    });

    const { result } = renderHook(() => useChapterDropdownOptions());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.options).toHaveLength(3500);
    expect(result.current.options[0].chapterNumber).toBe(1);
    expect(result.current.options[3499].chapterNumber).toBe(3500);
  });
});
