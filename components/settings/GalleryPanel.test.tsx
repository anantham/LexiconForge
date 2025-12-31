import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GalleryPanel } from './GalleryPanel';

// Mock the store
vi.mock('../../store', () => ({
  useAppStore: vi.fn(),
}));

// Mock useBlobUrl hook
vi.mock('../../hooks/useBlobUrl', () => ({
  useBlobUrl: vi.fn(() => null),
}));

// Mock useNovelMetadata hook
vi.mock('../../hooks/useNovelMetadata', () => ({
  useNovelMetadata: vi.fn(() => ({
    novelMetadata: null,
    setCoverImage: vi.fn(),
  })),
}));

// Mock IndexedDB operations
vi.mock('../../services/db/operations/translations', () => ({
  TranslationOps: {
    getAll: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('../../services/db/operations/chapters', () => ({
  ChapterOps: {
    getAll: vi.fn(() => Promise.resolve([])),
  },
}));

import { useAppStore } from '../../store';
import { useBlobUrl } from '../../hooks/useBlobUrl';
import { useNovelMetadata } from '../../hooks/useNovelMetadata';

describe('GalleryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no images exist', async () => {
    vi.mocked(useAppStore).mockReturnValue(new Map());

    render(<GalleryPanel />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText('No images generated yet')).toBeInTheDocument();
    });
    expect(screen.getByText('Generate illustrations in chapters to see them here')).toBeInTheDocument();
  });

  it('displays chapter sections with images', async () => {
    const mockChapters = new Map([
      [
        'chapter-1',
        {
          title: 'Chapter 1: The Beginning',
          translationResult: {
            translatedTitle: 'Chapter 1: The Beginning',
            suggestedIllustrations: [
              {
                placementMarker: 'img-001',
                imagePrompt: 'A beautiful sunrise',
                imageCacheKey: { chapterId: 'chapter-1', placementMarker: 'img-001', version: 1 },
              },
              {
                placementMarker: 'img-002',
                imagePrompt: 'A forest path',
                generatedImage: { imageData: 'data:image/png;base64,abc123' },
              },
            ],
          },
        },
      ],
    ]);

    vi.mocked(useAppStore).mockReturnValue(mockChapters);
    vi.mocked(useBlobUrl).mockReturnValue('blob:test-url');

    render(<GalleryPanel />);

    await waitFor(() => {
      expect(screen.getByText('Image Gallery')).toBeInTheDocument();
    });
    expect(screen.getByText('Chapter 1: The Beginning')).toBeInTheDocument();
    expect(screen.getByText('2 images')).toBeInTheDocument();
  });

  it('shows cover status indicator', async () => {
    const mockChapters = new Map([
      [
        'chapter-1',
        {
          title: 'Test Chapter',
          translationResult: {
            translatedTitle: 'Test Chapter',
            suggestedIllustrations: [
              {
                placementMarker: 'img-001',
                imagePrompt: 'Test image',
                imageCacheKey: { chapterId: 'chapter-1', placementMarker: 'img-001', version: 1 },
              },
            ],
          },
        },
      ],
    ]);

    vi.mocked(useAppStore).mockReturnValue(mockChapters);
    vi.mocked(useNovelMetadata).mockReturnValue({
      novelMetadata: {
        coverImage: { chapterId: 'chapter-1', marker: 'img-001', cacheKey: null },
      },
      setCoverImage: vi.fn(),
      handleNovelMetadataChange: vi.fn(),
    } as any);
    vi.mocked(useBlobUrl).mockReturnValue('blob:test-url');

    render(<GalleryPanel />);

    await waitFor(() => {
      expect(screen.getByText('Cover: ✓ Selected')).toBeInTheDocument();
    });
  });

  it('shows "Cover: None" when no cover selected', async () => {
    const mockChapters = new Map([
      [
        'chapter-1',
        {
          title: 'Test Chapter',
          translationResult: {
            translatedTitle: 'Test Chapter',
            suggestedIllustrations: [
              {
                placementMarker: 'img-001',
                imagePrompt: 'Test image',
                imageCacheKey: { chapterId: 'chapter-1', placementMarker: 'img-001', version: 1 },
              },
            ],
          },
        },
      ],
    ]);

    vi.mocked(useAppStore).mockReturnValue(mockChapters);
    vi.mocked(useNovelMetadata).mockReturnValue({
      novelMetadata: null,
      setCoverImage: vi.fn(),
      handleNovelMetadataChange: vi.fn(),
    } as any);
    vi.mocked(useBlobUrl).mockReturnValue('blob:test-url');

    render(<GalleryPanel />);

    await waitFor(() => {
      expect(screen.getByText('Cover: None')).toBeInTheDocument();
    });
  });

  it('can collapse and expand chapter sections', async () => {
    const user = userEvent.setup();
    const mockChapters = new Map([
      [
        'chapter-1',
        {
          title: 'Test Chapter',
          translationResult: {
            translatedTitle: 'Test Chapter',
            suggestedIllustrations: [
              {
                placementMarker: 'img-001',
                imagePrompt: 'Test image',
                imageCacheKey: { chapterId: 'chapter-1', placementMarker: 'img-001', version: 1 },
              },
            ],
          },
        },
      ],
    ]);

    vi.mocked(useAppStore).mockReturnValue(mockChapters);
    vi.mocked(useBlobUrl).mockReturnValue('blob:test-url');

    render(<GalleryPanel />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Test Chapter/i })).toBeInTheDocument();
    });

    // Find the collapse button and click it
    const collapseButton = screen.getByRole('button', { name: /Test Chapter/i });

    // Initially expanded (▼ indicator)
    expect(collapseButton.textContent).toContain('▼');

    await user.click(collapseButton);

    // After collapse (▶ indicator)
    expect(collapseButton.textContent).toContain('▶');
  });

  it('filters out chapters without images', async () => {
    const mockChapters = new Map([
      [
        'chapter-1',
        {
          title: 'Chapter with images',
          translationResult: {
            translatedTitle: 'Chapter with images',
            suggestedIllustrations: [
              {
                placementMarker: 'img-001',
                imagePrompt: 'Has image',
                imageCacheKey: { chapterId: 'chapter-1', placementMarker: 'img-001', version: 1 },
              },
            ],
          },
        },
      ],
      [
        'chapter-2',
        {
          title: 'Chapter without images',
          translationResult: {
            translatedTitle: 'Chapter without images',
            suggestedIllustrations: [],
          },
        },
      ],
      [
        'chapter-3',
        {
          title: 'Chapter with no translation',
          translationResult: null,
        },
      ],
    ]);

    vi.mocked(useAppStore).mockReturnValue(mockChapters);
    vi.mocked(useBlobUrl).mockReturnValue('blob:test-url');

    render(<GalleryPanel />);

    await waitFor(() => {
      expect(screen.getByText('Chapter with images')).toBeInTheDocument();
    });
    expect(screen.queryByText('Chapter without images')).not.toBeInTheDocument();
    expect(screen.queryByText('Chapter with no translation')).not.toBeInTheDocument();
  });
});
