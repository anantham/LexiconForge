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

import { Chapter, TranslationResult, AppSettings, FeedbackItem } from '../types';

// Database configuration
const DB_NAME = 'lexicon-forge';
const DB_VERSION = 1;

// Object store names
const STORES = {
  CHAPTERS: 'chapters',
  TRANSLATIONS: 'translations', 
  SETTINGS: 'settings',
  FEEDBACK: 'feedback'
} as const;

// IndexedDB Schema Types
export interface ChapterRecord {
  url: string;                    // Primary key
  title: string;
  content: string;
  originalUrl: string;
  nextUrl?: string;
  prevUrl?: string;
  dateAdded: string;              // ISO timestamp
  lastAccessed: string;           // ISO timestamp
}

export interface TranslationRecord {
  id: string;                     // Generated UUID
  chapterUrl: string;             // Foreign key to chapters
  version: number;                // Version number (1, 2, 3...)
  translatedTitle: string;
  translation: string;
  footnotes: Array<{ marker: string; text: string }>;
  suggestedIllustrations: Array<{ placementMarker: string; imagePrompt: string }>;
  
  // Translation metadata
  provider: string;               // 'Gemini', 'OpenAI', 'DeepSeek'
  model: string;                  // 'gemini-2.5-flash', 'gpt-5', etc.
  temperature: number;
  systemPrompt: string;           // Snapshot of prompt used
  
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

// Database service class
class IndexedDBService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  /**
   * Initialize the database connection
   */
  async init(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }
    
    if (this.initPromise) {
      return this.initPromise;
    }
    
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => {
        console.error('[IndexedDB] Database failed to open:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        console.log('[IndexedDB] Database opened successfully');
        this.db = request.result;
        resolve(request.result);
      };
      
      request.onupgradeneeded = (event) => {
        console.log('[IndexedDB] Database upgrade needed');
        const db = (event.target as IDBOpenDBRequest).result;
        this.createSchema(db);
      };
    });
    
    return this.initPromise;
  }
  
  /**
   * Create the database schema
   */
  private createSchema(db: IDBDatabase): void {
    console.log('[IndexedDB] Creating database schema');
    
    // Chapters store
    if (!db.objectStoreNames.contains(STORES.CHAPTERS)) {
      const chaptersStore = db.createObjectStore(STORES.CHAPTERS, { keyPath: 'url' });
      chaptersStore.createIndex('dateAdded', 'dateAdded');
      chaptersStore.createIndex('lastAccessed', 'lastAccessed');
      console.log('[IndexedDB] Created chapters store');
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
      console.log('[IndexedDB] Created translations store');
    }
    
    // Settings store
    if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
      db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      console.log('[IndexedDB] Created settings store');
    }
    
    // Feedback store
    if (!db.objectStoreNames.contains(STORES.FEEDBACK)) {
      const feedbackStore = db.createObjectStore(STORES.FEEDBACK, { keyPath: 'id' });
      feedbackStore.createIndex('chapterUrl', 'chapterUrl');
      feedbackStore.createIndex('translationId', 'translationId');
      feedbackStore.createIndex('createdAt', 'createdAt');
      feedbackStore.createIndex('type', 'type');
      console.log('[IndexedDB] Created feedback store');
    }
  }
  
  /**
   * Store chapter data
   */
  async storeChapter(chapter: Chapter): Promise<void> {
    const db = await this.init();
    
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
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CHAPTERS], 'readwrite');
      const store = transaction.objectStore(STORES.CHAPTERS);
      
      // Update lastAccessed if chapter already exists
      const getRequest = store.get(chapter.originalUrl);
      getRequest.onsuccess = () => {
        if (getRequest.result) {
          chapterRecord.dateAdded = getRequest.result.dateAdded; // Keep original date
        }
        
        const putRequest = store.put(chapterRecord);
        putRequest.onsuccess = () => {
          console.log('[IndexedDB] Chapter stored:', chapter.originalUrl);
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
    }
  ): Promise<TranslationRecord> {
    const db = await this.init();
    
    // Get next version number for this chapter
    const nextVersion = await this.getNextVersionNumber(chapterUrl);
    
    // Generate unique ID
    const id = crypto.randomUUID();
    
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
      
      totalTokens: translationResult.usageMetrics.totalTokens,
      promptTokens: translationResult.usageMetrics.promptTokens,
      completionTokens: translationResult.usageMetrics.completionTokens,
      estimatedCost: translationResult.usageMetrics.estimatedCost,
      requestTime: translationResult.usageMetrics.requestTime,
      
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
              console.log(`[IndexedDB] Translation stored: ${chapterUrl} v${nextVersion}`);
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
    const db = await this.init();
    
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
    const db = await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.TRANSLATIONS], 'readonly');
      const store = transaction.objectStore(STORES.TRANSLATIONS);
      const index = store.index('chapterUrl');
      
      const request = index.getAll(IDBKeyRange.only(chapterUrl));
      request.onsuccess = () => {
        const versions = request.result.sort((a, b) => b.version - a.version); // Latest first
        resolve(versions);
      };
      request.onerror = () => reject(request.error);
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
   * Set active translation version
   */
  async setActiveTranslation(chapterUrl: string, version: number): Promise<void> {
    const db = await this.init();
    
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
            console.log(`[IndexedDB] Set active translation: ${chapterUrl} v${version}`);
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
    const db = await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.TRANSLATIONS], 'readwrite');
      const store = transaction.objectStore(STORES.TRANSLATIONS);
      
      const request = store.delete(translationId);
      request.onsuccess = () => {
        console.log('[IndexedDB] Translation version deleted:', translationId);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get chapter data
   */
  async getChapter(url: string): Promise<ChapterRecord | null> {
    const db = await this.init();
    
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
   * Store settings
   */
  async storeSettings(settings: AppSettings): Promise<void> {
    const db = await this.init();
    
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
        console.log('[IndexedDB] Settings stored');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get settings
   */
  async getSettings(): Promise<AppSettings | null> {
    const db = await this.init();
    
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
    const db = await this.init();
    
    const feedbackRecord: FeedbackRecord = {
      id: crypto.randomUUID(),
      chapterUrl,
      translationId,
      type: feedback.type,
      selection: feedback.selection,
      comment: feedback.comment,
      createdAt: new Date().toISOString()
    };
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.FEEDBACK], 'readwrite');
      const store = transaction.objectStore(STORES.FEEDBACK);
      
      const request = store.add(feedbackRecord);
      request.onsuccess = () => {
        console.log('[IndexedDB] Feedback stored:', chapterUrl);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get feedback for a chapter
   */
  async getFeedback(chapterUrl: string): Promise<FeedbackRecord[]> {
    const db = await this.init();
    
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
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
      console.log('[IndexedDB] Database connection closed');
    }
  }
}

// Export singleton instance
export const indexedDBService = new IndexedDBService();

/**
 * Helper function to migrate localStorage data to IndexedDB
 */
export async function migrateFromLocalStorage(): Promise<void> {
  console.log('[Migration] Starting localStorage to IndexedDB migration');
  
  try {
    // Get existing data from localStorage
    const sessionDataStr = localStorage.getItem('novel-translator-storage-v2');
    if (!sessionDataStr) {
      console.log('[Migration] No localStorage data found to migrate');
      return;
    }
    
    const sessionData = JSON.parse(sessionDataStr);
    
    // Migrate chapters and translations
    if (sessionData.state?.sessionData) {
      for (const [url, data] of Object.entries(sessionData.state.sessionData) as [string, any][]) {
        // Store chapter
        await indexedDBService.storeChapter(data.chapter);
        
        // Store translation if it exists
        if (data.translationResult) {
          // We need to reconstruct the translation settings from somewhere
          const settings = sessionData.state.settings || {};
          await indexedDBService.storeTranslation(url, data.translationResult, {
            provider: settings.provider || 'Gemini',
            model: settings.model || 'gemini-2.5-flash',
            temperature: settings.temperature || 0.3,
            systemPrompt: settings.systemPrompt || ''
          });
        }
      }
    }
    
    // Migrate settings
    if (sessionData.state?.settings) {
      await indexedDBService.storeSettings(sessionData.state.settings);
    }
    
    // Migrate feedback
    if (sessionData.state?.feedbackHistory) {
      for (const [url, feedbackItems] of Object.entries(sessionData.state.feedbackHistory) as [string, FeedbackItem[]][]) {
        for (const feedback of feedbackItems) {
          await indexedDBService.storeFeedback(url, feedback);
        }
      }
    }
    
    console.log('[Migration] Successfully migrated localStorage data to IndexedDB');
    
    // Optionally clear localStorage after successful migration
    // localStorage.removeItem('novel-translator-storage-v2');
    
  } catch (error) {
    console.error('[Migration] Failed to migrate localStorage data:', error);
    throw error;
  }
}