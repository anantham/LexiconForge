import { describe, it, expect, vi } from 'vitest';
import { RegistryService } from '../../services/registryService';
import type { Registry, NovelEntry } from '../../types/novel';

describe('RegistryService', () => {
  it('should fetch registry from URL', async () => {
    const mockRegistry: Registry = {
      version: '2.0',
      lastUpdated: '2025-01-19',
      novels: [
        { id: 'novel-1', metadataUrl: 'https://example.com/novel-1.json' },
        { id: 'novel-2', metadataUrl: 'https://example.com/novel-2.json' }
      ]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRegistry
    });

    const registry = await RegistryService.fetchRegistry();

    expect(registry.novels).toHaveLength(2);
  });

  it('should fetch metadata for a novel', async () => {
    const mockMetadata: NovelEntry = {
      id: 'test-novel',
      title: 'Test Novel',
      metadata: {
        originalLanguage: 'Korean',
        genres: ['Fantasy'],
        description: 'Test description',
        lastUpdated: '2025-01-19'
      },
      versions: [
        {
          versionId: 'v1',
          displayName: 'Version 1',
          translator: { name: 'Alice' },
          sessionJsonUrl: 'https://example.com/session.json',
          targetLanguage: 'English',
          style: 'faithful',
          features: [],
          chapterRange: { from: 1, to: 50 },
          completionStatus: 'Complete',
          lastUpdated: '2025-01-19',
          stats: { downloads: 100, fileSize: '5 MB' }
        }
      ]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockMetadata
    });

    const metadata = await RegistryService.fetchNovelMetadata('https://example.com/novel.json');

    expect(metadata.id).toBe('test-novel');
    expect(metadata.versions).toHaveLength(1);
  });

  it('should handle fetch errors gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Not Found'
    });

    await expect(RegistryService.fetchRegistry()).rejects.toThrow('Failed to fetch registry');
  });
});
