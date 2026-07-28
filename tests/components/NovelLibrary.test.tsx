import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NovelLibrary } from '../../components/NovelLibrary';
import { RegistryService } from '../../services/registryService';
import { BookshelfStateService } from '../../services/bookshelfStateService';
import { ImportService } from '../../services/importService';
import { loadNovelIntoStore } from '../../services/readerHydrationService';
import { clearChapterIndexCache } from '../../services/library/chapterIndexService';
import { createMockEnhancedChapter } from '../utils/test-data';

const storeState = vi.hoisted(() => ({
  showNotification: vi.fn(),
  openNovel: vi.fn(),
  openLibrary: vi.fn(),
  setReaderReady: vi.fn(),
  shelveActiveNovel: vi.fn(),
  appScreen: 'library' as const,
  activeNovelId: null as string | null,
  activeVersionId: null as string | null,
  chapters: new Map(),
  navigationHistory: [] as string[],
  currentChapterId: null as string | null,
}));

const useAppStoreMock = vi.hoisted(() => {
  const hook: any = vi.fn((selector?: (state: typeof storeState) => unknown) => {
    return selector ? selector(storeState) : storeState;
  });
  hook.getState = () => storeState;
  hook.setState = (update: any) => {
    const patch = typeof update === 'function' ? update(storeState) : update;
    Object.assign(storeState, patch);
    return storeState;
  };
  return hook;
});

const settingsOpsMock = vi.hoisted(() => ({
  getKey: vi.fn(),
  set: vi.fn(),
}));

const registryServiceMock = vi.hoisted(() => ({
  fetchAllNovelMetadata: vi.fn(),
  resolveCompatibleVersion: vi.fn((novel: any, requestedVersionId: string | null) => {
    if (!requestedVersionId) {
      return { version: null, requestedVersionId, resolvedVersionId: null, warning: null };
    }

    const versions = novel.versions ?? [];
    const directMatch = versions.find((candidate: any) => candidate.versionId === requestedVersionId);
    if (directMatch) {
      return {
        version: directMatch,
        requestedVersionId,
        resolvedVersionId: directMatch.versionId,
        warning: null,
      };
    }

    if (versions.length === 1) {
      return {
        version: versions[0],
        requestedVersionId,
        resolvedVersionId: versions[0].versionId,
        warning: `Saved version "${requestedVersionId}" is no longer available. Using "${versions[0].displayName}" instead.`,
      };
    }

    return { version: null, requestedVersionId, resolvedVersionId: null, warning: null };
  }),
}));

vi.mock('../../services/registryService', () => ({
  RegistryService: registryServiceMock,
}));
vi.mock('../../services/importService');
vi.mock('../../services/readerHydrationService');
vi.mock('../../services/bookshelfStateService');
vi.mock('../../services/db/operations', async () => {
  const actual = await vi.importActual<typeof import('../../services/db/operations')>(
    '../../services/db/operations'
  );
  return {
    ...actual,
    SettingsOps: settingsOpsMock,
  };
});
vi.mock('../../store', () => ({
  useAppStore: useAppStoreMock,
}));

const mockNovel = {
  id: 'novel-1',
  title: 'Test Novel 1',
  metadata: {
    originalLanguage: 'Korean',
    targetLanguage: 'English',
    chapterCount: 100,
    genres: ['Fantasy'],
    description: 'Test description 1',
  },
  versions: [
    {
      versionId: 'alice-v1',
      displayName: 'Alice Edition',
      translator: { name: 'Alice' },
      sessionJsonUrl: 'https://example.com/alice.json',
      targetLanguage: 'English',
      style: 'faithful',
      features: [],
      chapterRange: { from: 1, to: 100 },
      completionStatus: 'Complete',
      lastUpdated: '2026-03-29',
      stats: {
        downloads: 1,
        fileSize: '1 MB',
        content: {
          totalImages: 0,
          totalFootnotes: 0,
          totalRawChapters: 100,
          totalTranslatedChapters: 100,
          avgImagesPerChapter: 0,
          avgFootnotesPerChapter: 0,
        },
        translation: {
          translationType: 'human',
          feedbackCount: 0,
        },
      },
    },
  ],
};

describe('NovelLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.showNotification.mockReset();
    storeState.openNovel.mockReset();
    storeState.openLibrary.mockReset();
    storeState.setReaderReady.mockReset();
    storeState.shelveActiveNovel.mockReset();
    storeState.appScreen = 'library';
    storeState.activeNovelId = null;
    storeState.activeVersionId = null;
    storeState.currentChapterId = null;
    storeState.navigationHistory = [];
    storeState.chapters = new Map([
      [
        'ch-12',
        createMockEnhancedChapter({
          id: 'ch-12',
          novelId: 'novel-1',
          chapterNumber: 12,
        }),
      ],
    ]);

    vi.mocked(RegistryService.fetchAllNovelMetadata).mockResolvedValue([]);
    vi.mocked(BookshelfStateService.getState).mockResolvedValue({});
    vi.mocked(BookshelfStateService.getEntry).mockResolvedValue(null);
    vi.mocked(BookshelfStateService.upsertEntry).mockResolvedValue(undefined as any);
    vi.mocked(BookshelfStateService.resolveResumeChapterId).mockImplementation((entry, _chapters, fallback) => {
      return entry?.lastChapterId ?? fallback;
    });
    vi.mocked(ImportService.streamImportFromUrl).mockResolvedValue({} as any);
    vi.mocked(loadNovelIntoStore).mockResolvedValue(null);
    settingsOpsMock.getKey.mockReset();
    settingsOpsMock.set.mockReset();
    settingsOpsMock.getKey.mockResolvedValue(null as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show loading state initially', () => {
    vi.mocked(RegistryService.fetchAllNovelMetadata).mockImplementation(
      () => new Promise(() => {})
    );

    render(<NovelLibrary />);

    expect(screen.getByText('Loading novel library...')).toBeInTheDocument();
  });

  it('should display novels after fetching from registry', async () => {
    vi.mocked(RegistryService.fetchAllNovelMetadata).mockResolvedValue([mockNovel] as any);

    render(<NovelLibrary />);

    await waitFor(() => {
      expect(screen.queryByText('Loading novel library...')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/Browse our community-driven collection/)).toBeInTheDocument();
  });

  it('should show empty state when no novels are available', async () => {
    vi.mocked(RegistryService.fetchAllNovelMetadata).mockResolvedValue([]);

    render(<NovelLibrary />);

    await waitFor(() => {
      expect(screen.getByText('No novels available at the moment.')).toBeInTheDocument();
    });
  });

  it('should handle fetch errors gracefully', async () => {
    vi.mocked(RegistryService.fetchAllNovelMetadata).mockRejectedValue(
      new Error('Network error')
    );

    render(<NovelLibrary />);

    await waitFor(() => {
      expect(storeState.showNotification).toHaveBeenCalledWith(
        'Failed to load novel library. Please try again later.',
        'error'
      );
    });

    expect(screen.getByText('No novels available at the moment.')).toBeInTheDocument();
  });

  it('shows continue reading entries with saved version labels', async () => {
    vi.mocked(RegistryService.fetchAllNovelMetadata).mockResolvedValue([mockNovel] as any);
    vi.mocked(BookshelfStateService.getState).mockResolvedValue({
      'novel-1::alice-v1': {
        novelId: 'novel-1',
        versionId: 'alice-v1',
        lastChapterId: 'ch-12',
        lastChapterNumber: 12,
        lastReadAtIso: '2026-03-29T18:00:00.000Z',
      },
    });

    render(<NovelLibrary />);

    await waitFor(() => {
      expect(screen.getByText('Continue Reading')).toBeInTheDocument();
    });

    expect(screen.getByText('Alice Edition • Chapter 12 • 0/100 translated')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('resumes the saved version directly from the shelf card', async () => {
    vi.mocked(RegistryService.fetchAllNovelMetadata).mockResolvedValue([mockNovel] as any);
    vi.mocked(BookshelfStateService.getState).mockResolvedValue({
      'novel-1::alice-v1': {
        novelId: 'novel-1',
        versionId: 'alice-v1',
        lastChapterId: 'ch-12',
        lastChapterNumber: 12,
        lastReadAtIso: '2026-03-29T18:00:00.000Z',
      },
    });
    vi.mocked(BookshelfStateService.getEntry).mockResolvedValue({
      novelId: 'novel-1',
      versionId: 'alice-v1',
      lastChapterId: 'ch-12',
      lastChapterNumber: 12,
      lastReadAtIso: '2026-03-29T18:00:00.000Z',
    });
    vi.mocked(loadNovelIntoStore).mockResolvedValue('ch-12');
    settingsOpsMock.getKey.mockResolvedValue({ stableIds: ['ch-12'] } as any);

    render(<NovelLibrary />);

    await waitFor(() => {
      expect(screen.getByText('Alice Edition • Chapter 12 • 0/100 translated')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Alice Edition • Chapter 12 • 0/100 translated'));

    await waitFor(() => {
      expect(storeState.openNovel).toHaveBeenCalledWith('novel-1', 'alice-v1');
    });

    expect(loadNovelIntoStore).toHaveBeenCalledWith('novel-1', expect.any(Function), {
      versionId: 'alice-v1',
    });
    expect(storeState.setReaderReady).toHaveBeenCalled();
    expect(BookshelfStateService.upsertEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        novelId: 'novel-1',
        versionId: 'alice-v1',
        lastChapterId: 'ch-12',
        lastChapterNumber: 12,
      })
    );
  });

  it('falls back to the only available version and warns when a saved version is gone', async () => {
    vi.mocked(RegistryService.fetchAllNovelMetadata).mockResolvedValue([
      {
        ...mockNovel,
        versions: [
          {
            ...mockNovel.versions[0],
            versionId: 'st-enhanced',
            displayName: 'ST Enhanced',
          },
        ],
      },
    ] as any);
    vi.mocked(BookshelfStateService.getState).mockResolvedValue({
      'novel-1::v1-composite': {
        novelId: 'novel-1',
        versionId: 'v1-composite',
        lastChapterId: 'ch-12',
        lastChapterNumber: 12,
        lastReadAtIso: '2026-03-29T18:00:00.000Z',
      },
    });
    vi.mocked(BookshelfStateService.getEntry).mockResolvedValue({
      novelId: 'novel-1',
      versionId: 'st-enhanced',
      lastChapterId: 'ch-12',
      lastChapterNumber: 12,
      lastReadAtIso: '2026-03-29T18:00:00.000Z',
    });
    vi.mocked(loadNovelIntoStore).mockResolvedValue('ch-12');
    settingsOpsMock.getKey.mockResolvedValue({ stableIds: ['ch-12'] } as any);

    render(<NovelLibrary />);

    await waitFor(() => {
      expect(screen.getByText('ST Enhanced • Chapter 12 • 0/100 translated')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('ST Enhanced • Chapter 12 • 0/100 translated'));

    await waitFor(() => {
      expect(storeState.showNotification).toHaveBeenCalledWith(
        'Saved version "v1-composite" is no longer available. Using "ST Enhanced" instead.',
        'warning'
      );
    });

    expect(storeState.openNovel).toHaveBeenCalledWith('novel-1', 'st-enhanced');
    expect(loadNovelIntoStore).toHaveBeenCalledWith('novel-1', expect.any(Function), {
      versionId: 'st-enhanced',
    });
  });

  // P1 red-proof: a grouped novel opened at a verse OUTSIDE the first streamed
  // batch (e.g. Gītā 2.47 when only the first chapter has streamed) must still
  // open — and PERSIST — the picked verse after the full import completes, never
  // silently parking on chapter 1.
  it('opens a picked verse outside the initial streamed batch after full import (not chapter 1)', async () => {
    clearChapterIndexCache();

    const ch1001 = createMockEnhancedChapter({ id: 'ch-1001', novelId: 'gita', chapterNumber: 1001 });
    const ch2047 = createMockEnhancedChapter({ id: 'ch-2047', novelId: 'gita', chapterNumber: 2047 });

    // The lazy chapter-index fetch for the nested tree.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          JSON.stringify({
            chapters: [
              { chapterNumber: 1001, title: '1.1' },
              { chapterNumber: 2001, title: '2.1' },
              { chapterNumber: 2047, title: '2.47' },
              { chapterNumber: 2072, title: '2.72' },
            ],
          }),
      })),
    );

    const gitaVersion = {
      ...mockNovel.versions[0],
      versionId: 'gita-v1',
      displayName: 'Gītā',
      sessionJsonUrl: 'https://example.com/gita.json',
      chapterRange: { from: 1001, to: 18078 },
    };
    const gitaNovel = {
      id: 'gita',
      title: 'Bhagavad Gītā',
      metadata: {
        originalLanguage: 'Sanskrit',
        targetLanguage: 'English',
        chapterCount: 700,
        genres: ['Scripture'],
        description: 'The Song of the Lord.',
        lastUpdated: '2026-07-28',
        grouping: { scheme: 'chapter-verse' as const },
      },
      versions: [gitaVersion],
    };
    // A second novel so the card click opens the detail sheet (single-novel
    // libraries skip it and read straight through).
    vi.mocked(RegistryService.fetchAllNovelMetadata).mockResolvedValue([gitaNovel, mockNovel] as any);

    // Streaming path: first (cache) load is empty → stream. The initial batch
    // holds ONLY chapter 1001; the post-import reconcile load holds 2047 too.
    let loadCall = 0;
    vi.mocked(loadNovelIntoStore).mockImplementation(async (_novelId, setState, options) => {
      loadCall += 1;
      if (loadCall === 1) return null; // cache check — not cached → stream
      if (options?.limit === 10) {
        setState({ chapters: new Map([['ch-1001', ch1001]]), urlIndex: new Map(), rawUrlIndex: new Map() } as any);
        return 'ch-1001';
      }
      // reconcile: full set now available
      setState({
        chapters: new Map([['ch-1001', ch1001], ['ch-2047', ch2047]]),
        urlIndex: new Map(),
        rawUrlIndex: new Map(),
      } as any);
      return 'ch-1001';
    });

    // Drive the onFirstChaptersReady callback, then resolve (stream complete).
    vi.mocked(ImportService.streamImportFromUrl).mockImplementation(
      async (_url: any, _onProgress: any, onFirstReady: any) => {
        await onFirstReady?.();
        return {} as any;
      }
    );

    render(<NovelLibrary />);

    // Open the Gītā detail sheet.
    await waitFor(() => expect(screen.getByText('Bhagavad Gītā')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Bhagavad Gītā'));

    // The nested tree renders once the index fetch resolves.
    await waitFor(() => expect(screen.getByText('Chapters & Verses')).toBeInTheDocument());

    // Expand chapter 2 and pick verse 2.47.
    fireEvent.click(screen.getByRole('button', { name: /Chapter 2/ }));
    fireEvent.click(await screen.findByText('2.47'));

    // After the full import + reconcile, the reader is on 2.47 (ch-2047),
    // NOT parked on chapter 1 (ch-1001).
    await waitFor(() => expect(storeState.currentChapterId).toBe('ch-2047'));

    // …and the picked verse is what gets persisted as the resume point.
    expect(BookshelfStateService.upsertEntry).toHaveBeenCalledWith(
      expect.objectContaining({ novelId: 'gita', lastChapterId: 'ch-2047', lastChapterNumber: 2047 })
    );
    // Chapter 1 was never persisted as the resume for this open.
    expect(BookshelfStateService.upsertEntry).not.toHaveBeenCalledWith(
      expect.objectContaining({ lastChapterId: 'ch-1001' })
    );

    vi.unstubAllGlobals();
  });
});
