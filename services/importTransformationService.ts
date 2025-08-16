/**
 * Import Transformation Service
 * 
 * This service provides the compatibility layer between existing JSON imports
 * and the new stable ID system. It transforms incoming JSON data and integrates
 * with the existing useAppStore while using stable IDs under the hood.
 */

import { 
  transformImportedChapters, 
  toLegacySessionData, 
  StableSessionData,
  getSortedChaptersForRendering 
} from './stableIdService';
import { stableIdIndexedDBService } from './stableIdIndexedDB';

export interface ImportTransformationResult {
  success: boolean;
  message: string;
  stats: {
    chaptersProcessed: number;
    novelsDetected: number;
    urlMappingsCreated: number;
    conflicts: number;
  };
  transformedData?: StableSessionData;
}

/**
 * Enhanced import function that transforms JSON to stable IDs
 * while maintaining compatibility with existing useAppStore interface
 */
export class ImportTransformationService {
  
  /**
   * Process imported JSON file and convert to stable ID format
   */
  static async processImportedFile(
    file: File,
    existingSessionData: Record<string, any> = {}
  ): Promise<ImportTransformationResult> {
    try {
      console.log('[ImportTransformation] Processing imported file:', file.name);
      
      // Read and parse the file
      const fileContent = await this.readFileContent(file);
      const importedData = JSON.parse(fileContent);
      
      // Validate file format
      const validationResult = this.validateImportedData(importedData);
      if (!validationResult.isValid) {
        return {
          success: false,
          message: `Invalid file format: ${validationResult.error}`,
          stats: { chaptersProcessed: 0, novelsDetected: 0, urlMappingsCreated: 0, conflicts: 0 }
        };
      }
      
      // Transform to stable ID format
      const stableData = transformImportedChapters(
        importedData.chapters,
        importedData.metadata
      );
      
      console.log('[ImportTransformation] Transformation complete:', {
        novels: stableData.novels.size,
        chapters: stableData.chapters.size,
        urlMappings: stableData.urlIndex.size + stableData.rawUrlIndex.size
      });
      
      // Detect conflicts with existing data
      const conflicts = await this.detectConflicts(stableData, existingSessionData);
      
      // Store in IndexedDB
      await stableIdIndexedDBService.importStableSessionData(stableData);
      
      return {
        success: true,
        message: `Successfully imported ${stableData.chapters.size} chapters from ${stableData.novels.size} novel(s)`,
        stats: {
          chaptersProcessed: stableData.chapters.size,
          novelsDetected: stableData.novels.size,
          urlMappingsCreated: stableData.urlIndex.size + stableData.rawUrlIndex.size,
          conflicts: conflicts.length
        },
        transformedData: stableData
      };
      
    } catch (error: any) {
      console.error('[ImportTransformation] Import failed:', error);
      return {
        success: false,
        message: `Import failed: ${error.message}`,
        stats: { chaptersProcessed: 0, novelsDetected: 0, urlMappingsCreated: 0, conflicts: 0 }
      };
    }
  }
  
  /**
   * Convert stable ID data to legacy format for compatibility
   * This allows existing components to work unchanged
   */
  static async convertToLegacyFormat(stableData: StableSessionData): Promise<{
    sessionData: Record<string, any>;
    urlHistory: string[];
    currentUrl: string | null;
  }> {
    const legacySessionData = toLegacySessionData(stableData);
    
    // Build URL history from navigation history (simplified)
    const urlHistory: string[] = [];
    for (const chapterId of stableData.navigationHistory) {
      const chapter = stableData.chapters.get(chapterId);
      if (chapter) {
        urlHistory.push(chapter.canonicalUrl);
      }
    }
    
    // Determine current URL
    let currentUrl: string | null = null;
    if (stableData.currentChapterId) {
      const currentChapter = stableData.chapters.get(stableData.currentChapterId);
      currentUrl = currentChapter?.canonicalUrl || null;
    }
    
    return {
      sessionData: legacySessionData,
      urlHistory,
      currentUrl
    };
  }
  
  /**
   * Get sorted chapters with stable keys for React rendering
   */
  static async getChaptersForReactRendering(): Promise<Array<{
    stableId: string;           // Use this for React keys!
    url: string;               // Use this for navigation
    data: any;                 // Chapter and translation data
    title: string;
    chapterNumber: number;
  }>> {
    try {
      await stableIdIndexedDBService.initialize();
      const renderingData = await stableIdIndexedDBService.getChaptersForRendering();
      
      return renderingData.map(({ id, chapter, canonicalUrl }) => ({
        stableId: id,              // This is the stable ID for React keys
        url: canonicalUrl,         // This is for navigation and compatibility
        data: {
          chapter: {
            title: chapter.title,
            content: chapter.content,
            originalUrl: chapter.canonicalUrl,
            nextUrl: undefined, // TODO: Resolve from nextChapterId
            prevUrl: undefined, // TODO: Resolve from prevChapterId
            chapterNumber: chapter.chapterNumber,
          },
          translationResult: null    // TODO: Load from translations store
        },
        title: chapter.title,
        chapterNumber: chapter.chapterNumber
      }));
      
    } catch (error) {
      console.error('[ImportTransformation] Failed to get chapters for rendering:', error);
      return [];
    }
  }
  
  /**
   * Find chapter by URL (maintains compatibility with existing lookup patterns)
   */
  static async findChapterByUrl(url: string): Promise<{
    stableId: string;
    canonicalUrl: string;
    data: any;
  } | null> {
    try {
      await stableIdIndexedDBService.initialize();
      const chapter = await stableIdIndexedDBService.findChapterByUrl(url);
      
      if (!chapter) return null;
      
      return {
        stableId: chapter.id,
        canonicalUrl: chapter.canonicalUrl,
        data: {
          chapter: {
            title: chapter.title,
            content: chapter.content,
            originalUrl: chapter.canonicalUrl,
            nextUrl: undefined, // TODO: Resolve from nextChapterId
            prevUrl: undefined, // TODO: Resolve from prevChapterId
            chapterNumber: chapter.chapterNumber,
          },
          translationResult: null    // TODO: Load from translations store
        }
      };
      
    } catch (error) {
      console.error('[ImportTransformation] Failed to find chapter by URL:', error);
      return null;
    }
  }
  
  // Private utility methods
  
  private static async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
  
  private static validateImportedData(data: any): { isValid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
      return { isValid: false, error: 'Invalid JSON format' };
    }
    
    if (!data.chapters || !Array.isArray(data.chapters)) {
      return { isValid: false, error: 'No chapters array found' };
    }
    
    if (data.chapters.length === 0) {
      return { isValid: false, error: 'No chapters in file' };
    }
    
    // Validate essential fields in first chapter
    const firstChapter = data.chapters[0];
    if (!firstChapter.content || !firstChapter.title) {
      return { isValid: false, error: 'Chapters missing required fields (content, title)' };
    }
    
    return { isValid: true };
  }
  
  private static async detectConflicts(
    stableData: StableSessionData, 
    existingSessionData: Record<string, any>
  ): Promise<string[]> {
    const conflicts: string[] = [];
    
    // Check for URL conflicts
    for (const [url] of stableData.urlIndex) {
      if (existingSessionData[url]) {
        conflicts.push(url);
      }
    }
    
    return conflicts;
  }
}

/**
 * Integration hook for useAppStore
 * This function can be called from the store to get stable-ID based data
 * while maintaining the existing interface
 */
export const getStableSessionDataForStore = async (): Promise<{
  sessionData: Record<string, any>;
  sortedChaptersWithStableKeys: Array<{
    stableId: string;
    url: string;
    data: any;
  }>;
}> => {
  try {
    const chaptersForRendering = await ImportTransformationService.getChaptersForReactRendering();
    
    // Convert to the format expected by the store
    const sessionData: Record<string, any> = {};
    const sortedChaptersWithStableKeys: Array<{
      stableId: string;
      url: string;
      data: any;
    }> = [];
    
    for (const chapter of chaptersForRendering) {
      sessionData[chapter.url] = chapter.data;
      sortedChaptersWithStableKeys.push({
        stableId: chapter.stableId,
        url: chapter.url,
        data: chapter.data
      });
    }
    
    return {
      sessionData,
      sortedChaptersWithStableKeys
    };
    
  } catch (error) {
    console.error('[ImportTransformation] Failed to get stable session data for store:', error);
    return {
      sessionData: {},
      sortedChaptersWithStableKeys: []
    };
  }
};