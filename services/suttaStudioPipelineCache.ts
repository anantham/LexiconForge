/**
 * Sutta Studio Pipeline Cache
 *
 * Multi-level caching for the Sutta Studio pipeline to reduce LLM costs.
 *
 * Cache Levels:
 * - L2: Morphology Cache - Word segmentation/tooltips (persisted, cross-sutta)
 * - L5: Segment Cache - Full phase outputs for identical segments (persisted, cross-sutta)
 *
 * See: docs/adr/SUTTA-006-pipeline-caching-architecture.md
 */

import type {
  AnatomistPass,
  LexicographerPass,
  WeaverPass,
  TypesetterPass,
} from '../types/suttaStudio';
import { SUTTA_STUDIO_PROMPT_VERSION } from './suttaStudioPromptVersion';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MorphologyCacheEntry {
  surface: string;
  segments: Array<{
    text: string;
    type: 'root' | 'prefix' | 'suffix' | 'stem';
    tooltips: string[];
  }>;
  wordClass: 'content' | 'function' | 'vocative';
  promptVersion: string;
  createdAt: string;
  hitCount: number;
}

export interface SegmentCacheEntry {
  paliHash: string;
  paliText: string;
  anatomist: AnatomistPass | null;
  lexicographer: LexicographerPass | null;
  weaver: WeaverPass | null;
  typesetter: TypesetterPass | null;
  promptVersion: string;
  createdAt: string;
}

export interface CacheStats {
  morphology: { size: number; hits: number; misses: number; hitRate: string };
  segment: { size: number; hits: number; misses: number; hitRate: string };
  estimatedSavingsPercent: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared IndexedDB connection
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_DB_NAME = 'sutta-studio-cache';
const CACHE_DB_VERSION = 2;
const MORPHOLOGY_STORE_NAME = 'morphology_cache';
const SEGMENT_STORE_NAME = 'segment_cache';

let cacheDbPromise: Promise<IDBDatabase | null> | null = null;

function openCacheDatabase(): Promise<IDBDatabase | null> {
  if (cacheDbPromise) return cacheDbPromise;

  // Skip IndexedDB in Node.js environment
  if (typeof indexedDB === 'undefined') {
    cacheDbPromise = Promise.resolve(null);
    return cacheDbPromise;
  }

  cacheDbPromise = new Promise((resolve) => {
    const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);

    request.onerror = () => {
      console.warn('[PipelineCache] Failed to open IndexedDB, using memory-only:', request.error);
      resolve(null);
    };
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(MORPHOLOGY_STORE_NAME)) {
        const store = db.createObjectStore(MORPHOLOGY_STORE_NAME, { keyPath: 'surface' });
        store.createIndex('promptVersion', 'promptVersion', { unique: false });
        console.log('[MorphologyCache] Created IndexedDB store');
      }
      if (!db.objectStoreNames.contains(SEGMENT_STORE_NAME)) {
        const store = db.createObjectStore(SEGMENT_STORE_NAME, { keyPath: 'paliHash' });
        store.createIndex('promptVersion', 'promptVersion', { unique: false });
        console.log('[SegmentCache] Created IndexedDB store');
      }
    };
  });

  return cacheDbPromise;
}

// Reset for tests
export function _resetCacheDbPromiseForTests(): void {
  cacheDbPromise = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// L5: Segment Cache (Persistent, Cross-Sutta)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple hash function for Pali text.
 * Good enough for deduplication of identical segments across suttas.
 */
function hashPaliText(pali: string): string {
  const normalized = pali.trim().toLowerCase();
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash) ^ normalized.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

class SegmentCache {
  private cache: Map<string, SegmentCacheEntry> = new Map();
  private dbInstance: IDBDatabase | null = null;
  private initialized = false;
  private hits = 0;
  private misses = 0;

  /**
   * Initialize the cache - opens DB and loads entries into memory.
   * Safe to call multiple times.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.dbInstance = await openCacheDatabase();
      if (this.dbInstance) {
        await this.loadIntoMemory();
      }
      this.initialized = true;
      console.log(`[SegmentCache] Initialized with ${this.cache.size} entries`);
    } catch (e) {
      console.warn('[SegmentCache] Failed to initialize IndexedDB, using memory-only:', e);
      this.initialized = true;
    }
  }

  private async loadIntoMemory(): Promise<void> {
    if (!this.dbInstance) return;

    const tx = this.dbInstance.transaction([SEGMENT_STORE_NAME], 'readonly');
    const store = tx.objectStore(SEGMENT_STORE_NAME);
    const request = store.getAll();

    const entries = await new Promise<SegmentCacheEntry[]>((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as SegmentCacheEntry[]) || []);
      request.onerror = () => reject(request.error);
    });

    this.cache.clear();
    let validCount = 0;
    for (const entry of entries) {
      if (entry.promptVersion === SUTTA_STUDIO_PROMPT_VERSION) {
        this.cache.set(entry.paliHash, entry);
        validCount++;
      }
    }
    console.log(`[SegmentCache] Loaded ${validCount}/${entries.length} entries (current version)`);
  }

  /**
   * Fire-and-forget persistence. Updates the in-memory entry are synchronous;
   * IDB writes happen asynchronously and don't block the compile pipeline.
   */
  private persist(entry: SegmentCacheEntry): void {
    if (!this.dbInstance) return;
    try {
      const tx = this.dbInstance.transaction([SEGMENT_STORE_NAME], 'readwrite');
      const store = tx.objectStore(SEGMENT_STORE_NAME);
      store.put(entry);
      tx.onerror = () => {
        console.warn('[SegmentCache] Failed to persist entry:', tx.error);
      };
    } catch (e) {
      console.warn('[SegmentCache] Failed to start persist transaction:', e);
    }
  }

  /**
   * Get cached output for a segment by its Pali text
   */
  get(paliText: string): SegmentCacheEntry | null {
    const hash = hashPaliText(paliText);
    const entry = this.cache.get(hash);
    if (entry) {
      this.hits++;
      return entry;
    }
    this.misses++;
    return null;
  }

  /**
   * Check if we have ANY cached data for this segment
   */
  has(paliText: string): boolean {
    return this.cache.has(hashPaliText(paliText));
  }

  /**
   * Cache anatomist output for a segment
   */
  setAnatomist(paliText: string, anatomist: AnatomistPass): void {
    const hash = hashPaliText(paliText);
    const existing = this.cache.get(hash);
    if (existing) {
      existing.anatomist = anatomist;
      this.persist(existing);
    } else {
      const entry: SegmentCacheEntry = {
        paliHash: hash,
        paliText,
        anatomist,
        lexicographer: null,
        weaver: null,
        typesetter: null,
        promptVersion: SUTTA_STUDIO_PROMPT_VERSION,
        createdAt: new Date().toISOString(),
      };
      this.cache.set(hash, entry);
      this.persist(entry);
    }
  }

  /**
   * Cache lexicographer output for a segment
   */
  setLexicographer(paliText: string, lexicographer: LexicographerPass): void {
    const hash = hashPaliText(paliText);
    const existing = this.cache.get(hash);
    if (existing) {
      existing.lexicographer = lexicographer;
      this.persist(existing);
    }
  }

  /**
   * Cache weaver output for a segment
   */
  setWeaver(paliText: string, weaver: WeaverPass): void {
    const hash = hashPaliText(paliText);
    const existing = this.cache.get(hash);
    if (existing) {
      existing.weaver = weaver;
      this.persist(existing);
    }
  }

  /**
   * Cache typesetter output for a segment
   */
  setTypesetter(paliText: string, typesetter: TypesetterPass): void {
    const hash = hashPaliText(paliText);
    const existing = this.cache.get(hash);
    if (existing) {
      existing.typesetter = typesetter;
      this.persist(existing);
    }
  }

  /**
   * Reset hit/miss counters. Call at start of each compile to get
   * per-compile statistics. Does NOT clear cached entries.
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Clear all entries from in-memory cache.
   * Persisted entries in IndexedDB remain unless `clearAll(true)` is used.
   * Generally only useful for tests.
   */
  async clearAll(includePersisted = false): Promise<void> {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    if (includePersisted && this.dbInstance) {
      try {
        const tx = this.dbInstance.transaction([SEGMENT_STORE_NAME], 'readwrite');
        tx.objectStore(SEGMENT_STORE_NAME).clear();
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (e) {
        console.warn('[SegmentCache] Failed to clear persisted entries:', e);
      }
    }
  }

  /**
   * Clear entries from old prompt versions. Returns count of removed entries.
   */
  async clearStaleEntries(): Promise<number> {
    if (!this.dbInstance) return 0;

    const tx = this.dbInstance.transaction([SEGMENT_STORE_NAME], 'readwrite');
    const store = tx.objectStore(SEGMENT_STORE_NAME);

    let clearedCount = 0;
    const request = store.openCursor();

    await new Promise<void>((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const entry = cursor.value as SegmentCacheEntry;
          if (entry.promptVersion !== SUTTA_STUDIO_PROMPT_VERSION) {
            cursor.delete();
            clearedCount++;
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });

    if (clearedCount > 0) {
      console.log(`[SegmentCache] Cleared ${clearedCount} stale entries`);
    }
    return clearedCount;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; hits: number; misses: number; hitRate: string } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : '0%';
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// L2: Morphology Cache (Persistent, Cross-Sutta)
// ─────────────────────────────────────────────────────────────────────────────

function normalizeSurface(surface: string): string {
  return surface.replace(/[,."'—;:!?""'']/g, '').toLowerCase().trim();
}

class MorphologyCache {
  private memoryCache: Map<string, MorphologyCacheEntry> = new Map();
  private dbInstance: IDBDatabase | null = null;
  private initialized = false;
  private hits = 0;
  private misses = 0;

  /**
   * Initialize the cache - loads entries into memory
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.dbInstance = await openCacheDatabase();
      if (this.dbInstance) {
        await this.loadIntoMemory();
      }
      this.initialized = true;
      console.log(`[MorphologyCache] Initialized with ${this.memoryCache.size} entries`);
    } catch (e) {
      console.warn('[MorphologyCache] Failed to initialize IndexedDB, using memory-only:', e);
      this.initialized = true;
    }
  }

  private async loadIntoMemory(): Promise<void> {
    if (!this.dbInstance) return;

    const tx = this.dbInstance.transaction([MORPHOLOGY_STORE_NAME], 'readonly');
    const store = tx.objectStore(MORPHOLOGY_STORE_NAME);
    const request = store.getAll();

    const entries = await new Promise<MorphologyCacheEntry[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    this.memoryCache.clear();
    let validCount = 0;
    for (const entry of entries) {
      // Only load entries from current prompt version
      if (entry.promptVersion === SUTTA_STUDIO_PROMPT_VERSION) {
        this.memoryCache.set(entry.surface, entry);
        validCount++;
      }
    }
    console.log(`[MorphologyCache] Loaded ${validCount}/${entries.length} entries (current version)`);
  }

  /**
   * Get cached morphology for a word
   */
  get(surface: string): MorphologyCacheEntry | null {
    const key = normalizeSurface(surface);
    const entry = this.memoryCache.get(key);
    if (entry) {
      entry.hitCount++;
      this.hits++;
      return entry;
    }
    this.misses++;
    return null;
  }

  /**
   * Check if word is in cache
   */
  has(surface: string): boolean {
    return this.memoryCache.has(normalizeSurface(surface));
  }

  /**
   * Cache morphology for a word
   */
  async set(
    surface: string,
    segments: MorphologyCacheEntry['segments'],
    wordClass: 'content' | 'function' | 'vocative'
  ): Promise<void> {
    const key = normalizeSurface(surface);

    const entry: MorphologyCacheEntry = {
      surface: key,
      segments,
      wordClass,
      promptVersion: SUTTA_STUDIO_PROMPT_VERSION,
      createdAt: new Date().toISOString(),
      hitCount: 0,
    };

    this.memoryCache.set(key, entry);

    // Persist to IndexedDB if available
    if (this.dbInstance) {
      try {
        const tx = this.dbInstance.transaction([MORPHOLOGY_STORE_NAME], 'readwrite');
        const store = tx.objectStore(MORPHOLOGY_STORE_NAME);
        store.put(entry);
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (e) {
        console.warn('[MorphologyCache] Failed to persist:', e);
      }
    }
  }

  /**
   * Batch set multiple entries
   */
  async setMany(
    entries: Array<{
      surface: string;
      segments: MorphologyCacheEntry['segments'];
      wordClass: 'content' | 'function' | 'vocative';
    }>
  ): Promise<void> {
    const cacheEntries: MorphologyCacheEntry[] = entries.map((e) => ({
      surface: normalizeSurface(e.surface),
      segments: e.segments,
      wordClass: e.wordClass,
      promptVersion: SUTTA_STUDIO_PROMPT_VERSION,
      createdAt: new Date().toISOString(),
      hitCount: 0,
    }));

    // Update memory cache
    for (const entry of cacheEntries) {
      this.memoryCache.set(entry.surface, entry);
    }

    // Persist to IndexedDB
    if (this.dbInstance) {
      try {
        const tx = this.dbInstance.transaction([MORPHOLOGY_STORE_NAME], 'readwrite');
        const store = tx.objectStore(MORPHOLOGY_STORE_NAME);
        for (const entry of cacheEntries) {
          store.put(entry);
        }
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        console.log(`[MorphologyCache] Persisted ${cacheEntries.length} entries`);
      } catch (e) {
        console.warn('[MorphologyCache] Failed to persist batch:', e);
      }
    }
  }

  /**
   * Clear entries from old prompt versions
   */
  async clearStaleEntries(): Promise<number> {
    if (!this.dbInstance) return 0;

    const tx = this.dbInstance.transaction([MORPHOLOGY_STORE_NAME], 'readwrite');
    const store = tx.objectStore(MORPHOLOGY_STORE_NAME);
    const index = store.index('promptVersion');

    let clearedCount = 0;
    const request = store.openCursor();

    await new Promise<void>((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const entry = cursor.value as MorphologyCacheEntry;
          if (entry.promptVersion !== SUTTA_STUDIO_PROMPT_VERSION) {
            cursor.delete();
            clearedCount++;
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });

    console.log(`[MorphologyCache] Cleared ${clearedCount} stale entries`);
    return clearedCount;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; hits: number; misses: number; hitRate: string } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : '0%';
    return {
      size: this.memoryCache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
    };
  }

  /**
   * Reset hit/miss counters (for benchmarking)
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Instances
// ─────────────────────────────────────────────────────────────────────────────

export const segmentCache = new SegmentCache();
export const morphologyCache = new MorphologyCache();

/**
 * Get combined statistics for all cache levels
 */
export function getPipelineCacheStats(): CacheStats {
  const morphStats = morphologyCache.getStats();
  const segStats = segmentCache.getStats();

  const totalHits = morphStats.hits + segStats.hits;
  const totalMisses = morphStats.misses + segStats.misses;
  const total = totalHits + totalMisses;
  const savingsPercent = total > 0 ? (totalHits / total) * 100 : 0;

  return {
    morphology: morphStats,
    segment: segStats,
    estimatedSavingsPercent: Math.round(savingsPercent),
  };
}

/**
 * Initialize all caches (call at app startup)
 */
export async function initializePipelineCaches(): Promise<void> {
  await Promise.all([morphologyCache.initialize(), segmentCache.initialize()]);
  console.log('[PipelineCache] All caches initialized');
}

/**
 * Reset per-compile statistics counters on the segment cache.
 * Does NOT clear cached entries — they are now persistent across compiles
 * and across suttas. Call at the start of each compile to get accurate
 * per-run hit/miss numbers.
 */
export function resetSegmentCache(): void {
  segmentCache.resetStats();
}

/**
 * Log cache statistics (for debugging/benchmarking)
 */
export function logCacheStats(): void {
  const stats = getPipelineCacheStats();
  console.log('┌─────────────────────────────────────────────┐');
  console.log('│           PIPELINE CACHE STATS              │');
  console.log('├─────────────────────────────────────────────┤');
  console.log(`│ L2 Morphology: ${stats.morphology.size} entries, ${stats.morphology.hitRate} hit rate`);
  console.log(`│ L5 Segment:    ${stats.segment.size} entries, ${stats.segment.hitRate} hit rate`);
  console.log(`│ Est. Savings:  ~${stats.estimatedSavingsPercent}%`);
  console.log('└─────────────────────────────────────────────┘');
}
