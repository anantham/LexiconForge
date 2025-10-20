import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NovelLibrary } from '../../components/NovelLibrary';
import { RegistryService } from '../../services/registryService';

// Mock the services
vi.mock('../../services/registryService');
vi.mock('../../services/importService');
vi.mock('../../store', () => ({
  useAppStore: vi.fn((selector) => {
    const state = {
      showNotification: vi.fn(),
      chapters: new Map(),
      navigationHistory: [],
      currentChapterId: null
    };
    return selector ? selector(state) : state;
  })
}));

describe('NovelLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show loading state initially', () => {
    // Mock fetchAllNovelMetadata to return a promise that never resolves
    vi.mocked(RegistryService.fetchAllNovelMetadata).mockImplementation(
      () => new Promise(() => {})
    );

    render(<NovelLibrary />);

    expect(screen.getByText('Loading novel library...')).toBeInTheDocument();
  });

  it('should display novels after fetching from registry', async () => {
    const mockNovels = [
      {
        id: 'novel-1',
        title: 'Test Novel 1',
        metadata: {
          originalLanguage: 'Korean',
          targetLanguage: 'English',
          chapterCount: 100,
          genres: ['Fantasy'],
          description: 'Test description 1'
        }
      },
      {
        id: 'novel-2',
        title: 'Test Novel 2',
        metadata: {
          originalLanguage: 'Japanese',
          targetLanguage: 'English',
          chapterCount: 50,
          genres: ['Action'],
          description: 'Test description 2'
        }
      }
    ];

    vi.mocked(RegistryService.fetchAllNovelMetadata).mockResolvedValue(mockNovels as any);

    render(<NovelLibrary />);

    // Wait for novels to be loaded
    await waitFor(() => {
      expect(screen.queryByText('Loading novel library...')).not.toBeInTheDocument();
    });

    // Check that header updated to community-driven message
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
    const mockShowNotification = vi.fn();
    vi.mocked(RegistryService.fetchAllNovelMetadata).mockRejectedValue(
      new Error('Network error')
    );

    // Mock useAppStore to return our mock notification function
    const { useAppStore } = await import('../../store');
    vi.mocked(useAppStore).mockImplementation((selector: any) => {
      const state = {
        showNotification: mockShowNotification,
        chapters: new Map(),
        navigationHistory: [],
        currentChapterId: null
      };
      return selector ? selector(state) : state;
    });

    render(<NovelLibrary />);

    await waitFor(() => {
      expect(mockShowNotification).toHaveBeenCalledWith(
        'Failed to load novel library. Please try again later.',
        'error'
      );
    });

    // Should show empty state after error
    expect(screen.getByText('No novels available at the moment.')).toBeInTheDocument();
  });
});
