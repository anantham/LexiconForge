import { describe, it, expect } from 'vitest';
import type {
  NovelVersion,
  NovelMetadata,
  NovelProvenance,
  VersionContributor
} from './novel';

describe('Novel Types', () => {
  it('should accept valid version with all fields', () => {
    const version: NovelVersion = {
      versionId: 'test-v1',
      displayName: 'Test Version',
      translator: { name: 'Alice', link: 'https://github.com/alice' },
      sessionJsonUrl: 'https://example.com/session.json',
      targetLanguage: 'English',
      style: 'faithful',
      features: ['footnotes'],
      chapterRange: { from: 1, to: 50 },
      completionStatus: 'Complete',
      lastUpdated: '2025-01-19',
      stats: {
        downloads: 100,
        fileSize: '5 MB',
        content: {
          totalImages: 25,
          totalFootnotes: 150,
          totalRawChapters: 50,
          totalTranslatedChapters: 50,
          avgImagesPerChapter: 0.5,
          avgFootnotesPerChapter: 3
        },
        translation: {
          translationType: 'human',
          qualityRating: 4.5,
          feedbackCount: 42
        }
      }
    };

    expect(version.versionId).toBe('test-v1');
    expect(version.stats.content.totalImages).toBe(25);
  });

  it('should accept version with basedOn for forks', () => {
    const fork: NovelVersion = {
      versionId: 'fork-v1',
      displayName: 'Fork Version',
      translator: { name: 'Bob' },
      sessionJsonUrl: 'https://example.com/fork.json',
      targetLanguage: 'English',
      style: 'image-heavy',
      features: ['ai-images'],
      basedOn: 'test-v1',
      chapterRange: { from: 1, to: 10 },
      completionStatus: 'In Progress',
      lastUpdated: '2025-01-19',
      stats: { downloads: 10, fileSize: '10 MB' }
    };

    expect(fork.basedOn).toBe('test-v1');
  });

  it('should accept provenance with contributors', () => {
    const provenance: NovelProvenance = {
      originalCreator: {
        name: 'Alice',
        versionId: 'alice-v1',
        createdAt: '2025-01-01T00:00:00Z'
      },
      forkedFrom: {
        versionId: 'alice-v1',
        sessionUrl: 'https://example.com/alice.json',
        forkedAt: '2025-01-15T00:00:00Z'
      },
      contributors: [
        { name: 'Alice', role: 'original-translator', dateRange: '2025-01-01' },
        { name: 'Bob', role: 'enhancer', changes: 'Added images', dateRange: '2025-01-15' }
      ]
    };

    expect(provenance.contributors).toHaveLength(2);
  });
});
