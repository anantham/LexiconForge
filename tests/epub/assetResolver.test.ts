/**
 * Tests for EPUB Asset Resolver
 *
 * The asset resolver fetches binary assets (images via ImageCacheStore, audio later)
 * and converts them into {id, mimeType, arrayBuffer} records.
 * Handles cache misses gracefully with fallback to base64.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveAssets } from '../../services/epub/assetResolver';
import type { CollectedData, CollectedChapter } from '../../services/epub/types';
import { ImageCacheStore } from '../../services/imageCacheService';

// Mock ImageCacheStore
vi.mock('../../services/imageCacheService', () => ({
  ImageCacheStore: {
    getImageBlob: vi.fn()
  }
}));

describe('resolveAssets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves images from cache and converts to ArrayBuffer', async () => {
    // Arrange: Mock successful cache hit

    // Create a mock PNG blob (minimal PNG header)
    const pngData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG magic number
    const mockBlob = new Blob([pngData], { type: 'image/png' });

    const mockGetImageBlob = vi.mocked(ImageCacheStore.getImageBlob);
    mockGetImageBlob.mockResolvedValue(mockBlob);

    const collectedData: CollectedData = {
      chapters: [
        {
          id: 'ch-1',
          chapterNumber: 1,
          title: 'Chapter 1',
          content: '<p>Content</p>',
          translatedContent: '<p>Translated</p>',
          footnotes: [],
          imageReferences: [
            {
              placementMarker: 'ILL-1',
              prompt: 'A hero',
              cacheKey: { chapterId: 'ch-1', placementMarker: 'ILL-1' }
            }
          ]
        } as CollectedChapter
      ],
      metadata: {
        novelTitle: 'Test',
        totalChapters: 1,
        translatedChapters: 1,
        exportDate: '2025-01-01'
      },
      warnings: []
    };

    // Act: Resolve assets
    const result = await resolveAssets(collectedData);

    // Assert: Asset created with correct structure
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).toMatchObject({
      id: 'img-ch-1-ILL-1',
      mimeType: 'image/png',
      extension: 'png',
      sourceRef: {
        chapterId: 'ch-1',
        marker: 'ILL-1',
        type: 'image'
      }
    });

    // Verify ArrayBuffer has correct data
    const arrayBuffer = result.assets[0].data;
    expect(arrayBuffer).toBeInstanceOf(ArrayBuffer);
    expect(arrayBuffer.byteLength).toBe(8);

    // Verify chapter reference updated with asset ID
    expect(result.chapters[0].imageReferences[0]).toMatchObject({
      placementMarker: 'ILL-1',
      prompt: 'A hero',
      assetId: 'img-ch-1-ILL-1',
      missing: false
    });

    expect(result.warnings).toHaveLength(0);
  });

  it('falls back to base64 when cache miss occurs', async () => {
    // Arrange: Mock cache miss (returns null)
    vi.mocked(ImageCacheStore.getImageBlob).mockResolvedValue(null);

    const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    const collectedData: CollectedData = {
      chapters: [
        {
          id: 'ch-2',
          chapterNumber: 2,
          title: 'Chapter 2',
          content: '<p>Content</p>',
          footnotes: [],
          imageReferences: [
            {
              placementMarker: 'ILL-2',
              prompt: 'A dragon',
              cacheKey: { chapterId: 'ch-2', placementMarker: 'ILL-2' },
              base64Fallback: base64Image
            }
          ]
        } as CollectedChapter
      ],
      metadata: {
        novelTitle: 'Test',
        totalChapters: 1,
        translatedChapters: 1,
        exportDate: '2025-01-01'
      },
      warnings: []
    };

    // Act: Resolve with fallback
    const result = await resolveAssets(collectedData);

    // Assert: Asset created from base64
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).toMatchObject({
      id: 'img-ch-2-ILL-2',
      mimeType: 'image/png',
      extension: 'png'
    });

    // Verify no errors, but warning logged
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({
      type: 'cache-miss',
      chapterId: 'ch-2',
      marker: 'ILL-2'
    });

    expect(result.chapters[0].imageReferences[0].assetId).toBe('img-ch-2-ILL-2');
    expect(result.chapters[0].imageReferences[0].missing).toBe(false);
  });

  it('marks image as missing when both cache and fallback unavailable', async () => {
    // Arrange: Cache miss + no fallback
    vi.mocked(ImageCacheStore.getImageBlob).mockResolvedValue(null);

    const collectedData: CollectedData = {
      chapters: [
        {
          id: 'ch-3',
          chapterNumber: 3,
          title: 'Chapter 3',
          content: '<p>Content</p>',
          footnotes: [],
          imageReferences: [
            {
              placementMarker: 'ILL-3',
              prompt: 'A castle',
              cacheKey: { chapterId: 'ch-3', placementMarker: 'ILL-3' }
              // No base64Fallback
            }
          ]
        } as CollectedChapter
      ],
      metadata: {
        novelTitle: 'Test',
        totalChapters: 1,
        translatedChapters: 1,
        exportDate: '2025-01-01'
      },
      warnings: []
    };

    // Act
    const result = await resolveAssets(collectedData);

    // Assert: No asset created
    expect(result.assets).toHaveLength(0);

    // Image marked as missing
    expect(result.chapters[0].imageReferences[0]).toMatchObject({
      placementMarker: 'ILL-3',
      assetId: undefined,
      missing: true
    });

    // Warning logged
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({
      type: 'cache-miss',
      chapterId: 'ch-3',
      marker: 'ILL-3'
    });
  });
});
