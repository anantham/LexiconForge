/**
 * Local Dictionary Cache Service
 *
 * Caches dictionary lookups in IndexedDB so each word is only fetched once.
 * Future lookups are instant (0ms).
 */

const DB_NAME = 'lexicon-forge-db';
const STORE_NAME = 'dictionary_cache';
const DB_VERSION = 14; // Bump version to add new store

interface CachedEntry {
  word: string;
  definition: unknown | null;
  fetchedAt: string;
}

let dbInstance: IDBDatabase | null = null;
let memoryCache: Map<string, unknown | null> = new Map();

const openDatabase = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create dictionary_cache store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'word' });
        store.createIndex('fetchedAt', 'fetchedAt', { unique: false });
        console.log('[DictionaryCache] Created IndexedDB store');
      }
    };
  });
};

export const DictionaryCache = {
  /**
   * Initialize the cache - loads all entries into memory for instant access
   */
  async initialize(): Promise<void> {
    try {
      const db = await openDatabase();
      const tx = db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      const entries = await new Promise<CachedEntry[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });

      // Load into memory cache
      memoryCache.clear();
      for (const entry of entries) {
        memoryCache.set(entry.word.toLowerCase(), entry.definition);
      }

      console.log(`[DictionaryCache] Loaded ${memoryCache.size} cached entries into memory`);
    } catch (e) {
      console.warn('[DictionaryCache] Failed to initialize, starting fresh:', e);
      memoryCache = new Map();
    }
  },

  /**
   * Check if a word is in cache (instant, 0ms)
   */
  has(word: string): boolean {
    return memoryCache.has(word.toLowerCase());
  },

  /**
   * Get a cached definition (instant, 0ms)
   */
  get(word: string): unknown | null | undefined {
    const key = word.toLowerCase();
    if (memoryCache.has(key)) {
      return memoryCache.get(key);
    }
    return undefined; // Not in cache (different from null which means "looked up but not found")
  },

  /**
   * Store a definition in cache
   */
  async set(word: string, definition: unknown | null): Promise<void> {
    const key = word.toLowerCase();

    // Update memory cache immediately
    memoryCache.set(key, definition);

    // Persist to IndexedDB
    try {
      const db = await openDatabase();
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const entry: CachedEntry = {
        word: key,
        definition,
        fetchedAt: new Date().toISOString(),
      };

      store.put(entry);

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[DictionaryCache] Failed to persist entry:', e);
    }
  },

  /**
   * Batch set multiple entries
   */
  async setMany(entries: Array<{ word: string; definition: unknown | null }>): Promise<void> {
    // Update memory cache immediately
    for (const { word, definition } of entries) {
      memoryCache.set(word.toLowerCase(), definition);
    }

    // Persist to IndexedDB
    try {
      const db = await openDatabase();
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      for (const { word, definition } of entries) {
        const entry: CachedEntry = {
          word: word.toLowerCase(),
          definition,
          fetchedAt: new Date().toISOString(),
        };
        store.put(entry);
      }

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      console.log(`[DictionaryCache] Persisted ${entries.length} entries`);
    } catch (e) {
      console.warn('[DictionaryCache] Failed to persist batch:', e);
    }
  },

  /**
   * Get cache statistics
   */
  getStats(): { size: number; words: string[] } {
    return {
      size: memoryCache.size,
      words: Array.from(memoryCache.keys()).slice(0, 100), // First 100 for debugging
    };
  },

  /**
   * Clear all cached entries
   */
  async clear(): Promise<void> {
    memoryCache.clear();

    try {
      const db = await openDatabase();
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      console.log('[DictionaryCache] Cleared all entries');
    } catch (e) {
      console.warn('[DictionaryCache] Failed to clear:', e);
    }
  },
};

// Auto-initialize when module loads
DictionaryCache.initialize().catch(console.error);
