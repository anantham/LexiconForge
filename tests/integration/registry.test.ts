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

  describe('error handling', () => {
    it('should throw on HTTP 404 Not Found response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(RegistryService.fetchRegistry()).rejects.toThrow();
    });

    it('should throw on HTTP 500 Internal Server Error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(RegistryService.fetchRegistry()).rejects.toThrow();
    });

    it('should throw on network timeout', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network timeout'));

      await expect(RegistryService.fetchRegistry()).rejects.toThrow('Network timeout');
    });

    it('should throw on malformed JSON response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new SyntaxError('Unexpected token < in JSON'); }
      });

      await expect(RegistryService.fetchRegistry()).rejects.toThrow();
    });

    it('should throw on individual novel metadata 404', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(
        RegistryService.fetchNovelMetadata('https://example.com/nonexistent.json')
      ).rejects.toThrow();
    });
  });

  describe('resilience to imperfect data', () => {
    it('should handle registry with missing optional fields', async () => {
      const mockRegistry = {
        // Missing version and lastUpdated - only required field is novels
        novels: [
          { id: 'minimal', metadataUrl: 'https://example.com/minimal.json' }
        ]
      };
      const mockNovel = {
        id: 'minimal',
        title: 'Minimal Novel'
        // Missing metadata, versions - should still work
      };

      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => mockRegistry })
        .mockResolvedValueOnce({ ok: true, json: async () => mockNovel });

      const novels = await RegistryService.fetchAllNovelMetadata();

      expect(novels).toHaveLength(1);
      expect(novels[0].title).toBe('Minimal Novel');
      expect(novels[0].metadata).toBeUndefined();
      expect(novels[0].versions).toBeUndefined();
    });

    it('should skip novels with empty metadataUrl', async () => {
      const mockRegistry = {
        novels: [
          { id: 'valid', metadataUrl: 'https://example.com/valid.json' },
          { id: 'empty-url', metadataUrl: '' }, // Empty URL should be skipped
        ]
      };
      const mockValidNovel = {
        id: 'valid',
        title: 'Valid Novel',
        metadata: { originalLanguage: 'Korean' }
      };

      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => mockRegistry })
        .mockResolvedValueOnce({ ok: true, json: async () => mockValidNovel });

      const novels = await RegistryService.fetchAllNovelMetadata();

      // Should only return the valid novel, not crash on empty URL
      expect(novels).toHaveLength(1);
      expect(novels[0].id).toBe('valid');
    });

    it('should skip novels with missing metadataUrl', async () => {
      const mockRegistry = {
        novels: [
          { id: 'valid', metadataUrl: 'https://example.com/valid.json' },
          { id: 'no-url' }, // No metadataUrl field at all
        ]
      };
      const mockValidNovel = {
        id: 'valid',
        title: 'Valid Novel'
      };

      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => mockRegistry })
        .mockResolvedValueOnce({ ok: true, json: async () => mockValidNovel });

      const novels = await RegistryService.fetchAllNovelMetadata();

      expect(novels).toHaveLength(1);
      expect(novels[0].id).toBe('valid');
    });

    it('should handle novel metadata with null/undefined values gracefully', async () => {
      const mockNovelMetadata = {
        id: 'partial-novel',
        title: 'Partial Novel',
        metadata: {
          originalLanguage: 'Korean',
          targetLanguage: null, // null value
          chapterCount: undefined, // undefined value
          genres: [], // empty array
          description: ''  // empty string
        },
        versions: null // null versions array
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockNovelMetadata
      });

      const novel = await RegistryService.fetchNovelMetadata('https://example.com/partial.json');

      expect(novel.title).toBe('Partial Novel');
      expect(novel.metadata?.originalLanguage).toBe('Korean');
      expect(novel.metadata?.targetLanguage).toBeNull();
      expect(novel.versions).toBeNull();
    });

    it('should process custom registry URL and return correct response structure', async () => {
      const customRegistryUrl = 'https://custom.example.com/registry.json';
      const mockRegistry = {
        version: '2.0',
        lastUpdated: '2025-12-01',
        novels: [
          { id: 'custom-novel', metadataUrl: 'https://custom.example.com/novel.json' }
        ]
      };
      const mockNovelMetadata = {
        id: 'custom-novel',
        title: 'Custom Novel',
        metadata: {
          originalLanguage: 'Chinese',
          targetLanguage: 'English',
          chapterCount: 200,
          genres: ['Cultivation'],
          description: 'A custom novel'
        },
        versions: [{
          versionId: 'custom-v1',
          displayName: 'Custom Translation'
        }]
      };

      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => mockRegistry })
        .mockResolvedValueOnce({ ok: true, json: async () => mockNovelMetadata });

      // Verify both registry and novel metadata are fetched and processed
      const novels = await RegistryService.fetchAllNovelMetadata(customRegistryUrl);

      expect(global.fetch).toHaveBeenCalledWith(customRegistryUrl);
      expect(global.fetch).toHaveBeenCalledWith('https://custom.example.com/novel.json');
      expect(novels).toHaveLength(1);
      expect(novels[0].title).toBe('Custom Novel');
      expect(novels[0].metadata?.originalLanguage).toBe('Chinese');
      expect(novels[0].versions?.[0]?.versionId).toBe('custom-v1');
    });
  });
});
