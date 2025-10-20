import { useAppStore } from '../store';
import type { SessionData, SessionProvenance } from '../types/session';

export class ExportService {
  /**
   * Quick export - no metadata, just session data
   */
  static generateQuickExport(): SessionData {
    const state = useAppStore.getState();
    const chapters = Array.from(state.chapters.values());

    return {
      metadata: {
        format: 'lexiconforge-session',
        version: '2.0',
        exportedAt: new Date().toISOString()
      },
      novel: {
        id: 'unknown',
        title: 'Untitled Novel'
      },
      version: {
        versionId: 'quick-export',
        displayName: 'Quick Export',
        style: 'other',
        features: []
      },
      chapters: chapters as any[],
      settings: {}
    };
  }

  /**
   * Publish export - new novel with full metadata
   */
  static generatePublishExport(
    novelMetadata: {
      id: string;
      title: string;
      author: string;
      originalLanguage: string;
    },
    versionInfo: {
      versionId: string;
      displayName: string;
      translator: { name: string; link?: string };
      style: 'faithful' | 'liberal' | 'image-heavy' | 'audio-enhanced' | 'other';
      features: string[];
    }
  ): SessionData {
    const state = useAppStore.getState();
    const chapters = Array.from(state.chapters.values());

    const now = new Date().toISOString();

    return {
      metadata: {
        format: 'lexiconforge-session',
        version: '2.0',
        exportedAt: now
      },
      novel: {
        id: novelMetadata.id,
        title: novelMetadata.title
      },
      version: versionInfo,
      provenance: {
        originalCreator: {
          name: versionInfo.translator.name,
          link: versionInfo.translator.link,
          versionId: versionInfo.versionId,
          createdAt: now
        },
        contributors: [
          {
            name: versionInfo.translator.name,
            role: 'original-translator',
            dateRange: now.split('T')[0]
          }
        ]
      },
      chapters: chapters as any[],
      settings: {}
    };
  }

  /**
   * Fork export - based on existing version with lineage
   */
  static generateForkExport(
    forkInfo: {
      versionId: string;
      displayName: string;
      translator: { name: string; link?: string };
      style: 'faithful' | 'liberal' | 'image-heavy' | 'audio-enhanced' | 'other';
      features: string[];
      changes?: string;
    }
  ): SessionData {
    const state = useAppStore.getState();
    const chapters = Array.from(state.chapters.values());
    const parentProvenance = state.sessionProvenance;
    const parentVersion = state.sessionVersion;

    if (!parentProvenance || !parentVersion) {
      throw new Error('Cannot fork: no parent session loaded');
    }

    const now = new Date().toISOString();

    // Build new provenance with lineage
    const newProvenance: SessionProvenance = {
      originalCreator: parentProvenance.originalCreator,
      forkedFrom: {
        versionId: parentVersion.versionId,
        sessionUrl: '', // Will be filled by user when uploading
        forkedAt: now
      },
      contributors: [
        ...parentProvenance.contributors,
        {
          name: forkInfo.translator.name,
          link: forkInfo.translator.link,
          role: 'enhancer',
          changes: forkInfo.changes || 'Forked and enhanced',
          dateRange: now.split('T')[0]
        }
      ]
    };

    return {
      metadata: {
        format: 'lexiconforge-session',
        version: '2.0',
        exportedAt: now
      },
      novel: {
        id: 'unknown', // Will inherit from parent metadata
        title: 'Unknown'
      },
      version: forkInfo,
      provenance: newProvenance,
      chapters: chapters as any[],
      settings: {}
    };
  }

  /**
   * Download JSON file
   */
  static downloadJSON(data: any, filename: string) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
