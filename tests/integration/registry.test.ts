/**
 * RegistryService Unit Tests
 *
 * NOTE: Despite being in the 'integration' folder, these are UNIT tests.
 * They mock `fetch` to test the service's logic in isolation:
 * - Multi-fetch aggregation (registry → individual novel metadata)
 * - Partial failure handling (some novels fail, others succeed)
 * - URL routing (custom registry URLs, individual metadata URLs)
 *
 * For true integration tests against a real registry server,
 * see tests/e2e/ or run with LIVE_REGISTRY_TEST=1.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegistryService } from '../../services/registryService';

// Mock fetch globally - this makes these UNIT tests, not integration tests
global.fetch = vi.fn();

describe('RegistryService (unit tests with mocked fetch)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch registry and load all novel metadata', async () => {
    const mockRegistry = {
      version: '1.0',
      lastUpdated: '2025-10-20',
      novels: [
        {
          id: 'novel-1',
          metadataUrl: 'https://example.com/novel-1-metadata.json'
        },
        {
          id: 'novel-2',
          metadataUrl: 'https://example.com/novel-2-metadata.json'
        }
      ]
    };

    const mockNovel1Metadata = {
      id: 'novel-1',
      title: 'Test Novel 1',
      metadata: {
        originalLanguage: 'Korean',
        targetLanguage: 'English',
        chapterCount: 100,
        genres: ['Fantasy'],
        description: 'Test description 1'
      },
      versions: []
    };

    const mockNovel2Metadata = {
      id: 'novel-2',
      title: 'Test Novel 2',
      metadata: {
        originalLanguage: 'Japanese',
        targetLanguage: 'English',
        chapterCount: 50,
        genres: ['Action'],
        description: 'Test description 2'
      },
      versions: []
    };

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRegistry
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockNovel1Metadata
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockNovel2Metadata
      });

    const novels = await RegistryService.fetchAllNovelMetadata();

    expect(novels).toHaveLength(2);
    expect(novels[0].title).toBe('Test Novel 1');
    expect(novels[1].title).toBe('Test Novel 2');
  });

  it('should handle partial failures gracefully', async () => {
    const mockRegistry = {
      version: '1.0',
      lastUpdated: '2025-10-20',
      novels: [
        {
          id: 'novel-1',
          metadataUrl: 'https://example.com/novel-1-metadata.json'
        },
        {
          id: 'novel-2',
          metadataUrl: 'https://example.com/novel-2-metadata.json'
        }
      ]
    };

    const mockNovel1Metadata = {
      id: 'novel-1',
      title: 'Test Novel 1',
      metadata: {
        originalLanguage: 'Korean',
        targetLanguage: 'English',
        chapterCount: 100,
        genres: ['Fantasy'],
        description: 'Test description 1'
      },
      versions: []
    };

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRegistry
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockNovel1Metadata
      })
      .mockRejectedValueOnce(new Error('Network error'));

    const novels = await RegistryService.fetchAllNovelMetadata();

    // Should return only successful novels
    expect(novels).toHaveLength(1);
    expect(novels[0].title).toBe('Test Novel 1');
  });

  it('should support custom registry URL', async () => {
    const customRegistryUrl = 'https://custom.example.com/registry.json';
    const mockRegistry = {
      version: '1.0',
      lastUpdated: '2025-10-20',
      novels: []
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockRegistry
    });

    await RegistryService.fetchRegistry(customRegistryUrl);

    expect(global.fetch).toHaveBeenCalledWith(customRegistryUrl);
  });

  it('should fetch individual novel metadata', async () => {
    const mockNovelMetadata = {
      id: 'test-novel',
      title: 'Test Novel',
      metadata: {
        originalLanguage: 'Korean',
        targetLanguage: 'English',
        chapterCount: 100,
        genres: ['Fantasy'],
        description: 'Test description'
      },
      versions: [
        {
          versionId: 'v1',
          displayName: 'Official Translation',
          translator: { name: 'John Doe', link: 'https://example.com' },
          sessionJsonUrl: 'https://example.com/session.json',
          targetLanguage: 'English',
          style: 'faithful',
          features: ['high-quality'],
          chapterRange: { from: 1, to: 100 },
          completionStatus: 'Complete',
          lastUpdated: '2025-10-20',
          stats: {
            downloads: 1000,
            fileSize: '50MB',
            content: {
              totalImages: 10,
              totalFootnotes: 50,
              totalRawChapters: 100,
              totalTranslatedChapters: 100,
              avgImagesPerChapter: 0.1,
              avgFootnotesPerChapter: 0.5
            },
            translation: {
              translationType: 'human',
              feedbackCount: 25
            }
          }
        }
      ]
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockNovelMetadata
    });

    const novel = await RegistryService.fetchNovelMetadata('https://example.com/metadata.json');

    expect(novel.title).toBe('Test Novel');
    expect(novel.versions).toHaveLength(1);
    expect(novel.versions![0].versionId).toBe('v1');
  });
});
