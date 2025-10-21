import { useAppStore } from '../store';
import type { SessionData, SessionProvenance } from '../types/session';
import type { NovelEntry, NovelMetadata } from '../types/novel';

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
   * Generate metadata.json for publishing to community library
   */
  static generateMetadataFile(novelMetadata: NovelMetadata & { title: string; alternateTitles?: string[] }): NovelEntry {
    const state = useAppStore.getState();
    const chapters = Array.from(state.chapters.values());

    // Generate a URL-safe ID from the title
    const id = novelMetadata.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Calculate chapter statistics
    const chapterCount = chapters.length;
    const translatedChapters = chapters.filter(ch => ch.translations?.length > 0).length;
    const totalImages = chapters.reduce((sum, ch) => {
      const images = ch.translations?.[0]?.images?.length || 0;
      return sum + images;
    }, 0);
    const totalFootnotes = chapters.reduce((sum, ch) => {
      const footnotes = ch.translations?.[0]?.footnotes?.length || 0;
      return sum + footnotes;
    }, 0);

    return {
      id,
      title: novelMetadata.title,
      alternateTitles: novelMetadata.alternateTitles,
      metadata: novelMetadata,
      versions: [
        {
          versionId: 'v1-primary',
          displayName: 'Primary Translation',
          translator: {
            name: novelMetadata.author || 'Unknown',
            link: novelMetadata.sourceLinks?.bestTranslation
          },
          sessionJsonUrl: `https://example.com/${id}/session.json`, // User will update this
          targetLanguage: 'English',
          style: 'faithful',
          features: [],
          chapterRange: {
            from: 1,
            to: chapterCount
          },
          completionStatus: 'In Progress',
          lastUpdated: new Date().toISOString().split('T')[0],
          stats: {
            downloads: 0,
            fileSize: '0MB',
            content: {
              totalImages,
              totalFootnotes,
              totalRawChapters: chapterCount,
              totalTranslatedChapters: translatedChapters,
              avgImagesPerChapter: chapterCount > 0 ? totalImages / chapterCount : 0,
              avgFootnotesPerChapter: chapterCount > 0 ? totalFootnotes / chapterCount : 0
            },
            translation: {
              translationType: 'human',
              feedbackCount: 0,
              qualityRating: 0
            }
          }
        }
      ]
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
