/**
 * IndexedDB Service for Versioned Translation Storage
 * 
 * This service manages persistent storage of translation versions using IndexedDB.
 * It replaces localStorage for translation data to support multiple versions per chapter.
 * 
 * SCHEMA DESIGN:
 * - chapters: Store original chapter content and metadata
 * - translations: Store translation versions with full metadata
 * - settings: Store user settings and preferences
 * - feedback: Store user feedback per translation version
 * 
 * KEY FEATURES:
 * - Multiple translation versions per chapter
 * - Full metadata tracking (model, cost, timestamp)
 * - Efficient querying and version management
 * - Migration from localStorage data
 */

import { Chapter, TranslationResult, AppSettings, FeedbackItem, PromptTemplate } from '../types';

// Debug gates (reuse AI debug flags)
const dbDebugEnabled = (): boolean => {
  try {
    const lvl = localStorage.getItem('LF_AI_DEBUG_LEVEL');
    if (lvl === 'summary') return true; if (lvl === 'full') return true;
    return localStorage.getItem('LF_AI_DEBUG') === '1';
  } catch { return false; }
};
const dbDebugFullEnabled = (): boolean => {
  try {
    const lvl = localStorage.getItem('LF_AI_DEBUG_LEVEL');
    if (lvl === 'full') return true;
    return localStorage.getItem('LF_AI_DEBUG_FULL') === '1';
  } catch { return false; }
};
const dblog = (...args: any[]) => { /* disabled */ };
const dblogFull = (...args: any[]) => { /* disabled */ };

// Database configuration
const DB_NAME = 'lexicon-forge';
const DB_VERSION = 5; // Increment for stable ID support

// Object store names
const STORES = {
  CHAPTERS: 'chapters',
  TRANSLATIONS: 'translations', 
  SETTINGS: 'settings',
  FEEDBACK: 'feedback',
  PROMPT_TEMPLATES: 'prompt_templates',
  URL_MAPPINGS: 'url_mappings',     // NEW: URL → Stable ID mapping
  NOVELS: 'novels'                  // NEW: Novel organization (optional)
} as const;

// IndexedDB Schema Types
export interface ChapterRecord {
  url: string;                    // Primary key (legacy)
  stableId?: string;              // NEW: Content-based stable ID
  title: string;
  content: string;
  originalUrl: string;
  nextUrl?: string;
  prevUrl?: string;
  fanTranslation?: string;        // NEW: Fan translation reference text
  dateAdded: string;              // ISO timestamp
  lastAccessed: string;           // ISO timestamp
  
  // NEW: Stable ID enhancement fields
  chapterNumber?: number;         // For stable ID generation
  canonicalUrl?: string;          // Normalized URL
}

export interface TranslationRecord {
  id: string;                     // Generated UUID
  chapterUrl: string;             // Foreign key to chapters (legacy)
  stableId?: string;              // NEW: Stable chapter reference
  version: number;                // Version number (1, 2, 3...)
  translatedTitle: string;
  translation: string;
  footnotes: Array<{ marker: string; text: string }>;
  suggestedIllustrations: Array<{ placementMarker: string; imagePrompt: string; url?: string; }>; // Added url field
  
  // Translation metadata
  provider: string;               // 'Gemini', 'OpenAI', 'DeepSeek'
  model: string;                  // 'gemini-2.5-flash', 'gpt-5', etc.
  temperature: number;
  systemPrompt: string;           // Snapshot of prompt used
  promptId?: string;              // Reference to prompt template used
  promptName?: string;            // Snapshot of prompt name at time of translation
  
  // Usage metrics
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
  requestTime: number;            // Seconds
  
  // Timestamps
  createdAt: string;              // ISO timestamp
  isActive: boolean;              // Currently selected version
  
  // Amendment proposal (if any)
  proposal?: {
    observation: string;
    currentRule: string;
    proposedChange: string;
    reasoning: string;
  };
}

export interface SettingsRecord {
  key: string;                    // Primary key
  value: any;                     // JSON serializable value
  updatedAt: string;              // ISO timestamp
}

export interface FeedbackRecord {
  id: string;                     // Generated UUID
  chapterUrl: string;             // Foreign key to chapters
  translationId?: string;         // Optional: specific to translation version
  type: 'positive' | 'negative' | 'suggestion';
  selection: string;              // Text user selected
  comment: string;                // User's comment
  createdAt: string;              // ISO timestamp
}

export interface PromptTemplateRecord {
  id: string;                     // Generated UUID
  name: string;                   // Display name like "Wuxia Romance"
  description?: string;           // Optional description
  content: string;                // The actual system prompt
  isDefault: boolean;             // One template marked as default
  createdAt: string;              // ISO timestamp
  lastUsed?: string;              // ISO timestamp when last selected
}

// NEW: Stable ID system interfaces
export interface UrlMappingRecord {
  url: string;                    // Primary key: any URL variant
  stableId: string;              // Foreign key to chapters
  isCanonical: boolean;          // True for the canonical URL
  dateAdded: string;             // ISO timestamp
}

export interface NovelRecord {
  id: string;                    // Primary key
  title?: string;                // Novel title (if known)
  source: string;                // Domain (e.g., 'kakuyomu.jp')
  chapterCount: number;          // Number of chapters
  dateAdded: string;             // ISO timestamp
  lastAccessed: string;          // ISO timestamp
}

// Singleton pattern for database connection management
let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

// Database service class
class IndexedDBService {
  /**
   * Singleton database opener with proper event handling
   * Prevents thundering herd opens and handles blocked upgrades correctly
   */
  async openDatabase(): Promise<IDBDatabase> {
    // Return existing instance if available
    if (dbInstance) return dbInstance;
    
    // Return existing promise if open is in progress
    if (dbPromise) return dbPromise;

    // Create new open promise with proper event handling
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const startTime = performance.now();
      // dblog('[IndexedDB] Opening database...', { DB_NAME, DB_VERSION });
      
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      // Warning timer (don't reject - let browser complete)
      const warnTimer = setTimeout(() => {
        const elapsed = Math.round(performance.now() - startTime);
        // if (dbDebugEnabled()) console.warn(`[IndexedDB] Open taking ${elapsed}ms. Possibly BLOCKED by another tab or slow I/O. Still waiting...`);
      }, 5000);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = (event as IDBVersionChangeEvent).oldVersion || 0;
        // dblog(`[IndexedDB] Upgrade needed: v${oldVersion} → v${db.version}`);
        try {
          this.createSchema(db);
          // dblog('[IndexedDB] Schema creation completed');
        } catch (error) {
          console.error('[IndexedDB] Schema creation failed:', error);
          clearTimeout(warnTimer);
          reject(error);
        }
      };

      request.onblocked = () => {
        // if (dbDebugEnabled()) console.warn('[IndexedDB] Upgrade BLOCKED by another open connection. Close other tabs or reload to proceed.');
        // Don't reject - let browser handle when other connection closes
      };

      request.onerror = () => {
        clearTimeout(warnTimer);
        dbPromise = null;
        console.error('[IndexedDB] Open failed:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        clearTimeout(warnTimer);
        const db = request.result;
        const elapsed = Math.round(performance.now() - startTime);
        // dblog(`[IndexedDB] Opened successfully v${db.version} in ${elapsed}ms`);
        
        // Handle version changes from other tabs
        db.onversionchange = () => {
          // if (dbDebugEnabled()) console.warn('[IndexedDB] Version change detected - closing old connection');
          db.close();
          dbInstance = null;
          dbPromise = null;
        };
        
        // Verify schema and auto-migrate if needed
        this.verifySchemaOrAutoMigrate(db).then(() => {
          dbInstance = db;
          resolve(db);
        }).catch((error) => {
          console.error('[IndexedDB] Schema verification failed:', error);
          db.close();
          dbPromise = null;
          reject(error);
        });
      };
    });

    return dbPromise;
  }

  /**
   * Verify schema completeness and auto-migrate missing stores
   * Handles schema drift where DB version is correct but stores are missing
   */
  private async verifySchemaOrAutoMigrate(db: IDBDatabase): Promise<void> {
    const requiredStores = [
      'chapters', 'translations', 'settings', 'feedback', 
      'prompt_templates', 'url_mappings', 'novels'
    ];
    
    const existingStores = Array.from(db.objectStoreNames);
    const missingStores = requiredStores.filter(store => !existingStores.includes(store));
    
    if (missingStores.length === 0) {
      // dblog('[IndexedDB] Schema verification passed - all stores present');
      return;
    }

    // console.warn('[IndexedDB] Schema drift detected - missing stores:', missingStores);
    // console.log('[IndexedDB] Initiating auto-migration to fix schema drift');
    
    // Close current connection for auto-migration
    db.close();
    dbInstance = null;
    dbPromise = null;
    
    // Open with incremented version to trigger onupgradeneeded
    await new Promise<void>((resolve, reject) => {
      const newVersion = db.version + 1;
      // console.log(`[IndexedDB] Auto-migration: upgrading to v${newVersion}`);
      
      const request = indexedDB.open(DB_NAME, newVersion);
      
      request.onupgradeneeded = (event) => {
        const upgradeDb = (event.target as IDBOpenDBRequest).result;
        // console.log('[IndexedDB] Auto-migration: creating missing stores');
        
        try {
          // Only create missing stores
          if (missingStores.includes('url_mappings') && !upgradeDb.objectStoreNames.contains('url_mappings')) {
            const urlStore = upgradeDb.createObjectStore('url_mappings', { keyPath: 'url' });
            urlStore.createIndex('stableId', 'stableId');
            urlStore.createIndex('isCanonical', 'isCanonical');
            urlStore.createIndex('dateAdded', 'dateAdded');
            // console.log('[IndexedDB] Auto-migration: created url_mappings store');
          }
          
          if (missingStores.includes('novels') && !upgradeDb.objectStoreNames.contains('novels')) {
            const novelStore = upgradeDb.createObjectStore('novels', { keyPath: 'id' });
            novelStore.createIndex('source', 'source');
            novelStore.createIndex('title', 'title');
            novelStore.createIndex('dateAdded', 'dateAdded');
            novelStore.createIndex('lastAccessed', 'lastAccessed');
            // console.log('[IndexedDB] Auto-migration: created novels store');
          }
        } catch (error) {
          console.error('[IndexedDB] Auto-migration failed:', error);
          reject(error);
        }
      };
      
      request.onblocked = () => {
        console.warn('[IndexedDB] Auto-migration blocked by another connection. Close other tabs.');
      };
      
      request.onerror = () => {
        console.error('[IndexedDB] Auto-migration failed:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        const migratedDb = request.result;
        // console.log(`[IndexedDB] Auto-migration completed successfully to v${migratedDb.version}`);
        migratedDb.close(); // Close migration connection
        resolve();
      };
    });
  }
  
  /**
   * Create the database schema
   */
  private createSchema(db: IDBDatabase): void {
    // console.log('[IndexedDB] Creating database schema');
    
    // Chapters store
    if (!db.objectStoreNames.contains(STORES.CHAPTERS)) {
      const chaptersStore = db.createObjectStore(STORES.CHAPTERS, { keyPath: 'url' });
      chaptersStore.createIndex('dateAdded', 'dateAdded');
      chaptersStore.createIndex('lastAccessed', 'lastAccessed');
      chaptersStore.createIndex('stableId', 'stableId'); // NEW: For stable ID lookups
      chaptersStore.createIndex('canonicalUrl', 'canonicalUrl'); // NEW: For canonical URL lookups
      // console.log('[IndexedDB] Created chapters store');
    }
    
    // Translations store - supports multiple versions per chapter
    if (!db.objectStoreNames.contains(STORES.TRANSLATIONS)) {
      const translationsStore = db.createObjectStore(STORES.TRANSLATIONS, { keyPath: 'id' });
      translationsStore.createIndex('chapterUrl', 'chapterUrl');
      translationsStore.createIndex('version', 'version');
      translationsStore.createIndex('chapterUrl_version', ['chapterUrl', 'version'], { unique: true });
      translationsStore.createIndex('isActive', 'isActive');
      translationsStore.createIndex('createdAt', 'createdAt');
      translationsStore.createIndex('provider', 'provider');
      translationsStore.createIndex('model', 'model');
      translationsStore.createIndex('stableId', 'stableId'); // NEW: For stable ID lookups
      translationsStore.createIndex('stableId_version', ['stableId', 'version'], { unique: true }); // NEW: Stable ID version lookups
      // console.log('[IndexedDB] Created translations store');
    }
    
    // Settings store
    if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
      db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      // console.log('[IndexedDB] Created settings store');
    }
    
    // Feedback store
    if (!db.objectStoreNames.contains(STORES.FEEDBACK)) {
      const feedbackStore = db.createObjectStore(STORES.FEEDBACK, { keyPath: 'id' });
      feedbackStore.createIndex('chapterUrl', 'chapterUrl');
      feedbackStore.createIndex('translationId', 'translationId');
      feedbackStore.createIndex('createdAt', 'createdAt');
      feedbackStore.createIndex('type', 'type');
      // console.log('[IndexedDB] Created feedback store');
    }
    
    // Prompt Templates store
    if (!db.objectStoreNames.contains(STORES.PROMPT_TEMPLATES)) {
      const promptStore = db.createObjectStore(STORES.PROMPT_TEMPLATES, { keyPath: 'id' });
      promptStore.createIndex('name', 'name');
      promptStore.createIndex('isDefault', 'isDefault');
      promptStore.createIndex('createdAt', 'createdAt');
      promptStore.createIndex('lastUsed', 'lastUsed');
      // console.log('[IndexedDB] Created prompt templates store');
    }
    
    // NEW: URL Mappings store for stable ID support
    if (!db.objectStoreNames.contains(STORES.URL_MAPPINGS)) {
      const urlStore = db.createObjectStore(STORES.URL_MAPPINGS, { keyPath: 'url' });
      urlStore.createIndex('stableId', 'stableId');
      urlStore.createIndex('isCanonical', 'isCanonical');
      urlStore.createIndex('dateAdded', 'dateAdded');
      // console.log('[IndexedDB] Created URL mappings store');
    }
    
    // NEW: Novels store for organization (optional)
    if (!db.objectStoreNames.contains(STORES.NOVELS)) {
      const novelStore = db.createObjectStore(STORES.NOVELS, { keyPath: 'id' });
      novelStore.createIndex('source', 'source');
      novelStore.createIndex('title', 'title');
      novelStore.createIndex('dateAdded', 'dateAdded');
      novelStore.createIndex('lastAccessed', 'lastAccessed');
      // console.log('[IndexedDB] Created novels store');
    }
  }

  /**
   * Get stable ID for a URL (centralized database access)
   * Replaces direct database opening from useAppStore
   */
  async getStableIdByUrl(url: string): Promise<string | null> {
    try {
      const db = await this.openDatabase();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['url_mappings'], 'readonly');
        const store = transaction.objectStore('url_mappings');
        
        // Try exact URL first
        const request = store.get(url);
        
        request.onsuccess = () => {
          if (request.result?.stableId) {
            // console.log('[IndexedDB] Found stable ID for URL:', url, '→', request.result.stableId);
            resolve(request.result.stableId);
            return;
          }
          
          // Try normalized URL as fallback
          const normalizedUrl = this.normalizeUrlAggressively(url);
          if (normalizedUrl && normalizedUrl !== url) {
            const normalizedRequest = store.get(normalizedUrl);
            normalizedRequest.onsuccess = () => {
              if (normalizedRequest.result?.stableId) {
                // console.log('[IndexedDB] Found stable ID for normalized URL:', normalizedUrl, '→', normalizedRequest.result.stableId);
                resolve(normalizedRequest.result.stableId);
              } else {
                // console.log('[IndexedDB] No stable ID found for URL:', url);
                resolve(null);
              }
            };
            normalizedRequest.onerror = () => {
              console.warn('[IndexedDB] Error checking normalized URL:', normalizedRequest.error);
              resolve(null);
            };
          } else {
            // console.log('[IndexedDB] No stable ID found for URL:', url);
            resolve(null);
          }
        };
        
        request.onerror = () => {
          console.error('[IndexedDB] Error getting stable ID for URL:', url, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[IndexedDB] Failed to get stable ID for URL:', url, error);
      return null;
    }
  }

  /**
   * Return all URL → stableId mappings for boot-time index hydration
   */
  async getAllUrlMappings(): Promise<Array<{ url: string; stableId: string; isCanonical: boolean }>> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.URL_MAPPINGS], 'readonly');
      const store = tx.objectStore(STORES.URL_MAPPINGS);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = (req.result || []) as UrlMappingRecord[];
        resolve(rows.map(r => ({ url: r.url, stableId: r.stableId, isCanonical: !!r.isCanonical })));
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * One-time backfill of URL mappings and stableId/canonicalUrl into CHAPTERS and URL_MAPPINGS.
   * Marks completion in SETTINGS under key 'urlMappingsBackfilled'.
   */
  async backfillUrlMappingsFromChapters(): Promise<void> {
    try {
      const already = await this.getSetting<boolean>('urlMappingsBackfilled');
      if (already) return;
      const db = await this.openDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORES.CHAPTERS, STORES.URL_MAPPINGS], 'readwrite');
        const chaptersStore = tx.objectStore(STORES.CHAPTERS);
        const urlStore = tx.objectStore(STORES.URL_MAPPINGS);

        const getAllReq = chaptersStore.getAll();
        getAllReq.onsuccess = () => {
          const chapters = (getAllReq.result || []) as ChapterRecord[];
          for (const rec of chapters) {
            // Ensure stableId
            let stableId = rec.stableId;
            if (!stableId) {
              const content = rec.content || '';
              const number = rec.chapterNumber || 0;
              const title = rec.title || '';
              stableId = this.generateStableId(content, number, title);
              rec.stableId = stableId;
            }
            // Ensure canonicalUrl
            const canonical = rec.canonicalUrl || this.normalizeUrlAggressively(rec.originalUrl || rec.url) || rec.url;
            rec.canonicalUrl = canonical;
            // Update chapter record if we changed anything
            chaptersStore.put(rec);

            // URL mapping for canonical (isCanonical: true)
            if (canonical) {
              const mapRec: UrlMappingRecord = {
                url: canonical,
                stableId: rec.stableId!,
                isCanonical: true,
                dateAdded: new Date().toISOString(),
              };
              urlStore.put(mapRec);
            }
            // URL mapping for original raw URL if different (isCanonical: false)
            const raw = rec.originalUrl || rec.url;
            if (raw && raw !== canonical) {
              const mapRecRaw: UrlMappingRecord = {
                url: raw,
                stableId: rec.stableId!,
                isCanonical: false,
                dateAdded: new Date().toISOString(),
              };
              urlStore.put(mapRecRaw);
            }
          }
        };
        getAllReq.onerror = () => reject(getAllReq.error);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      await this.setSetting('urlMappingsBackfilled', true);
      // console.log('[IndexedDB] URL mappings backfill completed');
    } catch (e) {
      console.warn('[IndexedDB] URL mappings backfill failed', e);
    }
  }

  /**
   * Normalize URL aggressively for consistent lookups
   */
  private normalizeUrlAggressively(url: string): string | null {
    if (!url) return null;
    
    try {
      const urlObj = new URL(url);
      // Remove ALL query parameters and hash for maximum normalization
      urlObj.search = '';
      urlObj.hash = '';
      // Ensure no trailing slash for consistency
      const pathname = urlObj.pathname.replace(/\/$/, '');
      return `${urlObj.origin}${pathname}`;
    } catch (e) {
      return url; // Return as-is if invalid
    }
  }
  
  /**
   * Store chapter data
   */
  async storeChapter(chapter: Chapter): Promise<void> {
    // console.log('[INDEXEDDB-DEBUG] storeChapter() called with:', {
    //   originalUrl: chapter.originalUrl,
    //   title: chapter.title,
    //   hasContent: !!chapter.content,
    //   contentLength: chapter.content?.length || 0,
    //   hasNextUrl: !!chapter.nextUrl,
    //   hasPrevUrl: !!chapter.prevUrl,
    //   allFields: Object.keys(chapter)
    // });
    
    const db = await this.openDatabase();
    // console.log('[INDEXEDDB-DEBUG] storeChapter() - database opened');
    
    const chapterRecord: ChapterRecord = {
      url: chapter.originalUrl,
      title: chapter.title,
      content: chapter.content,
      originalUrl: chapter.originalUrl,
      nextUrl: chapter.nextUrl,
      prevUrl: chapter.prevUrl,
      dateAdded: new Date().toISOString(),
      lastAccessed: new Date().toISOString()
    };
    
    // console.log('[INDEXEDDB-DEBUG] storeChapter() - prepared chapterRecord:', {
    //   url: chapterRecord.url,
    //   title: chapterRecord.title,
    //   hasContent: !!chapterRecord.content,
    //   contentLength: chapterRecord.content?.length || 0,
    //   originalUrl: chapterRecord.originalUrl,
    //   dateAdded: chapterRecord.dateAdded,
    //   allFields: Object.keys(chapterRecord)
    // });
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CHAPTERS], 'readwrite');
      const store = transaction.objectStore(STORES.CHAPTERS);
      // console.log('[INDEXEDDB-DEBUG] storeChapter() - transaction and store created');
      
      // Update lastAccessed if chapter already exists
      const getRequest = store.get(chapter.originalUrl);
      // console.log('[INDEXEDDB-DEBUG] storeChapter() - checking for existing chapter:', chapter.originalUrl);
      
      getRequest.onsuccess = () => {
        const existingChapter = getRequest.result;
        // console.log('[INDEXEDDB-DEBUG] storeChapter() - existing chapter check result:', {
        //   chapterExists: !!existingChapter,
        //   existingChapterData: existingChapter ? {
        //     url: existingChapter.url,
        //     title: existingChapter.title,
        //     dateAdded: existingChapter.dateAdded,
        //     lastAccessed: existingChapter.lastAccessed
        //   } : null
        // });
        
        if (existingChapter) {
          chapterRecord.dateAdded = existingChapter.dateAdded; // Keep original date
          // console.log('[INDEXEDDB-DEBUG] storeChapter() - keeping original dateAdded:', existingChapter.dateAdded);
        }
        
        const putRequest = store.put(chapterRecord);
        // console.log('[INDEXEDDB-DEBUG] storeChapter() - put request created');
        
        putRequest.onsuccess = () => {
          // console.log('[IndexedDB] Chapter stored:', chapter.originalUrl);
          // console.log('[INDEXEDDB-DEBUG] storeChapter() - put request succeeded for:', chapter.originalUrl);
          resolve();
        };
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
      
      transaction.onerror = () => reject(transaction.error);
    });
  }
  
  /**
   * Store translation version
   */
  async storeTranslation(
    chapterUrl: string, 
    translationResult: TranslationResult,
    translationSettings: {
      provider: string;
      model: string; 
      temperature: number;
      systemPrompt: string;
      promptId?: string;
      promptName?: string;
    }
  ): Promise<TranslationRecord> {
    const db = await this.openDatabase();
    
    // Get next version number for this chapter
    const nextVersion = await this.getNextVersionNumber(chapterUrl);
    
    // Generate unique ID
    const id = crypto.randomUUID();
    
    // Handle legacy data that might not have usageMetrics
    const usageMetrics = translationResult.usageMetrics || {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      estimatedCost: 0,
      requestTime: 0,
      provider: translationSettings.provider,
      model: translationSettings.model
    };

    const translationRecord: TranslationRecord = {
      id,
      chapterUrl,
      version: nextVersion,
      translatedTitle: translationResult.translatedTitle,
      translation: translationResult.translation,
      footnotes: translationResult.footnotes || [],
      suggestedIllustrations: translationResult.suggestedIllustrations || [],
      
      provider: translationSettings.provider,
      model: translationSettings.model,
      temperature: translationSettings.temperature,
      systemPrompt: translationSettings.systemPrompt,
      promptId: translationSettings.promptId,
      promptName: translationSettings.promptName,
      
      totalTokens: usageMetrics.totalTokens,
      promptTokens: usageMetrics.promptTokens,
      completionTokens: usageMetrics.completionTokens,
      estimatedCost: usageMetrics.estimatedCost,
      requestTime: usageMetrics.requestTime,
      
      createdAt: new Date().toISOString(),
      isActive: true, // New translation is active by default
      
      proposal: translationResult.proposal || undefined
    };
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.TRANSLATIONS], 'readwrite');
      const store = transaction.objectStore(STORES.TRANSLATIONS);
      
      // First, deactivate all other versions for this chapter
      const index = store.index('chapterUrl');
      const deactivateRequest = index.openCursor(IDBKeyRange.only(chapterUrl));
      
      const deactivatePromises: Promise<void>[] = [];
      
      deactivateRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const existingRecord = cursor.value;
          if (existingRecord.isActive) {
            existingRecord.isActive = false;
            deactivatePromises.push(new Promise((resolveUpdate) => {
              const updateRequest = cursor.update(existingRecord);
              updateRequest.onsuccess = () => resolveUpdate();
            }));
          }
          cursor.continue();
        } else {
          // After deactivating existing versions, add the new one
          Promise.all(deactivatePromises).then(() => {
            const addRequest = store.add(translationRecord);
            addRequest.onsuccess = () => {
              // console.log(`[IndexedDB] Translation stored: ${chapterUrl} v${nextVersion}`);
              resolve(translationRecord);
            };
            addRequest.onerror = () => reject(addRequest.error);
          });
        }
      };
      
      deactivateRequest.onerror = () => reject(deactivateRequest.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }
  
  /**
   * Get next version number for a chapter
   */
  private async getNextVersionNumber(chapterUrl: string): Promise<number> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.TRANSLATIONS], 'readonly');
      const store = transaction.objectStore(STORES.TRANSLATIONS);
      const index = store.index('chapterUrl');
      
      let maxVersion = 0;
      const request = index.openCursor(IDBKeyRange.only(chapterUrl));
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          maxVersion = Math.max(maxVersion, cursor.value.version);
          cursor.continue();
        } else {
          resolve(maxVersion + 1);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get all translation versions for a chapter
   */
  async getTranslationVersions(chapterUrl: string): Promise<TranslationRecord[]> {
      // dblogFull(`%c[IndexedDB DETAILED] getTranslationVersions called for: ${chapterUrl}`, 'color: #ff6600; font-weight: bold;');
    
      // dblogFull(`%c[IndexedDB DETAILED] About to call openDatabase()...`, 'color: #ff6600; font-weight: bold;');
    const db = await this.openDatabase();
      // dblogFull(`%c[IndexedDB DETAILED] openDatabase() completed successfully`, 'color: #ff6600; font-weight: bold;');
    
    return new Promise((resolve, reject) => {
      // dblogFull(`%c[IndexedDB DETAILED] Creating transaction...`, 'color: #ff6600; font-weight: bold;');
      const transaction = db.transaction([STORES.TRANSLATIONS], 'readonly');
      // dblogFull(`%c[IndexedDB DETAILED] Transaction created successfully`, 'color: #ff6600; font-weight: bold;');
      
      transaction.onerror = (event) => {
        console.error(`%c[IndexedDB DETAILED] Transaction error:`, 'color: #ff0000; font-weight: bold;', event);
        reject(transaction.error);
      };
      
      // dblogFull(`%c[IndexedDB DETAILED] Getting object store...`, 'color: #ff6600; font-weight: bold;');
      const store = transaction.objectStore(STORES.TRANSLATIONS);
      // dblogFull(`%c[IndexedDB DETAILED] Getting index...`, 'color: #ff6600; font-weight: bold;');
      const index = store.index('chapterUrl');
      // dblogFull(`%c[IndexedDB DETAILED] Calling getAll...`, 'color: #ff6600; font-weight: bold;');
      const request = index.getAll(IDBKeyRange.only(chapterUrl));
      
      request.onsuccess = () => {
        // dblogFull(`%c[IndexedDB DETAILED] getAll SUCCESS!`, 'color: #00ff00; font-weight: bold;');
        const versions = request.result.sort((a, b) => b.version - a.version); // Latest first
        // dblogFull(`%c[IndexedDB DETAILED] Found ${versions.length} versions for ${chapterUrl}`, 'color: #00ff00; font-weight: bold;');
        resolve(versions);
      };
      
      request.onerror = () => {
        console.error(`%c[IndexedDB DETAILED] getAll ERROR:`, 'color: #ff0000; font-weight: bold;', request.error);
        reject(request.error);
      };
    });
  }
  
  /**
   * Get active translation for a chapter
   */
  async getActiveTranslation(chapterUrl: string): Promise<TranslationRecord | null> {
    const versions = await this.getTranslationVersions(chapterUrl);
    return versions.find(v => v.isActive) || null;
  }

  /**
   * Get recent active translations for a given domain, newest first.
   * Excludes a specific stableId if provided (e.g., the current chapter).
   */
  async getRecentActiveTranslationsByDomain(domain: string, limit: number = 3, excludeStableId?: string): Promise<Array<{ translation: TranslationRecord; chapter: ChapterRecord }>> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([STORES.TRANSLATIONS, STORES.CHAPTERS], 'readonly');
        const translationsStore = tx.objectStore(STORES.TRANSLATIONS);
        const isActiveIdx = translationsStore.index('isActive');
        // Use an explicit key range to avoid DataError on some IDB implementations
        let req: IDBRequest<unknown>;
        try {
          req = isActiveIdx.getAll(IDBKeyRange.only(true));
        } catch (err) {
          // Fallback: scan via cursor if key range construction fails
          const results: TranslationRecord[] = [] as any;
          const cursorReq = isActiveIdx.openCursor();
          cursorReq.onsuccess = async () => {
            const cursor = (cursorReq as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              const val = cursor.value as TranslationRecord;
              if ((val as any)?.isActive === true) results.push(val);
              cursor.continue();
            } else {
              // No more entries; synthesize the rest of the original logic
              try {
                const candidates: Array<{ translation: TranslationRecord; chapter: ChapterRecord }> = [];
                const getChapterByUrl = (url: string) => new Promise<ChapterRecord | null>((res, rej) => {
                  try {
                    const chTx = db.transaction([STORES.CHAPTERS], 'readonly');
                    const chStore = chTx.objectStore(STORES.CHAPTERS);
                    const getReq = chStore.get(url);
                    getReq.onsuccess = () => res((getReq.result as ChapterRecord) || null);
                    getReq.onerror = () => rej(getReq.error);
                  } catch (e) { rej(e); }
                });
                for (const tr of results) {
                  if (excludeStableId && tr.stableId && tr.stableId === excludeStableId) continue;
                  let host: string | null = null;
                  try { host = new URL(tr.chapterUrl).hostname; } catch { host = null; }
                  if (!host || host !== domain) continue;
                  const ch = await getChapterByUrl(tr.chapterUrl);
                  if (!ch || !ch.content) continue;
                  candidates.push({ translation: tr, chapter: ch });
                }
                candidates.sort((a, b) => {
                  const at = new Date(a.translation.createdAt || a.chapter.lastAccessed || 0).getTime();
                  const bt = new Date(b.translation.createdAt || b.chapter.lastAccessed || 0).getTime();
                  return bt - at;
                });
                resolve(candidates.slice(0, limit));
              } catch (e) {
                reject(e);
              }
            }
          };
          cursorReq.onerror = () => reject(cursorReq.error);
          return; // Stop normal flow; using cursor fallback
        }

        req.onsuccess = async () => {
          try {
            const allActive = (req.result as TranslationRecord[]) || [];
            // Filter to domain and exclude current
            const candidates: Array<{ translation: TranslationRecord; chapter: ChapterRecord }> = [];

            // Helper to get chapter by url
            const getChapterByUrl = (url: string) => new Promise<ChapterRecord | null>((res, rej) => {
              try {
                const chTx = db.transaction([STORES.CHAPTERS], 'readonly');
                const chStore = chTx.objectStore(STORES.CHAPTERS);
                const getReq = chStore.get(url);
                getReq.onsuccess = () => res((getReq.result as ChapterRecord) || null);
                getReq.onerror = () => rej(getReq.error);
              } catch (e) { rej(e); }
            });

            for (const tr of allActive) {
              if (excludeStableId && tr.stableId && tr.stableId === excludeStableId) continue;
              let host: string | null = null;
              try { host = new URL(tr.chapterUrl).hostname; } catch { host = null; }
              if (!host || host !== domain) continue;

              const ch = await getChapterByUrl(tr.chapterUrl);
              if (!ch || !ch.content) continue; // Need content for context
              candidates.push({ translation: tr, chapter: ch });
            }

            candidates.sort((a, b) => {
              const at = new Date(a.translation.createdAt || a.chapter.lastAccessed || 0).getTime();
              const bt = new Date(b.translation.createdAt || b.chapter.lastAccessed || 0).getTime();
              return bt - at; // newest first
            });

            resolve(candidates.slice(0, limit));
          } catch (e) {
            reject(e);
          }
        };
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
  }
  
  /**
   * Set active translation version
   */
  async setActiveTranslation(chapterUrl: string, version: number): Promise<void> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.TRANSLATIONS], 'readwrite');
      const store = transaction.objectStore(STORES.TRANSLATIONS);
      const index = store.index('chapterUrl');
      
      const request = index.openCursor(IDBKeyRange.only(chapterUrl));
      const updates: Promise<void>[] = [];
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const record = cursor.value;
          const shouldBeActive = record.version === version;
          
          if (record.isActive !== shouldBeActive) {
            record.isActive = shouldBeActive;
            updates.push(new Promise((resolveUpdate) => {
              const updateRequest = cursor.update(record);
              updateRequest.onsuccess = () => resolveUpdate();
            }));
          }
          cursor.continue();
        } else {
          Promise.all(updates).then(() => {
            // console.log(`[IndexedDB] Set active translation: ${chapterUrl} v${version}`);
            resolve();
          });
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Delete a translation version
   */
  async deleteTranslationVersion(translationId: string): Promise<void> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.TRANSLATIONS], 'readwrite');
      const store = transaction.objectStore(STORES.TRANSLATIONS);
      
      const request = store.delete(translationId);
      request.onsuccess = () => {
        // console.log('[IndexedDB] Translation version deleted:', translationId);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update an existing translation record.
   * Uses put() which is an insert-or-update operation.
   */
  async updateTranslation(translation: TranslationRecord): Promise<void> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.TRANSLATIONS], 'readwrite');
      const store = transaction.objectStore(STORES.TRANSLATIONS);
      const request = store.put(translation);
      request.onsuccess = () => {
        // console.log('[IndexedDB] Translation version updated:', translation.id);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get chapter data
   */
  async getChapter(url: string): Promise<ChapterRecord | null> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CHAPTERS], 'readonly');
      const store = transaction.objectStore(STORES.CHAPTERS);
      
      const request = store.get(url);
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a chapter by its stableId using the chapters index
   */
  async getChapterByStableId(stableId: string): Promise<ChapterRecord | null> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.CHAPTERS], 'readonly');
      const store = tx.objectStore(STORES.CHAPTERS);
      const idx = store.index('stableId');
      const req = idx.get(stableId);
      req.onsuccess = () => resolve((req.result as ChapterRecord) || null);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Update chapterNumber by stableId (insert-or-update on existing chapter record)
   */
  async setChapterNumberByStableId(stableId: string, chapterNumber: number): Promise<void> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([STORES.CHAPTERS], 'readwrite');
        const store = tx.objectStore(STORES.CHAPTERS);
        const idx = store.index('stableId');
        const req = idx.get(stableId);
        req.onsuccess = () => {
          const rec = (req.result as ChapterRecord) || null;
          if (!rec) {
            reject(new Error(`No chapter found for stableId=${stableId}`));
            return;
          }
          rec.chapterNumber = chapterNumber;
          rec.lastAccessed = new Date().toISOString();
          const put = store.put(rec);
          put.onsuccess = () => resolve();
          put.onerror = () => reject(put.error);
        };
        req.onerror = () => reject(req.error);
      } catch (e) {
        reject(e as any);
      }
    });
  }
  
  /**
   * Store settings
   */
  async storeSettings(settings: AppSettings): Promise<void> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SETTINGS], 'readwrite');
      const store = transaction.objectStore(STORES.SETTINGS);
      
      const settingsRecord: SettingsRecord = {
        key: 'app-settings',
        value: settings,
        updatedAt: new Date().toISOString()
      };
      
      const request = store.put(settingsRecord);
      request.onsuccess = () => {
        // console.log('[IndexedDB] Settings stored');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Generic key/value setting setter
   */
  async setSetting(key: string, value: any): Promise<void> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.SETTINGS], 'readwrite');
      const store = tx.objectStore(STORES.SETTINGS);
      const rec: SettingsRecord = { key, value, updatedAt: new Date().toISOString() };
      const req = store.put(rec);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Generic key/value setting getter
   */
  async getSetting<T = any>(key: string): Promise<T | null> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.SETTINGS], 'readonly');
      const store = tx.objectStore(STORES.SETTINGS);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result?.value as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  }
  
  /**
   * Get settings
   */
  async getSettings(): Promise<AppSettings | null> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SETTINGS], 'readonly');
      const store = transaction.objectStore(STORES.SETTINGS);
      
      const request = store.get('app-settings');
      request.onsuccess = () => {
        resolve(request.result?.value || null);
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Store feedback
   */
  async storeFeedback(chapterUrl: string, feedback: FeedbackItem, translationId?: string): Promise<void> {
    const db = await this.openDatabase();
    
    const feedbackRecord: FeedbackRecord = {
      id: (feedback as any).id || crypto.randomUUID(),
      chapterUrl,
      translationId,
      type: feedback.type,
      selection: feedback.selection,
      comment: feedback.comment,
      createdAt: (feedback as any).createdAt ? new Date((feedback as any).createdAt).toISOString() : new Date().toISOString()
    };
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.FEEDBACK], 'readwrite');
      const store = transaction.objectStore(STORES.FEEDBACK);
      
      const request = store.add(feedbackRecord);
      request.onsuccess = () => {
        // console.log('[IndexedDB] Feedback stored:', chapterUrl);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get feedback for a chapter
   */
  async getFeedback(chapterUrl: string): Promise<FeedbackRecord[]> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.FEEDBACK], 'readonly');
      const store = transaction.objectStore(STORES.FEEDBACK);
      const index = store.index('chapterUrl');
      
      const request = index.getAll(IDBKeyRange.only(chapterUrl));
      request.onsuccess = () => {
        const feedback = request.result.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        resolve(feedback);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update feedback comment by feedback ID
   */
  async updateFeedbackComment(feedbackId: string, comment: string): Promise<void> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.FEEDBACK], 'readwrite');
      const store = tx.objectStore(STORES.FEEDBACK);
      const req = store.get(feedbackId);
      req.onsuccess = () => {
        const rec = req.result as FeedbackRecord | undefined;
        if (!rec) { resolve(); return; }
        rec.comment = comment;
        const put = store.put(rec);
        put.onsuccess = () => resolve();
        put.onerror = () => reject(put.error);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Delete feedback by ID
   */
  async deleteFeedbackById(feedbackId: string): Promise<void> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.FEEDBACK], 'readwrite');
      const store = tx.objectStore(STORES.FEEDBACK);
      const req = store.delete(feedbackId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Convenience: get URL mapping for a stableId
   */
  async getUrlForStableId(stableId: string): Promise<string | null> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([STORES.URL_MAPPINGS], 'readonly');
        const store = tx.objectStore(STORES.URL_MAPPINGS);
        const idx = store.index('stableId');
        const req = idx.get(stableId);
        req.onsuccess = () => resolve((req.result as UrlMappingRecord | undefined)?.url ?? null);
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
  }

  /**
   * Convenience: get mapping record by URL
   */
  async getUrlMappingForUrl(url: string): Promise<UrlMappingRecord | null> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([STORES.URL_MAPPINGS], 'readonly');
        const store = tx.objectStore(STORES.URL_MAPPINGS);
        const req = store.get(url);
        req.onsuccess = () => resolve((req.result as UrlMappingRecord) || null);
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
  }

  /**
   * List all chapters
   */
  async getAllChapters(): Promise<ChapterRecord[]> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.CHAPTERS], 'readonly');
      const store = tx.objectStore(STORES.CHAPTERS);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as ChapterRecord[]) || []);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * List all novels
   */
  async getAllNovels(): Promise<NovelRecord[]> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.NOVELS], 'readonly');
      const store = tx.objectStore(STORES.NOVELS);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as NovelRecord[]) || []);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * List all feedback across chapters
   */
  async getAllFeedback(): Promise<FeedbackRecord[]> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.FEEDBACK], 'readonly');
      const store = tx.objectStore(STORES.FEEDBACK);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as FeedbackRecord[]) || []);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Export a full session JSON with everything stored in IndexedDB
   */
  async exportFullSessionToJson(): Promise<any> {
    const [settings, urlMappings, novels, chapters, navHist, lastActive] = await Promise.all([
      this.getSettings(),
      this.getAllUrlMappings(),
      this.getAllNovels().catch(() => []),
      this.getAllChapters(),
      this.getSetting<any>('navigation-history').catch(() => null),
      this.getSetting<any>('lastActiveChapter').catch(() => null),
    ]);

    const chaptersOut: any[] = [];

    for (const ch of chapters) {
      // Resolve stableId and canonicalUrl
      const stableId = ch.stableId || (await this.getUrlMappingForUrl(ch.url))?.stableId || undefined;
      const canonicalUrl = ch.canonicalUrl || ch.url;

      // Pull translations for this chapter (all versions)
      const versions = stableId ? await this.getTranslationVersionsByStableId(stableId) : await this.getTranslationVersions(canonicalUrl);

      // Pull feedback for this chapter URL
      const feedback = await this.getFeedback(canonicalUrl).catch(() => []);

      chaptersOut.push({
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
          usageMetrics: {
            totalTokens: v.totalTokens,
            promptTokens: v.promptTokens,
            completionTokens: v.completionTokens,
            estimatedCost: v.estimatedCost,
            requestTime: v.requestTime,
            provider: v.provider,
            model: v.model
          }
        })),
        feedback: feedback.map(f => ({ id: f.id, type: f.type, selection: f.selection, comment: f.comment, createdAt: f.createdAt }))
      });
    }

    const promptTemplates = await this.getPromptTemplates().catch(() => []);

    const out = {
      metadata: {
        exportedAt: new Date().toISOString(),
        format: 'lexiconforge-full-1'
      },
      settings: settings ? {
        ...settings,
        apiKeyGemini: undefined,
        apiKeyOpenAI: undefined,
        apiKeyDeepSeek: undefined,
        apiKeyClaude: undefined,
        apiKeyPiAPI: undefined,
      } : null,
      navigation: {
        history: navHist?.stableIds || [],
        lastActive: lastActive || null
      },
      urlMappings,
      novels,
      chapters: chaptersOut,
      promptTemplates
    };

    return out;
  }
  
  /**
   * Store prompt template
   */
  async storePromptTemplate(template: PromptTemplate): Promise<void> {
    const db = await this.openDatabase();
    
    const record: PromptTemplateRecord = {
      id: template.id,
      name: template.name,
      description: template.description,
      content: template.content,
      isDefault: template.isDefault ? 1 : 0, // Convert boolean to number for IndexedDB
      createdAt: template.createdAt,
      lastUsed: template.lastUsed
    };
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PROMPT_TEMPLATES], 'readwrite');
      const store = transaction.objectStore(STORES.PROMPT_TEMPLATES);
      
      const request = store.put(record);
      request.onsuccess = () => {
        // console.log(`[IndexedDB] Prompt template stored: ${template.name}`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get all prompt templates
   */
  async getPromptTemplates(): Promise<PromptTemplateRecord[]> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PROMPT_TEMPLATES], 'readonly');
      const store = transaction.objectStore(STORES.PROMPT_TEMPLATES);
      
      const request = store.getAll();
      request.onsuccess = () => {
        const templates = request.result
          .map(template => ({
            ...template,
            isDefault: Boolean(template.isDefault) // Convert number back to boolean
          }))
          .sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        resolve(templates);
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get default prompt template
   */
  async getDefaultPromptTemplate(): Promise<PromptTemplateRecord | null> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PROMPT_TEMPLATES], 'readonly');
      const store = transaction.objectStore(STORES.PROMPT_TEMPLATES);
      const index = store.index('isDefault');
      
      // Use number (1) instead of boolean (true) for IndexedDB key range
      const request = index.get(IDBKeyRange.only(1));
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          // Convert number back to boolean for the interface
          result.isDefault = Boolean(result.isDefault);
        }
        resolve(result || null);
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get prompt template by ID
   */
  async getPromptTemplate(id: string): Promise<PromptTemplateRecord | null> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PROMPT_TEMPLATES], 'readonly');
      const store = transaction.objectStore(STORES.PROMPT_TEMPLATES);
      
      const request = store.get(id);
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          // Convert number back to boolean for the interface
          result.isDefault = Boolean(result.isDefault);
        }
        resolve(result || null);
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Delete prompt template
   */
  async deletePromptTemplate(id: string): Promise<void> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PROMPT_TEMPLATES], 'readwrite');
      const store = transaction.objectStore(STORES.PROMPT_TEMPLATES);
      
      const request = store.delete(id);
      request.onsuccess = () => {
        // console.log(`[IndexedDB] Prompt template deleted: ${id}`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Set default prompt template (unsets others)
   */
  async setDefaultPromptTemplate(id: string): Promise<void> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PROMPT_TEMPLATES], 'readwrite');
      const store = transaction.objectStore(STORES.PROMPT_TEMPLATES);
      
      // First, unset all defaults
      const getAllRequest = store.getAll();
      getAllRequest.onsuccess = () => {
        const updates: Promise<void>[] = [];
        
        getAllRequest.result.forEach(template => {
          const isNowDefault = template.id === id;
          template.isDefault = isNowDefault ? 1 : 0; // Convert boolean to number
          if (isNowDefault) {
            template.lastUsed = new Date().toISOString();
          }
          
          updates.push(new Promise((resolveUpdate) => {
            const updateRequest = store.put(template);
            updateRequest.onsuccess = () => resolveUpdate();
          }));
        });
        
        Promise.all(updates).then(() => {
          // console.log(`[IndexedDB] Set default prompt template: ${id}`);
          resolve();
        });
      };
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
  }
  
  /**
   * Close database connection (simplified - no state to manage)
   */
  close(): void {
    // console.log('[IndexedDB] No persistent connections to close');
  }

  /**
   * Test stable ID schema migration
   * This method verifies that the database schema has been properly upgraded
   */
  async testStableIdSchema(): Promise<{ success: boolean; message: string; details: any }> {
    try {
      // console.log('[IndexedDB] Testing stable ID schema migration...');
      
      const db = await this.openDatabase();
      
      // Check database version
      const version = db.version;
      console.log(`[IndexedDB] Database version: ${version}`);
      
      // Check that all expected stores exist
      const storeNames = Array.from(db.objectStoreNames).sort();
      const expectedStores = Object.values(STORES).sort();
      
      console.log('[IndexedDB] Found stores:', storeNames);
      console.log('[IndexedDB] Expected stores:', expectedStores);
      
      const missingStores = expectedStores.filter(store => !storeNames.includes(store));
      if (missingStores.length > 0) {
        return {
          success: false,
          message: `Missing stores: ${missingStores.join(', ')}`,
          details: { version, storeNames, expectedStores, missingStores }
        };
      }
      
      // Test URL_MAPPINGS store structure
      const urlTransaction = db.transaction([STORES.URL_MAPPINGS], 'readonly');
      const urlStore = urlTransaction.objectStore(STORES.URL_MAPPINGS);
      const urlIndexes = Array.from(urlStore.indexNames).sort();
      const expectedUrlIndexes = ['stableId', 'isCanonical', 'dateAdded'].sort();
      
      console.log('[IndexedDB] URL_MAPPINGS indexes:', urlIndexes);
      console.log('[IndexedDB] Expected URL_MAPPINGS indexes:', expectedUrlIndexes);
      
      // Test NOVELS store structure  
      const novelTransaction = db.transaction([STORES.NOVELS], 'readonly');
      const novelStore = novelTransaction.objectStore(STORES.NOVELS);
      const novelIndexes = Array.from(novelStore.indexNames).sort();
      const expectedNovelIndexes = ['source', 'title', 'dateAdded', 'lastAccessed'].sort();
      
      console.log('[IndexedDB] NOVELS indexes:', novelIndexes);
      console.log('[IndexedDB] Expected NOVELS indexes:', expectedNovelIndexes);
      
      db.close();
      
      return {
        success: true,
        message: `Schema migration successful. Database version ${version} with ${storeNames.length} stores.`,
        details: {
          version,
          storeNames,
          urlIndexes,
          novelIndexes,
          dbName: DB_NAME
        }
      };
      
    } catch (error: any) {
      console.error('[IndexedDB] Schema test failed:', error);
      return {
        success: false,
        message: `Schema test failed: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  // ========================================
  // PHASE 2: ENHANCED METHODS WITH STABLE ID SUPPORT  
  // ========================================
  
  /**
   * Check if the database service is available
   */
  isAvailable(): boolean {
    return true; // IndexedDB service is always available when imported
  }

  /**
   * Store enhanced chapter with stable ID support
   */
  async storeEnhancedChapter(enhancedChapter: any): Promise<void> {
    // For now, convert enhanced chapter to regular chapter format
    const chapter: Chapter = {
      title: enhancedChapter.title,
      content: enhancedChapter.content,
      originalUrl: enhancedChapter.canonicalUrl || enhancedChapter.originalUrl,
      nextUrl: enhancedChapter.nextUrl,
      prevUrl: enhancedChapter.prevUrl
    };
    
    await this.storeChapter(chapter);
    console.log('[IndexedDB] Stored enhanced chapter with stable ID:', enhancedChapter.id);
  }

  /**
   * Get translation versions by stable ID (wrapper around URL-based method)
   */
  async getTranslationVersionsByStableId(stableId: string): Promise<TranslationRecord[]> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([STORES.URL_MAPPINGS, STORES.TRANSLATIONS], 'readonly');
        const urlStore = tx.objectStore(STORES.URL_MAPPINGS);
        const idx = urlStore.index('stableId');
        const req = idx.get(stableId);
        req.onsuccess = async () => {
          const mapping = req.result as UrlMappingRecord | undefined;
          if (!mapping) { resolve([]); return; }
          try {
            const versions = await this.getTranslationVersions(mapping.url);
            // annotate stableId on results for convenience
            versions.forEach(v => (v.stableId = stableId));
            resolve(versions);
          } catch (e) { reject(e); }
        };
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
  }

  /**
   * Get active translation by stable ID (wrapper around URL-based method)
   */
  async getActiveTranslationByStableId(stableId: string): Promise<TranslationRecord | null> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([STORES.URL_MAPPINGS, STORES.TRANSLATIONS], 'readonly');
        const urlStore = tx.objectStore(STORES.URL_MAPPINGS);
        const idx = urlStore.index('stableId');
        const req = idx.get(stableId);
        req.onsuccess = async () => {
          const mapping = req.result as UrlMappingRecord | undefined;
          if (!mapping) { resolve(null); return; }
          try {
            const active = await this.getActiveTranslation(mapping.url);
            if (active) (active as any).stableId = stableId;
            resolve(active);
          } catch (e) { reject(e); }
        };
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
  }

  /**
   * Set active translation by stable ID (wrapper around URL-based method)
   */
  async setActiveTranslationByStableId(stableId: string, version: number): Promise<void> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([STORES.URL_MAPPINGS, STORES.TRANSLATIONS], 'readwrite');
        const urlStore = tx.objectStore(STORES.URL_MAPPINGS);
        const idx = urlStore.index('stableId');
        const req = idx.get(stableId);
        req.onsuccess = async () => {
          const mapping = req.result as UrlMappingRecord | undefined;
          if (!mapping) { reject(new Error('No URL mapping for stableId')); return; }
          try {
            await this.setActiveTranslation(mapping.url, version);
            resolve();
          } catch (e) { reject(e); }
        };
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
  }

  /**
   * Store translation with stable ID support (Phase 3 implementation)
   */
  async storeTranslationByStableId(
    stableId: string, 
    translationResult: TranslationResult,
    translationSettings: {
      provider: string;
      model: string;
      temperature: number;
      systemPrompt: string;
      promptId?: string;
      promptName?: string;
    }
  ): Promise<TranslationRecord> {
    // Phase 3: Find the URL for this stable ID and delegate to existing method
    const db = await this.openDatabase();
    
    return new Promise(async (resolve, reject) => {
      try {
        // First, find the URL mapping for this stable ID
        const transaction = db.transaction([STORES.URL_MAPPINGS], 'readonly');
        const store = transaction.objectStore(STORES.URL_MAPPINGS);
        const index = store.index('stableId');
        
        const request = index.get(stableId);
        request.onsuccess = async () => {
          if (request.result) {
            const chapterUrl = request.result.url;
            console.log('[IndexedDB] Found URL for stable ID:', stableId, '→', chapterUrl);
            
            // Delegate to existing URL-based method
            try {
              const result = await this.storeTranslation(chapterUrl, translationResult, translationSettings);
              
              // Also store the stable ID in the translation record for future lookups
              result.stableId = stableId;
              
              console.log('[IndexedDB] Stored translation with stable ID:', stableId, 'version:', result.version);
              resolve(result);
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error(`No URL mapping found for stable ID: ${stableId}`));
          }
        };
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get chapters formatted for React rendering with stable IDs
   * Generates stable IDs from existing chapter data for UI consistency
   */
  async getChaptersForReactRendering(): Promise<Array<{
    stableId: string;
    url: string;
    data: any;
    title: string;
    chapterNumber: number;
  }>> {
    try {
      dblogFull('[INDEXEDDB-DEBUG] getChaptersForReactRendering() called');
      
      const db = await this.openDatabase();
      dblogFull('[INDEXEDDB-DEBUG] Database opened successfully');
      
      const transaction = db.transaction(['chapters'], 'readonly');
      const store = transaction.objectStore('chapters');
      dblogFull('[INDEXEDDB-DEBUG] Transaction and store created');
      
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        dblogFull('[INDEXEDDB-DEBUG] getAll() request created');
        
        request.onsuccess = () => {
          const chapters = request.result as ChapterRecord[];
          
          dblogFull('[INDEXEDDB-DEBUG] Raw chapters from IndexedDB:', {
            chaptersCount: chapters.length,
            chaptersData: chapters.map((ch, idx) => ({
              index: idx,
              url: ch.url,
              title: ch.title,
              hasContent: !!ch.content,
              contentLength: ch.content?.length || 0,
              chapterNumber: ch.chapterNumber,
              hasNextUrl: !!ch.nextUrl,
              hasPrevUrl: !!ch.prevUrl,
              hasStableId: !!ch.stableId,
              allFields: Object.keys(ch)
            }))
          });
          
          const chaptersWithStableIds = chapters.map(chapter => {
            // Generate stable ID if not already present
            const stableId = chapter.stableId || this.generateStableId(chapter.content, chapter.chapterNumber || 0, chapter.title);
            
            const chapterData = {
              stableId,
              url: chapter.url,
              data: {
              chapter: {
                title: chapter.title,
                content: chapter.content,
                originalUrl: chapter.url,
                nextUrl: chapter.nextUrl,
                prevUrl: chapter.prevUrl,
                chapterNumber: chapter.chapterNumber,
                fanTranslation: chapter.fanTranslation,
              },
              translationResult: null // Will be loaded separately if needed
              },
              title: chapter.title,
              chapterNumber: chapter.chapterNumber || 0
            };
            
            // console.log('[INDEXEDDB-DEBUG] Processed chapter for rendering:', {
            //   originalStableId: chapter.stableId,
            //   generatedStableId: stableId,
            //   url: chapter.url,
            //   title: chapter.title,
            //   chapterNumber: chapter.chapterNumber || 0,
            //   hasChapterData: !!chapterData.data.chapter,
            //   hasChapterContent: !!chapterData.data.chapter.content
            // });
            
            return chapterData;
          });

          // Sort by chapter number
          chaptersWithStableIds.sort((a, b) => a.chapterNumber - b.chapterNumber);
          
          // console.log('[INDEXEDDB-DEBUG] Final processed chapters for rendering:', {
          //   totalCount: chaptersWithStableIds.length,
          //   sortedChapters: chaptersWithStableIds.map(ch => ({
          //     stableId: ch.stableId,
          //     url: ch.url,
          //     title: ch.title,
          //     chapterNumber: ch.chapterNumber
          //   }))
          // });
          
          dblog('[IndexedDB] getChaptersForReactRendering:', chaptersWithStableIds.length, 'chapters');
          resolve(chaptersWithStableIds);
        };
        request.onerror = () => {
          console.error('[INDEXEDDB-DEBUG] getAll() request failed:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[IndexedDB] Failed to get chapters for rendering:', error);
      console.error('[INDEXEDDB-DEBUG] getChaptersForReactRendering() failed with error:', error);
      return [];
    }
  }

  /**
   * Find chapter by URL and return with stable ID
   */
  async findChapterByUrl(url: string): Promise<{
    stableId: string;
    canonicalUrl: string;
    data: any;
  } | null> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(['chapters'], 'readonly');
      const store = transaction.objectStore('chapters');
      
      return new Promise((resolve, reject) => {
        const request = store.get(url);
        request.onsuccess = () => {
          const chapter = request.result as ChapterRecord;
          if (!chapter) {
            resolve(null);
            return;
          }

          // Generate stable ID if not already present
          const stableId = chapter.stableId || this.generateStableId(chapter.content, chapter.chapterNumber || 0, chapter.title);
          
          resolve({
            stableId,
            canonicalUrl: chapter.url,
            data: {
              chapter: {
                title: chapter.title,
                content: chapter.content,
                originalUrl: chapter.url,
                nextUrl: chapter.nextUrl,
                prevUrl: chapter.prevUrl,
                chapterNumber: chapter.chapterNumber,
              },
              translationResult: null
            }
          });
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[IndexedDB] Failed to find chapter by URL:', error);
      return null;
    }
  }

  /**
   * Persist stable session data into IndexedDB stores for durability across reloads.
   * Minimal implementation: writes chapters and URL mappings. Can be extended for novels/metadata.
   */
  async importStableSessionData(stableData: {
    novels: Map<string, any>;
    chapters: Map<string, any>;
    urlIndex: Map<string, string>;
    rawUrlIndex: Map<string, string>;
    currentChapterId?: string | null;
    navigationHistory?: string[];
  }): Promise<void> {
    const db = await this.openDatabase();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([
        STORES.CHAPTERS,
        STORES.URL_MAPPINGS,
        // STORES.NOVELS // optional, not strictly needed for rendering
      ], 'readwrite');

      tx.oncomplete = () => {
        // console.log('[IndexedDB] importStableSessionData: write complete');
        resolve();
      };
      tx.onerror = () => {
        console.error('[IndexedDB] importStableSessionData: transaction error', tx.error);
        reject(tx.error as any);
      };

      const chaptersStore = tx.objectStore(STORES.CHAPTERS);
      const urlMapStore = tx.objectStore(STORES.URL_MAPPINGS);

      // Write chapters
      for (const [, ch] of stableData.chapters) {
        try {
          const canonicalUrl = ch.canonicalUrl || ch.originalUrl || ch.chapter?.originalUrl;
          if (!canonicalUrl) continue;
          const record: ChapterRecord = {
            url: canonicalUrl,
            stableId: ch.stableId || ch.id || undefined,
            title: ch.title || ch.chapter?.title || '',
            content: ch.content || ch.chapter?.content || '',
            originalUrl: canonicalUrl,
            nextUrl: ch.nextUrl || ch.chapter?.nextUrl || undefined,
            prevUrl: ch.prevUrl || ch.chapter?.prevUrl || undefined,
            fanTranslation: ch.fanTranslation || ch.chapter?.fanTranslation || undefined,
            dateAdded: new Date().toISOString(),
            lastAccessed: new Date().toISOString(),
            chapterNumber: ch.chapterNumber || ch.chapter?.chapterNumber || undefined,
            canonicalUrl,
          } as ChapterRecord;
          chaptersStore.put(record);
        } catch (e) {
          console.error('[IndexedDB] Failed to store chapter record', e, ch);
        }
      }

      // Write URL mappings (raw and normalized -> stableId)
      const writeMapping = (url: string, stableId: string, isCanonical: boolean) => {
        try {
          const rec: UrlMappingRecord = {
            url,
            stableId,
            isCanonical,
            dateAdded: new Date().toISOString(),
          };
          urlMapStore.put(rec);
        } catch (e) {
          console.error('[IndexedDB] Failed to store URL mapping', e, { url, stableId, isCanonical });
        }
      };

      for (const [normUrl, sid] of stableData.urlIndex || []) {
        writeMapping(normUrl, sid, true);
      }
      for (const [rawUrl, sid] of stableData.rawUrlIndex || []) {
        writeMapping(rawUrl, sid, false);
      }
    });
  }

  /**
   * Import a full-session JSON produced by exportFullSessionToJson()
   */
  async importFullSessionData(payload: any): Promise<void> {
    const db = await this.openDatabase();
    const { settings, urlMappings, novels, chapters, promptTemplates } = payload || {};

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([
        STORES.CHAPTERS,
        STORES.URL_MAPPINGS,
        STORES.TRANSLATIONS,
        STORES.FEEDBACK,
        STORES.SETTINGS,
        STORES.NOVELS,
        STORES.PROMPT_TEMPLATES
      ], 'readwrite');

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error as any);

      try {
        // Settings
        if (settings) {
          const setStore = tx.objectStore(STORES.SETTINGS);
          setStore.put({ key: 'app-settings', value: settings, updatedAt: new Date().toISOString() });
        }
        if (payload?.navigation) {
          const setStore = tx.objectStore(STORES.SETTINGS);
          setStore.put({ key: 'navigation-history', value: { stableIds: payload.navigation.history || [] }, updatedAt: new Date().toISOString() });
          if (payload.navigation.lastActive) {
            setStore.put({ key: 'lastActiveChapter', value: payload.navigation.lastActive, updatedAt: new Date().toISOString() });
          }
        }

        // URL mappings
        if (Array.isArray(urlMappings)) {
          const mapStore = tx.objectStore(STORES.URL_MAPPINGS);
          for (const m of urlMappings) {
            const rec: UrlMappingRecord = {
              url: m.url,
              stableId: m.stableId,
              isCanonical: !!m.isCanonical,
              dateAdded: m.dateAdded || new Date().toISOString()
            };
            mapStore.put(rec);
          }
        }

        // Novels
        if (Array.isArray(novels)) {
          const novelStore = tx.objectStore(STORES.NOVELS);
          for (const n of novels) {
            const rec: NovelRecord = {
              id: n.id,
              title: n.title,
              source: n.source,
              chapterCount: n.chapterCount || 0,
              dateAdded: n.dateAdded || new Date().toISOString(),
              lastAccessed: n.lastAccessed || new Date().toISOString()
            };
            novelStore.put(rec);
          }
        }

        // Chapters + Translations + Feedback
        const chStore = tx.objectStore(STORES.CHAPTERS);
        const trStore = tx.objectStore(STORES.TRANSLATIONS);
        const fbStore = tx.objectStore(STORES.FEEDBACK);

        if (Array.isArray(chapters)) {
          for (const c of chapters) {
            const chapterRec: ChapterRecord = {
              url: c.canonicalUrl,
              stableId: c.stableId,
              title: c.title,
              content: c.content,
              fanTranslation: c.fanTranslation || undefined,
              originalUrl: c.canonicalUrl,
              nextUrl: c.nextUrl || undefined,
              prevUrl: c.prevUrl || undefined,
              dateAdded: new Date().toISOString(),
              lastAccessed: new Date().toISOString(),
              chapterNumber: c.chapterNumber || undefined,
              canonicalUrl: c.canonicalUrl
            };
            chStore.put(chapterRec);

            if (Array.isArray(c.translations)) {
              // Clear isActive first by setting while we import; we'll respect flags on records
              for (const t of c.translations) {
                const v: TranslationRecord = {
                  id: t.id || crypto.randomUUID(),
                  chapterUrl: c.canonicalUrl,
                  stableId: c.stableId,
                  version: t.version || 1,
                  translatedTitle: t.translatedTitle,
                  translation: t.translation,
                  footnotes: t.footnotes || [],
                  suggestedIllustrations: t.suggestedIllustrations || [],
                  provider: t.provider,
                  model: t.model,
                  temperature: t.temperature,
                  systemPrompt: t.systemPrompt,
                  promptId: t.promptId,
                  promptName: t.promptName,
                  totalTokens: t.usageMetrics?.totalTokens || 0,
                  promptTokens: t.usageMetrics?.promptTokens || 0,
                  completionTokens: t.usageMetrics?.completionTokens || 0,
                  estimatedCost: t.usageMetrics?.estimatedCost || 0,
                  requestTime: t.usageMetrics?.requestTime || 0,
                  createdAt: t.createdAt || new Date().toISOString(),
                  isActive: !!t.isActive
                };
                trStore.put(v);
              }
            }

            if (Array.isArray(c.feedback)) {
              for (const f of c.feedback) {
                const fb: FeedbackRecord = {
                  id: f.id || crypto.randomUUID(),
                  chapterUrl: c.canonicalUrl,
                  translationId: undefined,
                  type: f.type,
                  selection: f.selection,
                  comment: f.comment || '',
                  createdAt: f.createdAt || new Date().toISOString()
                };
                fbStore.put(fb);
              }
            }
          }
        }

        // Prompt templates
        if (Array.isArray(promptTemplates)) {
          const promptStore = tx.objectStore(STORES.PROMPT_TEMPLATES);
          for (const p of promptTemplates) {
            promptStore.put({
              id: p.id,
              name: p.name,
              description: p.description,
              content: p.content,
              isDefault: p.isDefault ? 1 : 0,
              createdAt: p.createdAt || new Date().toISOString(),
              lastUsed: p.lastUsed || undefined
            } as PromptTemplateRecord);
          }
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Clear all app data stored in IndexedDB by deleting the database
   */
  async clearAllData(): Promise<void> {
    try {
      const name = 'lexicon-forge';
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase(name);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => {
          console.warn('[IndexedDB] clearAllData blocked: another tab may be open');
        };
      });
      // Reset singleton handles so next open recreates schema
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dbInstance as any) = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dbPromise as any) = null;
      console.log('[IndexedDB] Database cleared');
    } catch (err) {
      console.error('[IndexedDB] Failed to clear database', err);
      throw err;
    }
  }

  /**
   * Read the most recently accessed chapter (for optional currentChapterId hydration)
   */
  async getMostRecentChapterStableId(): Promise<{ stableId: string; canonicalUrl: string } | null> {
    try {
      const db = await this.openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORES.CHAPTERS], 'readonly');
        const store = tx.objectStore(STORES.CHAPTERS);
        const idx = store.index('lastAccessed');
        const cursorReq = idx.openCursor(null, 'prev');
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result as IDBCursorWithValue | null;
          if (!cursor) { resolve(null); return; }
          const rec = cursor.value as ChapterRecord;
          const stableId = rec.stableId || this.generateStableId(rec.content || '', rec.chapterNumber || 0, rec.title || '');
          const canonicalUrl = rec.canonicalUrl || rec.url;
          resolve({ stableId, canonicalUrl });
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
    } catch (e) {
      console.warn('[IndexedDB] getMostRecentChapterStableId failed', e);
      return null;
    }
  }

  /**
   * Generate stable ID from chapter content
   * Simple hash function for browser compatibility
   */
  private generateStableId(content: string, chapterNumber: number, title: string): string {
    // Simple hash function
    const simpleHash = (str: string): string => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash).toString(16);
    };

    const contentHash = simpleHash(content).substring(0, 8);
    const titleHash = simpleHash(title).substring(0, 4);
    
    return `ch-${chapterNumber}-${contentHash}-${titleHash}`;
  }

  /**
   * Find a chapter by its chapter number
   * Note: This is inefficient as it requires a full table scan.
   * Use sparingly and in background tasks.
   */
  async findChapterByNumber(chapterNumber: number): Promise<ChapterRecord | null> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CHAPTERS], 'readonly');
      const store = transaction.objectStore(STORES.CHAPTERS);
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          if (cursor.value.chapterNumber === chapterNumber) {
            resolve(cursor.value as ChapterRecord);
            return; // Found it
          }
          cursor.continue();
        } else {
          resolve(null); // Not found
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }
}

// Export singleton instance
export const indexedDBService = new IndexedDBService();

// Migration functions have been moved to dedicated services

// Expose cleanup function globally for emergency use
if (typeof window !== 'undefined') {
  (window as any).cleanupDuplicateVersions = async () => {
    const { cleanupDuplicateVersions } = await import('./db/maintenanceService');
    return cleanupDuplicateVersions();
  };
  
  // Expose integrated cleanup that refreshes UI
  (window as any).cleanupAndRefresh = async () => {
    const { cleanupDuplicateVersions } = await import('./db/maintenanceService');
    await cleanupDuplicateVersions();
    // Trigger page refresh to reload all version data
    console.log('[Cleanup] Refreshing page to update UI...');
    window.location.reload();
  };
  
  // Expose IndexedDB recovery functions
  (window as any).resetIndexedDB = () => {
    console.log('[Recovery] IndexedDB now uses direct connections - no reset needed');
  };
  
  // NEW: Expose stable ID schema testing
  (window as any).testStableIdSchema = async () => {
    const result = await indexedDBService.testStableIdSchema();
    console.log('[Schema Test]', result.success ? '✅' : '❌', result.message);
    console.log('[Schema Test] Details:', result.details);
    return result;
  };
  
    dblog('[IndexedDB] Service loaded, window.testStableIdSchema() available');
}

// Export utility functions from dedicated services for backward compatibility
export { cleanupDuplicateVersions } from './db/maintenanceService';
export { migrateFromLocalStorage } from './db/migrationService';
