/**
 * Sutta Studio Pipeline Cache
 *
 * Multi-level caching for the Sutta Studio pipeline to reduce LLM costs.
 *
 * Cache Levels:
 * - L2: Morphology Cache - Word segmentation/tooltips (persisted, cross-sutta)
 * - L5: Segment Cache - Full phase outputs for identical segments (in-memory, per-run)
 *
 * See: docs/adr/SUTTA-004-pipeline-caching-architecture.md
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
  wordClass: 'content' | 'function';
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
  createdAt: string;
}

export interface CacheStats {
  morphology: { size: number; hits: number; misses: number; hitRate: string };
  segment: { size: number; hits: number; misses: number; hitRate: string };
  estimatedSavingsPercent: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// L5: Segment Cache (In-Memory, Per-Compilation-Run)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple hash function for Pali text.
 * Good enough for deduplication within a single sutta.
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
  private hits = 0;
  private misses = 0;

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
    } else {
      this.cache.set(hash, {
        paliHash: hash,
        paliText,
        anatomist,
        lexicographer: null,
        weaver: null,
        typesetter: null,
        createdAt: new Date().toISOString(),
      });
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
    }
  }

  /**
   * Clear the cache (call at start of new compilation)
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
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

const MORPHOLOGY_DB_NAME = 'sutta-studio-cache';
const MORPHOLOGY_STORE_NAME = 'morphology_cache';
const MORPHOLOGY_DB_VERSION = 1;

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

    // Skip IndexedDB in Node.js environment
    if (typeof indexedDB === 'undefined') {
      console.log('[MorphologyCache] IndexedDB not available, using memory-only cache');
      this.initialized = true;
      return;
    }

    try {
      this.dbInstance = await this.openDatabase();
      await this.loadIntoMemory();
      this.initialized = true;
      console.log(`[MorphologyCache] Initialized with ${this.memoryCache.size} entries`);
    } catch (e) {
      console.warn('[MorphologyCache] Failed to initialize IndexedDB, using memory-only:', e);
      this.initialized = true;
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(MORPHOLOGY_DB_NAME, MORPHOLOGY_DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(MORPHOLOGY_STORE_NAME)) {
          const store = db.createObjectStore(MORPHOLOGY_STORE_NAME, { keyPath: 'surface' });
          store.createIndex('promptVersion', 'promptVersion', { unique: false });
          console.log('[MorphologyCache] Created IndexedDB store');
        }
      };
    });
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
    wordClass: 'content' | 'function'
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
      wordClass: 'content' | 'function';
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
  await morphologyCache.initialize();
  console.log('[PipelineCache] All caches initialized');
}

/**
 * Clear segment cache (call at start of new compilation)
 */
export function resetSegmentCache(): void {
  segmentCache.clear();
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
