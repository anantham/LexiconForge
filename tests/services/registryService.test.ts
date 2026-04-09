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
        chapterCount: 50,
        genres: ['Fantasy'],
        description: 'Test description',
        lastUpdated: '2025-01-19',
        coverImageUrl: './cover.jpg',
      },
      versions: [
        {
          versionId: 'v1',
          displayName: 'Version 1',
          translator: { name: 'Alice' },
          sessionJsonUrl: './session.json',
          targetLanguage: 'English',
          style: 'faithful',
          features: [],
          chapterRange: { from: 1, to: 50 },
          completionStatus: 'Complete',
          lastUpdated: '2025-01-19',
          stats: {
            downloads: 100,
            fileSize: '5 MB',
            content: {
              totalImages: 0,
              totalFootnotes: 0,
              totalRawChapters: 50,
              totalTranslatedChapters: 50,
              avgImagesPerChapter: 0,
              avgFootnotesPerChapter: 0
            },
            translation: {
              translationType: 'human',
              feedbackCount: 0,
              qualityRating: 4.5
            }
          },
          glossaryLayers: [
            {
              tier: 'book',
              url: './glossary.json',
            },
          ],
        }
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockMetadata
    });

    const metadata = await RegistryService.fetchNovelMetadata('https://example.com/novel.json');

    expect(metadata.id).toBe('test-novel');
    expect(metadata.versions).toHaveLength(1);
    expect(metadata.versions?.[0].sessionJsonUrl).toBe('https://example.com/session.json');
    expect(metadata.versions?.[0].glossaryLayers?.[0].url).toBe('https://example.com/glossary.json');
    expect(metadata.metadata.coverImageUrl).toBe('https://example.com/cover.jpg');
  });

  it('rewrites raw GitHub session artifacts to media GitHub URLs', async () => {
    const mockMetadata: NovelEntry = {
      id: 'fmc',
      title: 'FMC',
      metadata: {
        originalLanguage: 'Chinese',
        chapterCount: 1,
        genres: ['Sci-fi'],
        description: 'Test description',
        lastUpdated: '2025-01-19',
      },
      versions: [
        {
          versionId: 'v1',
          displayName: 'Version 1',
          translator: { name: 'Alice' },
          sessionJsonUrl: './session.json',
          targetLanguage: 'English',
          style: 'faithful',
          features: [],
          chapterRange: { from: 1, to: 1 },
          completionStatus: 'Complete',
          lastUpdated: '2025-01-19',
          stats: {
            downloads: 1,
            fileSize: '1 MB',
            content: {
              totalImages: 0,
              totalFootnotes: 0,
              totalRawChapters: 1,
              totalTranslatedChapters: 1,
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

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockMetadata,
    });

    const metadata = await RegistryService.fetchNovelMetadata(
      'https://raw.githubusercontent.com/anantham/lexiconforge-novels/main/novels/fmc/metadata.json'
    );

    expect(metadata.versions?.[0].sessionJsonUrl).toBe(
      'https://media.githubusercontent.com/media/anantham/lexiconforge-novels/main/novels/fmc/session.json'
    );
  });

  it('should fetch a novel by registry id', async () => {
    const mockRegistry: Registry = {
      version: '2.0',
      lastUpdated: '2025-01-19',
      novels: [{ id: 'test-novel', metadataUrl: 'https://example.com/novel.json' }],
    };

    const mockMetadata: NovelEntry = {
      id: 'test-novel',
      title: 'Test Novel',
      metadata: {
        originalLanguage: 'Korean',
        chapterCount: 50,
        genres: ['Fantasy'],
        description: 'Test description',
        lastUpdated: '2025-01-19',
      },
    };

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRegistry,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetadata,
      });

    const metadata = await RegistryService.fetchNovelById('test-novel');

    expect(metadata?.id).toBe('test-novel');
  });

  it('should handle fetch errors gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Not Found'
    });

    await expect(RegistryService.fetchRegistry()).rejects.toThrow('Failed to fetch registry');
  });

  it('resolves legacy aliases and falls back to the only remaining version', () => {
    const aliasResolution = RegistryService.resolveCompatibleVersion(
      {
        id: 'test-novel',
        title: 'Test Novel',
        metadata: {
          originalLanguage: 'Korean',
          chapterCount: 50,
          genres: ['Fantasy'],
          description: 'Test description',
          lastUpdated: '2025-01-19',
        },
        versions: [
          {
            versionId: 'v2',
            legacyVersionIds: ['v1-composite'],
            displayName: 'Version 2',
            translator: { name: 'Alice' },
            sessionJsonUrl: 'https://example.com/session.json',
            targetLanguage: 'English',
            style: 'faithful',
            features: [],
            chapterRange: { from: 1, to: 50 },
            completionStatus: 'Complete',
            lastUpdated: '2025-01-19',
            stats: {
              downloads: 100,
              fileSize: '5 MB',
              content: {
                totalImages: 0,
                totalFootnotes: 0,
                totalRawChapters: 50,
                totalTranslatedChapters: 50,
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
      },
      'v1-composite'
    );

    expect(aliasResolution.version?.versionId).toBe('v2');
    expect(aliasResolution.warning).toContain('v1-composite');

    const fallbackResolution = RegistryService.resolveCompatibleVersion(
      {
        id: 'fallback-novel',
        title: 'Fallback Novel',
        metadata: {
          originalLanguage: 'Chinese',
          chapterCount: 10,
          genres: ['Fantasy'],
          description: 'Fallback test',
          lastUpdated: '2025-01-19',
        },
        versions: [
          {
            versionId: 'new-version',
            displayName: 'New Version',
            translator: { name: 'Bob' },
            sessionJsonUrl: 'https://example.com/new.json',
            targetLanguage: 'English',
            style: 'faithful',
            features: [],
            chapterRange: { from: 1, to: 10 },
            completionStatus: 'Complete',
            lastUpdated: '2025-01-19',
            stats: {
              downloads: 1,
              fileSize: '1 MB',
              content: {
                totalImages: 0,
                totalFootnotes: 0,
                totalRawChapters: 10,
                totalTranslatedChapters: 10,
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
      },
      'old-version'
    );

    expect(fallbackResolution.version?.versionId).toBe('new-version');
    expect(fallbackResolution.warning).toContain('Using "New Version" instead.');
  });
});
