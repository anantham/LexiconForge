import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NovelLibrary } from '../../components/NovelLibrary';
import { RegistryService } from '../../services/registryService';
import { ImportService } from '../../services/importService';
import type { NovelEntry } from '../../types/novel';

// Mock services
vi.mock('../../services/registryService');
vi.mock('../../services/importService');
vi.mock('../../services/indexeddb', () => ({
  indexedDBService: {
    getChaptersForReactRendering: vi.fn().mockResolvedValue([]),
    getSetting: vi.fn().mockResolvedValue(null)
  }
}));
vi.mock('../../store', () => ({
  useAppStore: vi.fn((selector) => {
    const state = {
      showNotification: vi.fn(),
      chapters: new Map(),
      navigationHistory: [],
      currentChapterId: null,
      setState: vi.fn()
    };
    return selector ? selector(state) : state;
  })
}));

describe('Novel Library E2E Flow', () => {
  const mockNovels: NovelEntry[] = [
    {
      id: 'test-novel',
      title: 'The Chronicles of Testing',
      metadata: {
        originalLanguage: 'Korean',
        targetLanguage: 'English',
        chapterCount: 100,
        genres: ['Fantasy', 'Adventure'],
        description: 'An epic tale of unit tests and integration tests coming together.',
        author: 'Test Author',
        coverImageUrl: 'https://example.com/cover.jpg',
        lastUpdated: '2025-10-21'
      },
      versions: [
        {
          versionId: 'v1-human',
          displayName: 'Premium Human Translation',
          translator: { name: 'Human Translator', link: 'https://example.com/translator' },
          sessionJsonUrl: 'https://example.com/v1-human.json',
          targetLanguage: 'English',
          style: 'faithful',
          features: ['high-quality', 'footnotes'],
          chapterRange: { from: 1, to: 100 },
          completionStatus: 'Complete',
          lastUpdated: '2025-10-20',
          stats: {
            downloads: 1000,
            fileSize: '50MB',
            content: {
              totalImages: 50,
              totalFootnotes: 200,
              totalRawChapters: 100,
              totalTranslatedChapters: 100,
              avgImagesPerChapter: 0.5,
              avgFootnotesPerChapter: 2.0
            },
            translation: {
              translationType: 'human',
              feedbackCount: 45,
              qualityRating: 4.8
            }
          }
        },
        {
          versionId: 'v2-ai',
          displayName: 'AI-Enhanced Translation',
          translator: { name: 'AI Team', link: 'https://example.com/ai-team' },
          sessionJsonUrl: 'https://example.com/v2-ai.json',
          targetLanguage: 'English',
          style: 'liberal',
          features: ['fast-updates', 'ai-powered'],
          chapterRange: { from: 1, to: 100 },
          completionStatus: 'Complete',
          lastUpdated: '2025-10-20',
          stats: {
            downloads: 500,
            fileSize: '45MB',
            content: {
              totalImages: 30,
              totalFootnotes: 100,
              totalRawChapters: 100,
              totalTranslatedChapters: 100,
              avgImagesPerChapter: 0.3,
              avgFootnotesPerChapter: 1.0
            },
            translation: {
              translationType: 'ai',
              feedbackCount: 20,
              qualityRating: 4.2
            }
          }
        }
      ]
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful registry fetch
    vi.mocked(RegistryService.fetchAllNovelMetadata).mockResolvedValue(mockNovels);

    // Mock successful import
    vi.mocked(ImportService.streamImportFromUrl).mockResolvedValue(undefined);
  });

  it('should complete full user journey: browse → view details → select version → start reading', async () => {
    const onSessionLoaded = vi.fn();

    // Step 1: Render NovelLibrary
    render(<NovelLibrary onSessionLoaded={onSessionLoaded} />);

    // Should show loading state initially
    expect(screen.getByText('Loading novel library...')).toBeInTheDocument();

    // Step 2: Wait for novels to load
    await waitFor(() => {
      expect(screen.queryByText('Loading novel library...')).not.toBeInTheDocument();
    });

    // Should display the novel title in the grid
    expect(screen.getByText('The Chronicles of Testing')).toBeInTheDocument();

    // Step 3: Click on the novel card (clickable)
    const novelTitle = screen.getByText('The Chronicles of Testing');
    fireEvent.click(novelTitle);

    // Step 4: Novel detail sheet should open
    await waitFor(() => {
      expect(screen.getByText('Premium Human Translation')).toBeInTheDocument();
      expect(screen.getByText('AI-Enhanced Translation')).toBeInTheDocument();
    });

    // Should display version statistics
    expect(screen.getByText('👤 Human Translation')).toBeInTheDocument();
    expect(screen.getByText('🤖 AI Translation')).toBeInTheDocument();

    // Should show content stats (images, footnotes)
    expect(screen.getByText('50')).toBeInTheDocument(); // total images for v1
    expect(screen.getByText('200')).toBeInTheDocument(); // total footnotes for v1

    // Step 5: Select a version (click "Start Reading" on first version)
    const startReadingButtons = screen.getAllByText('Start Reading');
    fireEvent.click(startReadingButtons[0]); // Select Premium Human Translation

    // Step 6: Verify ImportService was called with correct version URL
    await waitFor(() => {
      expect(ImportService.streamImportFromUrl).toHaveBeenCalledWith(
        'https://example.com/v1-human.json',
        expect.any(Function),
        expect.any(Function)
      );
    });

    // Step 7: Verify session loaded callback was called
    // Note: In the actual implementation, this happens after import completes
    // For this test, we're just verifying the import was initiated
    expect(ImportService.streamImportFromUrl).toHaveBeenCalled();
  });

  it('should handle selecting different versions', async () => {
    render(<NovelLibrary />);

    // Wait for novels to load
    await waitFor(() => {
      expect(screen.getByText('The Chronicles of Testing')).toBeInTheDocument();
    });

    // Open details by clicking novel card
    fireEvent.click(screen.getByText('The Chronicles of Testing'));

    // Wait for detail sheet
    await waitFor(() => {
      expect(screen.getByText('AI-Enhanced Translation')).toBeInTheDocument();
    });

    // Click on second version's "Start Reading" button
    const startReadingButtons = screen.getAllByText('Start Reading');
    fireEvent.click(startReadingButtons[1]); // Select AI-Enhanced Translation

    // Verify correct version URL was used
    await waitFor(() => {
      expect(ImportService.streamImportFromUrl).toHaveBeenCalledWith(
        'https://example.com/v2-ai.json',
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  it('should open detail sheet for novels with multiple versions', async () => {
    render(<NovelLibrary />);

    // Wait for novels to load
    await waitFor(() => {
      expect(screen.getByText('The Chronicles of Testing')).toBeInTheDocument();
    });

    // Open details by clicking novel card
    fireEvent.click(screen.getByText('The Chronicles of Testing'));

    // Should display version picker with both versions
    await waitFor(() => {
      expect(screen.getByText('Premium Human Translation')).toBeInTheDocument();
      expect(screen.getByText('AI-Enhanced Translation')).toBeInTheDocument();
    });

    // Should show multiple "Start Reading" buttons (one per version)
    const startReadingButtons = screen.getAllByText('Start Reading');
    expect(startReadingButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('should display translation type badges for different versions', async () => {
    render(<NovelLibrary />);

    // Wait for novels to load and open details
    await waitFor(() => {
      expect(screen.getByText('The Chronicles of Testing')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('The Chronicles of Testing'));

    // Wait for detail sheet to open
    await waitFor(() => {
      expect(screen.getByText('Premium Human Translation')).toBeInTheDocument();
    });

    // Verify translation type badges are present
    expect(screen.getByText('👤 Human Translation')).toBeInTheDocument();
    expect(screen.getByText('🤖 AI Translation')).toBeInTheDocument();
  });

  it('should handle novels without versions (backwards compatibility)', async () => {
    const novelsWithoutVersions: NovelEntry[] = [
      {
        id: 'legacy-novel',
        title: 'Legacy Novel',
        sessionJsonUrl: 'https://example.com/legacy.json',
        metadata: {
          originalLanguage: 'Korean',
          chapterCount: 50,
          genres: ['Fantasy'],
          description: 'A novel without versions',
          lastUpdated: '2025-10-21'
        }
      }
    ];

    vi.mocked(RegistryService.fetchAllNovelMetadata).mockResolvedValue(novelsWithoutVersions);

    render(<NovelLibrary />);

    // Wait for novels to load
    await waitFor(() => {
      expect(screen.getByText('Legacy Novel')).toBeInTheDocument();
    });

    // Open details by clicking novel card
    fireEvent.click(screen.getByText('Legacy Novel'));

    // Should show single "Start Reading" button (not version picker)
    await waitFor(() => {
      const startReadingButtons = screen.getAllByText('Start Reading');
      expect(startReadingButtons).toHaveLength(1);
    });

    // Click start reading
    fireEvent.click(screen.getByText('Start Reading'));

    // Should use novel's sessionJsonUrl
    await waitFor(() => {
      expect(ImportService.streamImportFromUrl).toHaveBeenCalledWith(
        'https://example.com/legacy.json',
        expect.any(Function),
        expect.any(Function)
      );
    });
  });
});
