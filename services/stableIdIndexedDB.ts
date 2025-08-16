/**
 * Enhanced IndexedDB Service with Stable ID Support
 * 
 * This service extends the existing IndexedDB implementation to support stable chapter IDs
 * while maintaining backward compatibility with existing data.
 * 
 * KEY IMPROVEMENTS:
 * - Stable chapter IDs that don't change with URL variations
 * - URL mapping tables for flexible chapter lookup
 * - Novel-level organization
 * - Seamless migration from URL-based keys to stable IDs
 */

import { 
  ChapterRecord, 
  TranslationRecord, 
  SettingsRecord, 
  FeedbackRecord, 
  PromptTemplateRecord 
} from './indexeddb';
import { 
  EnhancedChapter, 
  StableSessionData, 
  NovelInfo,
  generateStableChapterId,
  normalizeUrlAggressively 
} from './stableIdService';

// Enhanced database configuration
const ENHANCED_DB_NAME = 'lexicon-forge-v2';
const ENHANCED_DB_VERSION = 1;

// Enhanced object store names
const ENHANCED_STORES = {
  NOVELS: 'novels',
  CHAPTERS: 'chapters',              // Now keyed by stable ID
  TRANSLATIONS: 'translations',       // References stable chapter IDs
  URL_MAPPINGS: 'url_mappings',       // Maps URLs to stable IDs
  SETTINGS: 'settings',
  FEEDBACK: 'feedback',
  PROMPT_TEMPLATES: 'prompt_templates',
  NAVIGATION_HISTORY: 'navigation_history'
} as const;

// Enhanced schema types
export interface EnhancedChapterRecord {
  id: string;                         // Primary key: stable chapter ID
  novelId: string;                    // Foreign key to novels
  title: string;
  content: string;
  chapterNumber: number;
  canonicalUrl: string;               // Single normalized URL
  nextChapterId?: string;             // Reference to next chapter ID
  prevChapterId?: string;             // Reference to prev chapter ID
  
  // Metadata
  dateAdded: string;                  // ISO timestamp
  lastAccessed: string;               // ISO timestamp
  importSource: {
    originalUrl: string;
    importDate: string;
    sourceFormat: 'json' | 'scraping' | 'manual';
  };
}

export interface NovelRecord {
  id: string;                         // Primary key
  title?: string;
  source: string;                     // Domain
  chapterCount: number;
  dateAdded: string;
  lastAccessed: string;
}

export interface UrlMappingRecord {
  url: string;                        // Primary key: any URL variant
  chapterId: string;                  // Foreign key to chapters
  isCanonical: boolean;               // True for the canonical URL
  dateAdded: string;
}

export interface EnhancedTranslationRecord extends Omit<TranslationRecord, 'chapterUrl'> {
  chapterId: string;                  // Foreign key to chapters (stable ID)
  novelId: string;                    // Foreign key to novels
}

export interface NavigationHistoryRecord {
  id: string;                         // Primary key
  chapterId: string;                  // Foreign key to chapters
  timestamp: string;                  // ISO timestamp
  sessionId?: string;                 // Optional session grouping
}

/**
 * Enhanced IndexedDB service with stable ID support
 */
class StableIdIndexedDBService {
  private db: IDBDatabase | null = null;
  
  /**
   * Initialize the enhanced database
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(ENHANCED_DB_NAME, ENHANCED_DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        console.log('[EnhancedIndexedDB] Database initialized successfully');
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create novels store
        if (!db.objectStoreNames.contains(ENHANCED_STORES.NOVELS)) {
          const novelStore = db.createObjectStore(ENHANCED_STORES.NOVELS, { keyPath: 'id' });
          novelStore.createIndex('source', 'source', { unique: false });
          novelStore.createIndex('dateAdded', 'dateAdded', { unique: false });
        }
        
        // Create enhanced chapters store
        if (!db.objectStoreNames.contains(ENHANCED_STORES.CHAPTERS)) {
          const chapterStore = db.createObjectStore(ENHANCED_STORES.CHAPTERS, { keyPath: 'id' });
          chapterStore.createIndex('novelId', 'novelId', { unique: false });
          chapterStore.createIndex('chapterNumber', 'chapterNumber', { unique: false });
          chapterStore.createIndex('canonicalUrl', 'canonicalUrl', { unique: true });
          chapterStore.createIndex('dateAdded', 'dateAdded', { unique: false });
        }
        
        // Create URL mappings store
        if (!db.objectStoreNames.contains(ENHANCED_STORES.URL_MAPPINGS)) {
          const urlStore = db.createObjectStore(ENHANCED_STORES.URL_MAPPINGS, { keyPath: 'url' });
          urlStore.createIndex('chapterId', 'chapterId', { unique: false });
          urlStore.createIndex('isCanonical', 'isCanonical', { unique: false });
        }
        
        // Create enhanced translations store
        if (!db.objectStoreNames.contains(ENHANCED_STORES.TRANSLATIONS)) {
          const translationStore = db.createObjectStore(ENHANCED_STORES.TRANSLATIONS, { keyPath: 'id' });
          translationStore.createIndex('chapterId', 'chapterId', { unique: false });
          translationStore.createIndex('novelId', 'novelId', { unique: false });
          translationStore.createIndex('version', ['chapterId', 'version'], { unique: true });
          translationStore.createIndex('isActive', ['chapterId', 'isActive'], { unique: false });
          translationStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        
        // Create navigation history store
        if (!db.objectStoreNames.contains(ENHANCED_STORES.NAVIGATION_HISTORY)) {
          const navStore = db.createObjectStore(ENHANCED_STORES.NAVIGATION_HISTORY, { keyPath: 'id' });
          navStore.createIndex('chapterId', 'chapterId', { unique: false });
          navStore.createIndex('timestamp', 'timestamp', { unique: false });
          navStore.createIndex('sessionId', 'sessionId', { unique: false });
        }
        
        // Create other stores (settings, feedback, prompts) similar to original
        if (!db.objectStoreNames.contains(ENHANCED_STORES.SETTINGS)) {
          db.createObjectStore(ENHANCED_STORES.SETTINGS, { keyPath: 'key' });
        }
        
        if (!db.objectStoreNames.contains(ENHANCED_STORES.FEEDBACK)) {
          const feedbackStore = db.createObjectStore(ENHANCED_STORES.FEEDBACK, { keyPath: 'id' });
          feedbackStore.createIndex('chapterId', 'chapterId', { unique: false });
          feedbackStore.createIndex('translationId', 'translationId', { unique: false });
        }
        
        if (!db.objectStoreNames.contains(ENHANCED_STORES.PROMPT_TEMPLATES)) {
          const promptStore = db.createObjectStore(ENHANCED_STORES.PROMPT_TEMPLATES, { keyPath: 'id' });
          promptStore.createIndex('name', 'name', { unique: true });
        }
        
        console.log('[EnhancedIndexedDB] Database schema upgraded to version', ENHANCED_DB_VERSION);
      };
    });
  }
  
  /**
   * Import stable session data into IndexedDB
   */
  async importStableSessionData(stableData: StableSessionData): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction([
      ENHANCED_STORES.NOVELS,
      ENHANCED_STORES.CHAPTERS,
      ENHANCED_STORES.URL_MAPPINGS
    ], 'readwrite');
    
    const novelStore = transaction.objectStore(ENHANCED_STORES.NOVELS);
    const chapterStore = transaction.objectStore(ENHANCED_STORES.CHAPTERS);
    const urlStore = transaction.objectStore(ENHANCED_STORES.URL_MAPPINGS);
    
    // Import novels
    for (const [novelId, novel] of stableData.novels) {
      const novelRecord: NovelRecord = {
        id: novelId,
        title: novel.title,
        source: novel.source,
        chapterCount: novel.chapterCount,
        dateAdded: new Date().toISOString(),
        lastAccessed: new Date().toISOString()
      };
      await this.putRecord(novelStore, novelRecord);
    }
    
    // Import chapters
    for (const [chapterId, chapter] of stableData.chapters) {
      const chapterRecord: EnhancedChapterRecord = {
        id: chapterId,
        novelId: Array.from(stableData.novels.keys())[0], // Assume single novel for now
        title: chapter.title,
        content: chapter.content,
        chapterNumber: chapter.chapterNumber,
        canonicalUrl: chapter.canonicalUrl,
        nextChapterId: undefined, // Will be updated in linking phase
        prevChapterId: undefined, // Will be updated in linking phase
        dateAdded: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        importSource: chapter.importSource || {
          originalUrl: chapter.originalUrl,
          importDate: new Date().toISOString(),
          sourceFormat: 'json'
        }
      };
      
      await this.putRecord(chapterStore, chapterRecord);
    }
    
    // Import URL mappings
    for (const [url, chapterId] of stableData.urlIndex) {
      const mappingRecord: UrlMappingRecord = {
        url,
        chapterId,
        isCanonical: true, // URL index contains canonical URLs
        dateAdded: new Date().toISOString()
      };
      await this.putRecord(urlStore, mappingRecord);
    }
    
    // Import raw URL mappings
    for (const [url, chapterId] of stableData.rawUrlIndex) {
      // Skip if already exists (canonical URL was already added)
      if (stableData.urlIndex.has(normalizeUrlAggressively(url) || url)) {
        continue;
      }
      
      const mappingRecord: UrlMappingRecord = {
        url,
        chapterId,
        isCanonical: false,
        dateAdded: new Date().toISOString()
      };
      await this.putRecord(urlStore, mappingRecord);
    }
    
    await this.waitForTransaction(transaction);
    console.log('[EnhancedIndexedDB] Stable session data imported successfully');
  }
  
  /**
   * Find chapter by any URL variant
   */
  async findChapterByUrl(url: string): Promise<EnhancedChapterRecord | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction([ENHANCED_STORES.URL_MAPPINGS, ENHANCED_STORES.CHAPTERS], 'readonly');
    const urlStore = transaction.objectStore(ENHANCED_STORES.URL_MAPPINGS);
    const chapterStore = transaction.objectStore(ENHANCED_STORES.CHAPTERS);
    
    // Try exact URL match first
    let mappingRecord = await this.getRecord<UrlMappingRecord>(urlStore, url);
    
    // If not found, try normalized URL
    if (!mappingRecord) {
      const normalizedUrl = normalizeUrlAggressively(url);
      if (normalizedUrl && normalizedUrl !== url) {
        mappingRecord = await this.getRecord<UrlMappingRecord>(urlStore, normalizedUrl);
      }
    }
    
    if (!mappingRecord) {
      return null;
    }
    
    return await this.getRecord<EnhancedChapterRecord>(chapterStore, mappingRecord.chapterId);
  }
  
  /**
   * Get chapters sorted for rendering
   */
  async getChaptersForRendering(novelId?: string): Promise<Array<{
    id: string;
    chapter: EnhancedChapterRecord;
    canonicalUrl: string;
  }>> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction([ENHANCED_STORES.CHAPTERS], 'readonly');
    const chapterStore = transaction.objectStore(ENHANCED_STORES.CHAPTERS);
    
    let chapters: EnhancedChapterRecord[];
    
    if (novelId) {
      // Get chapters for specific novel
      const index = chapterStore.index('novelId');
      chapters = await this.getAllFromIndex<EnhancedChapterRecord>(index, novelId);
    } else {
      // Get all chapters
      chapters = await this.getAllRecords<EnhancedChapterRecord>(chapterStore);
    }
    
    // Sort by chapter number
    chapters.sort((a, b) => {
      if (a.chapterNumber !== b.chapterNumber) {
        return a.chapterNumber - b.chapterNumber;
      }
      return a.title.localeCompare(b.title);
    });
    
    return chapters.map(chapter => ({
      id: chapter.id,
      chapter,
      canonicalUrl: chapter.canonicalUrl
    }));
  }
  
  /**
   * Migrate from legacy IndexedDB to enhanced version
   */
  async migrateFromLegacy(): Promise<void> {
    console.log('[EnhancedIndexedDB] Starting migration from legacy database');
    
    // This would implement migration from the old URL-based system
    // to the new stable ID system. For now, we'll rely on JSON import
    // since that's the immediate use case.
    
    // TODO: Implement migration from existing IndexedDB structure
    console.log('[EnhancedIndexedDB] Legacy migration not yet implemented');
  }
  
  // Utility methods
  private putRecord<T>(store: IDBObjectStore, record: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  private getRecord<T>(store: IDBObjectStore, key: any): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }
  
  private getAllRecords<T>(store: IDBObjectStore): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }
  
  private getAllFromIndex<T>(index: IDBIndex, query: any): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const request = index.getAll(query);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }
  
  private waitForTransaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

// Export singleton instance
export const stableIdIndexedDBService = new StableIdIndexedDBService();