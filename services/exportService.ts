import { useAppStore } from '../store';
import { indexedDBService } from './indexeddb';
import type { SessionData, SessionProvenance } from '../types/session';
import type { NovelEntry, NovelMetadata } from '../types/novel';

export class ExportService {
  /**
   * Quick export - no metadata, just session data
   * Loads full chapter data from IndexedDB
   */
  static async generateQuickExport(): Promise<SessionData> {
    // Load full chapter data from IndexedDB
    const chapters = await indexedDBService.getAllChapters();

    // For each chapter, load its translations
    const chaptersWithTranslations = await Promise.all(
      chapters.map(async (ch) => {
        const stableId = ch.stableId || undefined;
        const canonicalUrl = ch.canonicalUrl || ch.url;
        const versions = stableId
          ? await indexedDBService.getTranslationVersionsByStableId(stableId)
          : await indexedDBService.getTranslationVersions(canonicalUrl);

        return {
          stableId,
          canonicalUrl,
          title: ch.title,
          content: ch.content,
          fanTranslation: ch.fanTranslation || null,
          nextUrl: ch.nextUrl || null,
          prevUrl: ch.prevUrl || null,
          chapterNumber: ch.chapterNumber ?? null,
          translations: versions.map(v => ({
            id: v.id,
            version: v.version,
            isActive: v.isActive,
            createdAt: v.createdAt,
            translatedTitle: v.translatedTitle,
            translation: v.translation,
            footnotes: v.footnotes,
            suggestedIllustrations: v.suggestedIllustrations,
            provider: v.provider,
            model: v.model,
            temperature: v.temperature,
            systemPrompt: v.systemPrompt,
            promptId: v.promptId,
            promptName: v.promptName,
            customVersionLabel: v.customVersionLabel,
            usageMetrics: {
              totalTokens: v.totalTokens,
              promptTokens: v.promptTokens,
              completionTokens: v.completionTokens,
              estimatedCost: v.estimatedCost,
              requestTime: v.requestTime,
              provider: v.provider,
              model: v.model
            }
          }))
        };
      })
    );

    console.log('[Export] Loaded', chaptersWithTranslations.length, 'chapters from IndexedDB');
    console.log('[Export] Chapters with translations:',
      chaptersWithTranslations.filter(ch => ch.translations.length > 0).length);

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
      chapters: chaptersWithTranslations,
      settings: {}
    };
  }

  /**
   * Publish export - new novel with full metadata
   * Loads full chapter data from IndexedDB
   */
  static async generatePublishExport(
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
  ): Promise<SessionData> {
    // Load full chapter data from IndexedDB
    const chapters = await indexedDBService.getAllChapters();

    // For each chapter, load its translations
    const chaptersWithTranslations = await Promise.all(
      chapters.map(async (ch) => {
        const stableId = ch.stableId || undefined;
        const canonicalUrl = ch.canonicalUrl || ch.url;
        const versions = stableId
          ? await indexedDBService.getTranslationVersionsByStableId(stableId)
          : await indexedDBService.getTranslationVersions(canonicalUrl);

        return {
          stableId,
          canonicalUrl,
          title: ch.title,
          content: ch.content,
          fanTranslation: ch.fanTranslation || null,
          nextUrl: ch.nextUrl || null,
          prevUrl: ch.prevUrl || null,
          chapterNumber: ch.chapterNumber ?? null,
          translations: versions.map(v => ({
            id: v.id,
            version: v.version,
            isActive: v.isActive,
            createdAt: v.createdAt,
            translatedTitle: v.translatedTitle,
            translation: v.translation,
            footnotes: v.footnotes,
            suggestedIllustrations: v.suggestedIllustrations,
            provider: v.provider,
            model: v.model,
            temperature: v.temperature,
            systemPrompt: v.systemPrompt,
            promptId: v.promptId,
            promptName: v.promptName,
            customVersionLabel: v.customVersionLabel,
            usageMetrics: {
              totalTokens: v.totalTokens,
              promptTokens: v.promptTokens,
              completionTokens: v.completionTokens,
              estimatedCost: v.estimatedCost,
              requestTime: v.requestTime,
              provider: v.provider,
              model: v.model
            }
          }))
        };
      })
    );

    // Calculate data size
    const jsonString = JSON.stringify(chaptersWithTranslations);
    console.log('[Export] Loaded', chaptersWithTranslations.length, 'chapters from IndexedDB');
    console.log('[Export] Chapters with translations:',
      chaptersWithTranslations.filter(ch => ch.translations.length > 0).length);
    console.log('[Export] Total data size (bytes):', jsonString.length);
    console.log('[Export] Total data size (KB):', Math.round(jsonString.length / 1024));

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
      chapters: chaptersWithTranslations,
      settings: {}
    };
  }

  /**
   * Fork export - based on existing version with lineage
   * Loads full chapter data from IndexedDB
   */
  static async generateForkExport(
    forkInfo: {
      versionId: string;
      displayName: string;
      translator: { name: string; link?: string };
      style: 'faithful' | 'liberal' | 'image-heavy' | 'audio-enhanced' | 'other';
      features: string[];
      changes?: string;
    }
  ): Promise<SessionData> {
    const state = useAppStore.getState();
    const parentProvenance = state.sessionProvenance;
    const parentVersion = state.sessionVersion;

    if (!parentProvenance || !parentVersion) {
      throw new Error('Cannot fork: no parent session loaded');
    }

    // Load full chapter data from IndexedDB
    const chapters = await indexedDBService.getAllChapters();

    // For each chapter, load its translations
    const chaptersWithTranslations = await Promise.all(
      chapters.map(async (ch) => {
        const stableId = ch.stableId || undefined;
        const canonicalUrl = ch.canonicalUrl || ch.url;
        const versions = stableId
          ? await indexedDBService.getTranslationVersionsByStableId(stableId)
          : await indexedDBService.getTranslationVersions(canonicalUrl);

        return {
          stableId,
          canonicalUrl,
          title: ch.title,
          content: ch.content,
          fanTranslation: ch.fanTranslation || null,
          nextUrl: ch.nextUrl || null,
          prevUrl: ch.prevUrl || null,
          chapterNumber: ch.chapterNumber ?? null,
          translations: versions.map(v => ({
            id: v.id,
            version: v.version,
            isActive: v.isActive,
            createdAt: v.createdAt,
            translatedTitle: v.translatedTitle,
            translation: v.translation,
            footnotes: v.footnotes,
            suggestedIllustrations: v.suggestedIllustrations,
            provider: v.provider,
            model: v.model,
            temperature: v.temperature,
            systemPrompt: v.systemPrompt,
            promptId: v.promptId,
            promptName: v.promptName,
            customVersionLabel: v.customVersionLabel,
            usageMetrics: {
              totalTokens: v.totalTokens,
              promptTokens: v.promptTokens,
              completionTokens: v.completionTokens,
              estimatedCost: v.estimatedCost,
              requestTime: v.requestTime,
              provider: v.provider,
              model: v.model
            }
          }))
        };
      })
    );

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
      chapters: chaptersWithTranslations,
      settings: {}
    };
  }

  /**
   * Generate metadata.json for publishing to community library
   * Loads chapter data from IndexedDB to calculate statistics
   */
  static async generateMetadataFile(novelMetadata: NovelMetadata & { title: string; alternateTitles?: string[] }): Promise<NovelEntry> {
    // Load full chapter data from IndexedDB
    const chapters = await indexedDBService.getAllChapters();

    // For each chapter, load its translations
    const chaptersWithTranslations = await Promise.all(
      chapters.map(async (ch) => {
        const stableId = ch.stableId || undefined;
        const canonicalUrl = ch.canonicalUrl || ch.url;
        const versions = stableId
          ? await indexedDBService.getTranslationVersionsByStableId(stableId)
          : await indexedDBService.getTranslationVersions(canonicalUrl);
        return { ...ch, translations: versions };
      })
    );

    // Generate a URL-safe ID from the title
    const id = novelMetadata.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Calculate chapter statistics
    const chapterCount = chaptersWithTranslations.length;
    const translatedChapters = chaptersWithTranslations.filter(ch => ch.translations.length > 0).length;
    const totalImages = chaptersWithTranslations.reduce((sum, ch) => {
      const images = ch.translations[0]?.suggestedIllustrations?.length || 0;
      return sum + images;
    }, 0);
    const totalFootnotes = chaptersWithTranslations.reduce((sum, ch) => {
      const footnotes = ch.translations[0]?.footnotes?.length || 0;
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
   * Save files to a directory using Directory Picker
   * Saves both metadata.json and session.json to the selected directory
   */
  static async saveToDirectory(
    metadataFile: NovelEntry,
    sessionData: any,
    novelId: string
  ): Promise<{ metadataPath: string; sessionPath: string }> {
    if (!('showDirectoryPicker' in window)) {
      throw new Error('Directory Picker not supported. Falling back to individual file saves.');
    }

    try {
      // @ts-ignore - File System Access API
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite'
      });

      // Create or get the novel-specific subdirectory
      const novelDirHandle = await dirHandle.getDirectoryHandle(novelId, { create: true });

      // Save metadata.json
      const metadataHandle = await novelDirHandle.getFileHandle('metadata.json', { create: true });
      const metadataWritable = await metadataHandle.createWritable();
      await metadataWritable.write(JSON.stringify(metadataFile, null, 2));
      await metadataWritable.close();

      // Save session.json
      const sessionHandle = await novelDirHandle.getFileHandle('session.json', { create: true });
      const sessionWritable = await sessionHandle.createWritable();
      await sessionWritable.write(JSON.stringify(sessionData, null, 2));
      await sessionWritable.close();

      console.log(`[Export] Saved files to ${novelId} directory`);

      return {
        metadataPath: `${novelId}/metadata.json`,
        sessionPath: `${novelId}/session.json`
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Directory selection cancelled');
      }
      throw error;
    }
  }

  /**
   * Update registry.json with a new novel entry
   * Prompts user to select the registry.json file, adds the novel, and saves it back
   */
  static async updateRegistry(novelEntry: NovelEntry): Promise<void> {
    if (!('showOpenFilePicker' in window)) {
      throw new Error('File System Access API not supported. Please use Chrome/Edge browser.');
    }

    try {
      // @ts-ignore - File System Access API
      const [fileHandle] = await window.showOpenFilePicker({
        types: [{
          description: 'Registry JSON',
          accept: { 'application/json': ['.json'] }
        }],
        multiple: false
      });

      // Read existing registry
      const file = await fileHandle.getFile();
      const content = await file.text();
      const registry = JSON.parse(content);

      // Check if novel already exists
      const existingIndex = registry.novels.findIndex((n: any) => n.id === novelEntry.id);

      if (existingIndex >= 0) {
        // Update existing entry
        const metadataUrl = registry.novels[existingIndex].metadataUrl;
        console.log(`[Registry] Updating existing novel: ${novelEntry.id}`);
        console.log(`[Registry] Keeping existing metadataUrl: ${metadataUrl}`);
        // Keep the existing metadataUrl
        registry.novels[existingIndex] = {
          id: novelEntry.id,
          metadataUrl: metadataUrl
        };
      } else {
        // Add new entry
        console.log(`[Registry] Adding new novel: ${novelEntry.id}`);

        // Generate default metadataUrl (user will need to update this)
        const metadataUrl = `https://raw.githubusercontent.com/anantham/lexiconforge-novels/main/novels/${novelEntry.id}/metadata.json`;

        registry.novels.push({
          id: novelEntry.id,
          metadataUrl: metadataUrl
        });
      }

      // Update lastUpdated timestamp
      registry.lastUpdated = new Date().toISOString().split('T')[0];

      // Sort novels by ID for consistency
      registry.novels.sort((a: any, b: any) => a.id.localeCompare(b.id));

      // Write back to the same file
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(registry, null, 2));
      await writable.close();

      console.log('[Registry] Registry updated successfully');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('File selection cancelled');
      }
      throw error;
    }
  }

  /**
   * Download JSON file
   * Uses File System Access API when available to let user choose save location
   */
  static async downloadJSON(data: any, filename: string, suggestedDirectory?: string) {
    const json = JSON.stringify(data, null, 2);

    // Try to use File System Access API (Chrome/Edge)
    if ('showSaveFilePicker' in window) {
      try {
        const opts: any = {
          suggestedName: filename,
          types: [{
            description: 'JSON Files',
            accept: { 'application/json': ['.json'] }
          }]
        };

        // @ts-ignore - File System Access API
        const handle = await window.showSaveFilePicker(opts);
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();

        console.log(`[Export] Saved ${filename} to user-selected location`);
        return;
      } catch (err: any) {
        // User cancelled or API not supported
        if (err.name !== 'AbortError') {
          console.warn('[Export] File System Access API failed:', err);
        }
      }
    }

    // Fallback to traditional download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`[Export] Downloaded ${filename} to default Downloads folder`);
  }
}
