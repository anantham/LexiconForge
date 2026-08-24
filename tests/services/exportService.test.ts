import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportService } from '../../services/exportService';
import { useAppStore } from '../../store';
import type { TranslationRecord } from '../../services/db/types';
import type { SessionProvenance } from '../../types/session';
import { computeSemanticCorpusIdentity } from '../../services/semanticOscilloscopeSession';

const chapterOpsMock = vi.hoisted(() => ({
  getAll: vi.fn(),
}));

const translationOpsMock = vi.hoisted(() => ({
  getVersionsByStableId: vi.fn(),
  getVersionsByUrl: vi.fn(),
}));

vi.mock('../../services/db/operations', () => ({
  ChapterOps: chapterOpsMock,
  TranslationOps: translationOpsMock,
}));

describe('ExportService', () => {
  beforeEach(() => {
    // Reset store state
    useAppStore.setState({
      chapters: new Map(),
      sessionProvenance: null,
      sessionVersion: null,
      threads: new Map(),
      activeThreadIds: new Set(),
      corpusIdentity: null,
    });

    // Reset all mocks
    vi.clearAllMocks();
    chapterOpsMock.getAll.mockReset();
    translationOpsMock.getVersionsByStableId.mockReset();
    translationOpsMock.getVersionsByUrl.mockReset();

    // Setup default mock implementations
    const timestamp = '2025-01-20T00:00:00Z';
    chapterOpsMock.getAll.mockResolvedValue([
      {
        url: 'http://example.com/ch1',
        originalUrl: 'http://example.com/ch1',
        title: 'Chapter 1',
        content: 'Test content',
        canonicalUrl: 'http://example.com/ch1',
        stableId: 'stable-ch1',
        chapterNumber: 1,
        nextUrl: null,
        prevUrl: null,
        fanTranslation: null,
        dateAdded: timestamp,
        lastAccessed: timestamp,
      },
    ]);

    const translationRecords: TranslationRecord[] = [
      {
        id: 'trans1',
        chapterUrl: 'http://example.com/ch1',
        version: 1,
        isActive: true,
        createdAt: timestamp,
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
        customVersionLabel: undefined,
        totalTokens: 100,
        promptTokens: 50,
        completionTokens: 50,
        estimatedCost: 0.001,
        requestTime: 1000,
        stableId: 'stable-ch1',
        settingsSnapshot: {
          provider: 'Gemini',
          model: 'gemini-2.0-flash',
          temperature: 0.7,
          systemPrompt: 'Test prompt',
        },
      },
    ];
    translationOpsMock.getVersionsByUrl.mockResolvedValue(translationRecords);
    translationOpsMock.getVersionsByStableId.mockResolvedValue(translationRecords);
  });

  it('should generate quick export without provenance', async () => {
    const exportData = await ExportService.generateQuickExport();

    expect(exportData.metadata.format).toBe('lexiconforge-session');
    expect(exportData.metadata.version).toBe('2.0');
    expect(exportData.chapters).toHaveLength(1);
    expect(exportData.chapters[0].title).toBe('Chapter 1');
    expect(exportData.provenance).toBeUndefined();
    expect(exportData.oscilloscope?.corpus.chapterCount).toBe(1);

    // Verify IndexedDB was called
    expect(chapterOpsMock.getAll).toHaveBeenCalled();
  });

  it('freezes precomputed scalar tracks into a portable quick export', async () => {
    useAppStore.setState({
      threads: new Map([['tone:romance', {
        threadId: 'tone:romance',
        category: 'tone',
        label: 'romance',
        color: '#ef4444',
        values: [0.42],
        totalChapters: 1,
        provenance: { origin: 'precomputed', method: 'semantic-v1' },
      }]]),
      activeThreadIds: new Set(['tone:romance']),
    });

    const exportData = await ExportService.generateQuickExport();

    expect(exportData.oscilloscope?.threads[0]).toMatchObject({
      threadId: 'tone:romance',
      values: [0.42],
    });
    expect(JSON.stringify(exportData.oscilloscope)).not.toMatch(/baseUrl|endpoint|asus/i);
  });

  it('retains the loaded corpus and version for corpus-bound quick-export tracks', async () => {
    const corpus = await computeSemanticCorpusIdentity({
      novel: { id: 'test-novel', title: 'Test Novel' },
      version: { versionId: 'v1', displayName: 'V1', style: 'other', features: [] },
      chapters: [{
        chapterNumber: 1,
        title: 'Chapter 1',
        content: 'Test content',
        fanTranslation: null,
        translations: [{ version: 1, isActive: true, translation: 'Translated content' }],
      }],
    });
    useAppStore.setState({
      corpusIdentity: corpus,
      threads: new Map([['custom:trust', {
        threadId: 'custom:trust', category: 'custom', label: 'trust', color: '#ec4899',
        values: [0.7], totalChapters: 1,
        provenance: {
          origin: 'private-semantic-scan', query: 'trust', generatedAt: '2026-08-24T00:00:00Z',
          protocol: 'lexiconforge-semantic-oscilloscope-v1',
          scoreSemantics: 'cosine-similarity-clipped-0-1',
          vectorSpace: 'qwen3-embedding-8b:mrl-512:l2-v1', dimensions: 512,
          scoring: { algorithm: 'chapter-top-2-mean-cosine-v1', range: [0, 1] }, corpus,
        },
      }]]),
      activeThreadIds: new Set(['custom:trust']),
    });

    const exportData = await ExportService.generateQuickExport();

    expect(exportData.novel.id).toBe('test-novel');
    expect(exportData.version.versionId).toBe('v1');
    expect(exportData.oscilloscope?.threads).toHaveLength(1);
    expect(exportData.oscilloscope?.threads[0].threadId).toBe('custom:trust');
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
    expect(chapterOpsMock.getAll).toHaveBeenCalled();
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

    expect(exportData.provenance).toBeDefined();
    const provenance = exportData.provenance!;
    expect(provenance.originalCreator.name).toBe('Alice');
    expect(provenance.forkedFrom?.versionId).toBe('alice-v1');
    expect(provenance.contributors).toHaveLength(2);
    expect(provenance.contributors[0].name).toBe('Alice');
    expect(provenance.contributors[1].name).toBe('Bob');
    expect(provenance.contributors[1].role).toBe('enhancer');
    expect(provenance.contributors[1].changes).toBe('Added illustrations');

    // Verify IndexedDB was called
    expect(chapterOpsMock.getAll).toHaveBeenCalled();
  });
});
