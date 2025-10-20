import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportService } from '../../services/exportService';
import { useAppStore } from '../../store';
import type { SessionProvenance } from '../../types/session';

describe('ExportService', () => {
  beforeEach(() => {
    useAppStore.setState({
      chapters: new Map(),
      sessionProvenance: null,
      sessionVersion: null
    });
  });

  it('should generate quick export without provenance', () => {
    const chapters = new Map([
      ['ch1', { id: 'ch1', title: 'Chapter 1', content: 'Test' }]
    ]);
    useAppStore.setState({ chapters });

    const exportData = ExportService.generateQuickExport();

    expect(exportData.metadata.format).toBe('lexiconforge-session');
    expect(exportData.chapters).toHaveLength(1);
    expect(exportData.provenance).toBeUndefined();
  });

  it('should generate publish export with metadata and provenance', () => {
    const chapters = new Map([
      ['ch1', { id: 'ch1', title: 'Chapter 1', content: 'Test' }]
    ]);
    useAppStore.setState({ chapters });

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

    const exportData = ExportService.generatePublishExport(novelMetadata, versionInfo);

    expect(exportData.novel.id).toBe('test-novel');
    expect(exportData.version.versionId).toBe('v1');
    expect(exportData.provenance.originalCreator.name).toBe('Alice');
  });

  it('should generate fork export with parent lineage', () => {
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

    const exportData = ExportService.generateForkExport(forkInfo);

    expect(exportData.provenance.originalCreator.name).toBe('Alice');
    expect(exportData.provenance.forkedFrom?.versionId).toBe('alice-v1');
    expect(exportData.provenance.contributors).toHaveLength(2);
    expect(exportData.provenance.contributors[1].name).toBe('Bob');
  });
});
