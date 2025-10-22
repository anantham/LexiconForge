import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportService } from '../../services/exportService';
import { useAppStore } from '../../store';
import { indexedDBService } from '../../services/indexeddb';
import type { SessionProvenance } from '../../types/session';

// Mock IndexedDB service
vi.mock('../../services/indexeddb', () => ({
  indexedDBService: {
    getAllChapters: vi.fn(),
    getTranslationVersions: vi.fn(),
    getTranslationVersionsByStableId: vi.fn()
  }
}));

describe('ExportService', () => {
  beforeEach(() => {
    // Reset store state
    useAppStore.setState({
      chapters: new Map(),
      sessionProvenance: null,
      sessionVersion: null
    });

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock implementations
    vi.mocked(indexedDBService.getAllChapters).mockResolvedValue([
      {
        id: 'ch1',
        title: 'Chapter 1',
        content: 'Test content',
        url: 'http://example.com/ch1',
        canonicalUrl: 'http://example.com/ch1',
        stableId: null,
        chapterNumber: 1,
        nextUrl: null,
        prevUrl: null,
        fanTranslation: null
      }
    ]);

    vi.mocked(indexedDBService.getTranslationVersions).mockResolvedValue([
      {
        id: 'trans1',
        version: 1,
        isActive: true,
        createdAt: '2025-01-20T00:00:00Z',
        translatedTitle: 'Chapter 1',
        translation: 'Translated content',
        footnotes: [],
        suggestedIllustrations: [],
        provider: 'Gemini',
        model: 'gemini-2.0-flash',
        temperature: 0.7,
        systemPrompt: 'Test prompt',
        promptId: 'test-prompt',
        promptName: 'Test Prompt',
        customVersionLabel: null,
        totalTokens: 100,
        promptTokens: 50,
        completionTokens: 50,
        estimatedCost: 0.001,
        requestTime: 1000
      }
    ]);
  });

  it('should generate quick export without provenance', async () => {
    const exportData = await ExportService.generateQuickExport();

    expect(exportData.metadata.format).toBe('lexiconforge-session');
    expect(exportData.metadata.version).toBe('2.0');
    expect(exportData.chapters).toHaveLength(1);
    expect(exportData.chapters[0].title).toBe('Chapter 1');
    expect(exportData.provenance).toBeUndefined();

    // Verify IndexedDB was called
    expect(indexedDBService.getAllChapters).toHaveBeenCalled();
  });

  it('should generate publish export with metadata and provenance', async () => {
    const novelMetadata = {
      id: 'test-novel',
      title: 'Test Novel',
      author: 'Test Author',
      originalLanguage: 'Korean'
    };

    const versionInfo = {
      versionId: 'v1',
      displayName: 'Version 1',
      translator: { name: 'Alice' },
      style: 'faithful' as const,
      features: ['footnotes']
    };

    const exportData = await ExportService.generatePublishExport(novelMetadata, versionInfo);

    expect(exportData.novel.id).toBe('test-novel');
    expect(exportData.novel.title).toBe('Test Novel');
    expect(exportData.version.versionId).toBe('v1');
    expect(exportData.version.displayName).toBe('Version 1');
    expect(exportData.provenance?.originalCreator.name).toBe('Alice');
    expect(exportData.provenance?.contributors).toHaveLength(1);
    expect(exportData.provenance?.contributors[0].role).toBe('original-translator');

    // Verify IndexedDB was called
    expect(indexedDBService.getAllChapters).toHaveBeenCalled();
  });

  it('should generate fork export with parent lineage', async () => {
    const parentProvenance: SessionProvenance = {
      originalCreator: {
        name: 'Alice',
        versionId: 'alice-v1',
        createdAt: '2025-01-01T00:00:00Z'
      },
      contributors: [
        { name: 'Alice', role: 'original-translator', dateRange: '2025-01-01' }
      ]
    };

    useAppStore.setState({
      sessionProvenance: parentProvenance,
      sessionVersion: {
        versionId: 'alice-v1',
        displayName: 'Alice Version',
        style: 'faithful',
        features: []
      }
    });

    const forkInfo = {
      versionId: 'bob-v1',
      displayName: 'Bob Fork',
      translator: { name: 'Bob' },
      style: 'image-heavy' as const,
      features: ['ai-images'],
      changes: 'Added illustrations'
    };

    const exportData = await ExportService.generateForkExport(forkInfo);

    expect(exportData.provenance.originalCreator.name).toBe('Alice');
    expect(exportData.provenance.forkedFrom?.versionId).toBe('alice-v1');
    expect(exportData.provenance.contributors).toHaveLength(2);
    expect(exportData.provenance.contributors[0].name).toBe('Alice');
    expect(exportData.provenance.contributors[1].name).toBe('Bob');
    expect(exportData.provenance.contributors[1].role).toBe('enhancer');
    expect(exportData.provenance.contributors[1].changes).toBe('Added illustrations');

    // Verify IndexedDB was called
    expect(indexedDBService.getAllChapters).toHaveBeenCalled();
  });
});
