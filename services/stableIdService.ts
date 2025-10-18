/**
 * Stable ID Service - Generates consistent chapter IDs for React keys
 * 
 * This service addresses the React key duplication issue by:
 * 1. Creating stable, content-based IDs that don't change with URL variations
 * 2. Maintaining backward compatibility with existing JSON formats
 * 3. Providing a transformation layer between import and storage
 */

import { Chapter, TranslationResult, AppSettings, FeedbackItem } from '../types';
import { debugLog } from '../utils/debug';

/**
 * Generates a stable chapter ID based on content characteristics
 * Uses a combination of:
 * - Content hash (first 8 chars)
 * - Chapter number
 * - Title hash (first 4 chars)
 * This ensures uniqueness while being deterministic
 */
export const generateStableChapterId = (
  content: string,
  chapterNumber: number,
  title: string
): string => {
  // Simple hash function for browser compatibility
  const simpleHash = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  };

  const contentHash = simpleHash(content.substring(0, 1000)); // First 1000 chars for performance
  const titleHash = simpleHash(title);
  
  // Format: ch{number}_{contentHash}_{titleHash}
  // Example: ch1_a7b2c3d4_x9y8
  return `ch${chapterNumber}_${contentHash.substring(0, 8)}_${titleHash.substring(0, 4)}`;
};

/**
 * Enhanced chapter data structure with stable ID
 */
export interface EnhancedChapter extends Chapter {
  id: string;              // Stable chapter ID for React keys
  canonicalUrl: string;    // Single normalized URL
  sourceUrls: string[];    // All URL variants that point to this chapter
  importSource?: {         // Import metadata
    originalUrl: string;
    importDate: Date;
    sourceFormat: 'json' | 'scraping' | 'manual';
  };
  fanTranslation?: string | null; // Optional fan translation reference text
  translationResult?: TranslationResult | null;
  translationSettingsSnapshot?: Partial<Pick<AppSettings, 'provider' | 'model' | 'temperature' | 'topP' | 'frequencyPenalty' | 'presencePenalty' | 'seed' | 'contextDepth' | 'systemPrompt'>>;
  feedback?: FeedbackItem[];
}

/**
 * URL normalization that's more aggressive than the current one
 * Removes all query parameters and ensures consistent format
 */
export const normalizeUrlAggressively = (url: string | null | undefined): string | null => {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    // Remove ALL query parameters for maximum normalization
    urlObj.search = '';
    urlObj.hash = '';
    // Ensure no trailing slash for consistency
    const pathname = urlObj.pathname.replace(/\/$/, '');
    return `${urlObj.origin}${pathname}`;
  } catch (e) {
    return url; // Return as-is if invalid
  }
};

/**
 * Generates a canonical URL from multiple URL variants
 * Chooses the shortest, cleanest URL as canonical
 */
export const generateCanonicalUrl = (urls: string[]): string => {
  if (urls.length === 0) throw new Error('No URLs provided for canonical URL generation');
  
  // Normalize all URLs
  const normalizedUrls = urls
    .map(url => normalizeUrlAggressively(url))
    .filter((url): url is string => url !== null);
    
  if (normalizedUrls.length === 0) return urls[0]; // Fallback to first URL if none normalize
  
  // Choose the shortest URL as canonical (usually the cleanest)
  return normalizedUrls.reduce((shortest, current) => 
    current.length < shortest.length ? current : shortest
  );
};

/**
 * Novel-level grouping information
 */
export interface NovelInfo {
  id: string;           // Novel identifier (derived from domain + path pattern)
  title?: string;       // Detected or provided novel title
  source: string;       // Source domain (e.g., "booktoki468.com")
  chapterCount: number; // Number of chapters in this novel
}

/**
 * Extracts novel information from chapter data
 */
export const extractNovelInfo = (chapters: any[]): NovelInfo => {
  if (chapters.length === 0) {
    throw new Error('No chapters provided for novel info extraction');
  }
  
  // Use the first chapter's URL to determine novel identity
  const firstChapter = chapters[0];
  const firstUrl = firstChapter.url || firstChapter.sourceUrl;
  
  if (!firstUrl) {
    throw new Error('No URL found in first chapter for novel identification');
  }
  
  try {
    const urlObj = new URL(firstUrl);
    const domain = urlObj.hostname;
    
    // Extract novel ID from URL pattern
    // For BookToki: /novel/{novelId} pattern
    const pathMatch = urlObj.pathname.match(/\/novel\/(\d+)/);
    const novelIdFromPath = pathMatch ? pathMatch[1] : 'unknown';
    
    // Create stable novel ID
    const novelId = `${domain.replace(/[^a-z0-9]/g, '')}_${novelIdFromPath}`;
    
    return {
      id: novelId,
      title: chapters[0].title?.split('-')[0]?.trim(), // Extract title from first chapter
      source: domain,
      chapterCount: chapters.length
    };
  } catch (e) {
    // Fallback for invalid URLs
    return {
      id: `unknown_novel_${Date.now()}`,
      source: 'unknown',
      chapterCount: chapters.length
    };
  }
};

/**
 * Session data structure with stable IDs
 */
export interface StableSessionData {
  novels: Map<string, NovelInfo>;
  chapters: Map<string, EnhancedChapter>;
  urlIndex: Map<string, string>;  // normalizedUrl -> chapterId
  rawUrlIndex: Map<string, string>; // rawUrl -> chapterId
  currentChapterId: string | null;
  navigationHistory: string[]; // chapterIds, not URLs
}

/**
 * Transforms legacy JSON format to stable ID format
 * This is the key compatibility layer
 */
export const transformImportedChapters = (
  importedChapters: any[],
  importMetadata?: any
): StableSessionData => {
  debugLog('indexeddb', 'summary', '[StableID] Transforming imported chapters with stable IDs');
  
  const novels = new Map<string, NovelInfo>();
  const chapters = new Map<string, EnhancedChapter>();
  const urlIndex = new Map<string, string>();
  const rawUrlIndex = new Map<string, string>();
  
  const assignedNumbers: number[] = [];

  // Extract novel information
  const novelInfo = extractNovelInfo(importedChapters);
  novels.set(novelInfo.id, novelInfo);
  
  // Process each chapter
  importedChapters.forEach((rawChapter, index) => {
    const originalUrl = rawChapter.url || rawChapter.sourceUrl;
    if (!originalUrl) {
      return;
    }
    let assignedChapterNumber = Number(rawChapter.chapterNumber) || 0;
    if (!assignedChapterNumber) {
      const slugMatch = originalUrl.match(/\/(\d+)(?:[/?]|$)/);
      if (slugMatch) {
        assignedChapterNumber = parseInt(slugMatch[1], 10);
      }
    }
    if (!assignedChapterNumber) {
      assignedChapterNumber = index + 1;
    }
    assignedNumbers[index] = assignedChapterNumber;

    // Generate stable chapter ID
    const stableId = generateStableChapterId(
      rawChapter.content || '',
      assignedChapterNumber,
      rawChapter.title || 'Untitled'
    );
    
    // Collect all URL variants for this chapter
    const sourceUrls = [originalUrl];
    if (rawChapter.nextUrl) sourceUrls.push(rawChapter.nextUrl);
    if (rawChapter.prevUrl) sourceUrls.push(rawChapter.prevUrl);
    
    // Generate canonical URL
    const canonicalUrl = generateCanonicalUrl([originalUrl]);
    
    // Create enhanced chapter
    const enhancedChapter: EnhancedChapter = {
      id: stableId,
      title: rawChapter.title || 'Untitled Chapter',
      content: rawChapter.content || '',
      originalUrl: canonicalUrl, // Use canonical URL
      nextUrl: rawChapter.nextUrl ? normalizeUrlAggressively(rawChapter.nextUrl) : undefined,
      prevUrl: rawChapter.prevUrl ? normalizeUrlAggressively(rawChapter.prevUrl) : undefined,
      chapterNumber: assignedChapterNumber,
      canonicalUrl,
      sourceUrls: [originalUrl], // Store original URL as source
      fanTranslation: rawChapter.fanTranslation ?? null,
      importSource: {
        originalUrl,
        importDate: new Date(),
        sourceFormat: 'json',
        chapterIndex: index
      }
    };
    
    // Store chapter
    chapters.set(stableId, enhancedChapter);
    
    // Build URL indexes
    const normalizedUrl = normalizeUrlAggressively(originalUrl);
    if (normalizedUrl) {
      urlIndex.set(normalizedUrl, stableId);
    }
    rawUrlIndex.set(originalUrl, stableId);
    
    debugLog('indexeddb', 'full', `[StableID] Processed chapter: ${stableId} (${assignedChapterNumber}) -> ${canonicalUrl}`);
  });
  
  return {
    novels,
    chapters,
    urlIndex,
    rawUrlIndex,
    currentChapterId: importedChapters.length > 0 ? 
      generateStableChapterId(
        importedChapters[0].content || '',
        assignedNumbers[0] || 0,
        importedChapters[0].title || ''
      ) : null,
    navigationHistory: []
  };
};

/**
 * Converts stable session data back to legacy format for compatibility
 * Used when other parts of the system expect the old format
 */
export const toLegacySessionData = (stableData: StableSessionData): Record<string, any> => {
  const legacyData: Record<string, any> = {};
  
  for (const [chapterId, chapter] of stableData.chapters) {
    // Use canonical URL as the key for legacy compatibility
    legacyData[chapter.canonicalUrl] = {
      chapter: {
        title: chapter.title,
        content: chapter.content,
        originalUrl: chapter.canonicalUrl,
        nextUrl: chapter.nextUrl,
        prevUrl: chapter.prevUrl,
        chapterNumber: chapter.chapterNumber,
        fanTranslation: chapter.fanTranslation ?? null,
      },
      translationResult: null, // This will be populated by the translation system
    };
  }
  
  return legacyData;
};

/**
 * Finds a chapter by any of its URL variants
 * This maintains compatibility with existing lookup patterns
 */
export const findChapterByUrl = (
  stableData: StableSessionData,
  targetUrl: string
): EnhancedChapter | null => {
  // Try normalized URL first
  const normalizedUrl = normalizeUrlAggressively(targetUrl);
  if (normalizedUrl && stableData.urlIndex.has(normalizedUrl)) {
    const chapterId = stableData.urlIndex.get(normalizedUrl)!;
    return stableData.chapters.get(chapterId) || null;
  }
  
  // Try raw URL
  if (stableData.rawUrlIndex.has(targetUrl)) {
    const chapterId = stableData.rawUrlIndex.get(targetUrl)!;
    return stableData.chapters.get(chapterId) || null;
  }
  
  return null;
};

/**
 * Gets chapters sorted by novel and chapter number
 * Returns data ready for React rendering with stable keys
 */
export const getSortedChaptersForRendering = (
  stableData: StableSessionData
): Array<{ id: string; chapter: EnhancedChapter; canonicalUrl: string }> => {
  const chaptersArray = Array.from(stableData.chapters.values());
  
  // Sort by chapter number, then by title as fallback
  chaptersArray.sort((a, b) => {
    if (a.chapterNumber !== b.chapterNumber) {
      return a.chapterNumber - b.chapterNumber;
    }
    return a.title.localeCompare(b.title);
  });
  
  return chaptersArray.map(chapter => ({
    id: chapter.id, // This is the stable ID for React keys!
    chapter,
    canonicalUrl: chapter.canonicalUrl
  }));
};
