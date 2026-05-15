/**
 * Tests for the persistent L5 SegmentCache.
 *
 * Verifies that segment cache entries survive across:
 *  - Multiple compile runs (resetSegmentCache only clears stats)
 *  - Module re-initialization (entries reloaded from IndexedDB)
 *  - Prompt-version-stable entries (kept) vs stale (invalidated on load)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AnatomistPass, LexicographerPass } from '../../types/suttaStudio';
import { SUTTA_STUDIO_PROMPT_VERSION } from '../../services/suttaStudioPromptVersion';

const DB_NAME = 'sutta-studio-cache';
const DB_VERSION = 2;
const SEGMENT_STORE = 'segment_cache';
const MORPH_STORE = 'morphology_cache';

/** Mirror of services/suttaStudioPipelineCache.ts hashPaliText so tests can compute paliHash for seeds. */
function hashPaliText(pali: string): string {
  const normalized = pali.trim().toLowerCase();
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash) ^ normalized.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

const makeAnatomist = (text: string): AnatomistPass => ({
  segments: [{ paliText: text, tokens: [] as any }],
} as unknown as AnatomistPass);

const makeLexicographer = (lemma: string): LexicographerPass => ({
  senses: [{ lemma, glosses: ['gloss'] } as any],
} as unknown as LexicographerPass);

/** Wipe the underlying IDB, reset the shared dbPromise, and force a fresh import of the cache module. */
async function wipeAndReset() {
  // Close any open singleton connection so deleteDatabase doesn't get blocked
  try {
    const prior = await import('../../services/suttaStudioPipelineCache');
    // Best-effort: drop in-memory + persisted entries on the old singleton.
    await prior.segmentCache.clearAll(true).catch(() => undefined);
  } catch {
    // First-test path — module not yet loaded
  }
  // Reset Vitest's module cache so the singletons get rebuilt on the next import
  vi.resetModules();

  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

/** Read the DB directly to bypass the cache module (for cross-instance verification). */
async function getRawSegmentEntries(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(SEGMENT_STORE)) {
        db.createObjectStore(SEGMENT_STORE, { keyPath: 'paliHash' });
      }
      if (!db.objectStoreNames.contains(MORPH_STORE)) {
        db.createObjectStore(MORPH_STORE, { keyPath: 'surface' });
      }
    };
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction([SEGMENT_STORE], 'readonly');
      const req = tx.objectStore(SEGMENT_STORE).getAll();
      req.onsuccess = () => {
        db.close();
        resolve((req.result as any[]) || []);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    };
    open.onerror = () => reject(open.error);
  });
}

/** Seed a single entry directly into the DB. */
async function seedRawEntry(entry: any) {
  return new Promise<void>((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(SEGMENT_STORE)) {
        const store = db.createObjectStore(SEGMENT_STORE, { keyPath: 'paliHash' });
        store.createIndex('promptVersion', 'promptVersion', { unique: false });
      }
      if (!db.objectStoreNames.contains(MORPH_STORE)) {
        const store = db.createObjectStore(MORPH_STORE, { keyPath: 'surface' });
        store.createIndex('promptVersion', 'promptVersion', { unique: false });
      }
    };
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction([SEGMENT_STORE], 'readwrite');
      tx.objectStore(SEGMENT_STORE).put(entry);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
    open.onerror = () => reject(open.error);
  });
}

describe('SegmentCache persistence (L5)', () => {
  beforeEach(async () => {
    await wipeAndReset();
  });

  it('persists setAnatomist output to IndexedDB', async () => {
    const { segmentCache } = await import('../../services/suttaStudioPipelineCache');
    await segmentCache.initialize();

    const pali = 'evaṃ me sutaṃ';
    segmentCache.setAnatomist(pali, makeAnatomist(pali));

    // Persistence is fire-and-forget. Give IDB a moment, then read back.
    await new Promise((r) => setTimeout(r, 20));

    const raw = await getRawSegmentEntries();
    expect(raw).toHaveLength(1);
    expect(raw[0].paliText).toBe(pali);
    expect(raw[0].anatomist).toBeTruthy();
    expect(raw[0].promptVersion).toBe(SUTTA_STUDIO_PROMPT_VERSION);
  });

  it('persists subsequent pass updates onto the same entry', async () => {
    const { segmentCache } = await import('../../services/suttaStudioPipelineCache');
    await segmentCache.initialize();

    const pali = 'satova assasati';
    segmentCache.setAnatomist(pali, makeAnatomist(pali));
    segmentCache.setLexicographer(pali, makeLexicographer('assasati'));

    await new Promise((r) => setTimeout(r, 20));

    const raw = await getRawSegmentEntries();
    expect(raw).toHaveLength(1);
    expect(raw[0].anatomist).toBeTruthy();
    expect(raw[0].lexicographer).toBeTruthy();
  });

  it('loads persisted entries on initialize() of a fresh instance', async () => {
    // Seed directly to IDB so we can verify the load path picks it up.
    const paliText = 'kāye kāyānupassī';
    const seeded = {
      paliHash: hashPaliText(paliText),
      paliText,
      anatomist: { segments: [] } as any,
      lexicographer: null,
      weaver: null,
      typesetter: null,
      promptVersion: SUTTA_STUDIO_PROMPT_VERSION,
      createdAt: new Date().toISOString(),
    };
    await seedRawEntry(seeded);

    // Fresh import (vi.resetModules in beforeEach) — singleton is brand new
    const { segmentCache } = await import('../../services/suttaStudioPipelineCache');
    await segmentCache.initialize();

    // The seeded entry should be loaded into memory and findable by its Pali text
    expect(segmentCache.has(seeded.paliText)).toBe(true);
    const entry = segmentCache.get(seeded.paliText);
    expect(entry).toBeTruthy();
    expect(entry!.paliText).toBe(paliText);
  });

  it('resetSegmentCache() resets stats but preserves entries', async () => {
    const { segmentCache, resetSegmentCache } = await import('../../services/suttaStudioPipelineCache');
    await segmentCache.initialize();

    const pali = 'ekāyano ayaṃ bhikkhave maggo';
    segmentCache.setAnatomist(pali, makeAnatomist(pali));
    expect(segmentCache.has(pali)).toBe(true);
    expect(segmentCache.get(pali)).toBeTruthy(); // increments hits

    const beforeStats = segmentCache.getStats();
    expect(beforeStats.hits).toBeGreaterThan(0);

    resetSegmentCache();

    const afterStats = segmentCache.getStats();
    expect(afterStats.hits).toBe(0);
    expect(afterStats.misses).toBe(0);
    expect(afterStats.size).toBe(1); // entry preserved
    expect(segmentCache.has(pali)).toBe(true);
    expect(segmentCache.get(pali)).toBeTruthy();
  });

  it('filters out entries with mismatched promptVersion on load', async () => {
    const currentText = 'current-segment';
    const staleText = 'stale-segment';
    await seedRawEntry({
      paliHash: hashPaliText(currentText),
      paliText: currentText,
      anatomist: {} as any,
      lexicographer: null,
      weaver: null,
      typesetter: null,
      promptVersion: SUTTA_STUDIO_PROMPT_VERSION,
      createdAt: new Date().toISOString(),
    });
    await seedRawEntry({
      paliHash: hashPaliText(staleText),
      paliText: staleText,
      anatomist: {} as any,
      lexicographer: null,
      weaver: null,
      typesetter: null,
      promptVersion: 'sutta-studio-v0-ancient',
      createdAt: new Date().toISOString(),
    });

    // Raw IDB has both
    const raw = await getRawSegmentEntries();
    const seededHashes = raw.map((e) => e.paliHash);
    expect(seededHashes).toContain(hashPaliText(currentText));
    expect(seededHashes).toContain(hashPaliText(staleText));

    // Through the cache API (which applies the version filter on load),
    // only the current-version entry should be reachable.
    const { segmentCache } = await import('../../services/suttaStudioPipelineCache');
    await segmentCache.initialize();
    expect(segmentCache.has('current-segment')).toBe(true);
    expect(segmentCache.has('stale-segment')).toBe(false);
  });

  it('clearStaleEntries() removes entries from old prompt versions', async () => {
    const { segmentCache } = await import('../../services/suttaStudioPipelineCache');
    await segmentCache.initialize();

    await seedRawEntry({
      paliHash: 'cccc',
      paliText: 'stale-2',
      anatomist: {} as any,
      lexicographer: null,
      weaver: null,
      typesetter: null,
      promptVersion: 'sutta-studio-v0-ancient',
      createdAt: new Date().toISOString(),
    });
    await seedRawEntry({
      paliHash: 'dddd',
      paliText: 'current-2',
      anatomist: {} as any,
      lexicographer: null,
      weaver: null,
      typesetter: null,
      promptVersion: SUTTA_STUDIO_PROMPT_VERSION,
      createdAt: new Date().toISOString(),
    });

    const cleared = await segmentCache.clearStaleEntries();
    expect(cleared).toBeGreaterThanOrEqual(1);

    const remaining = await getRawSegmentEntries();
    const remainingVersions = remaining.map((e) => e.promptVersion);
    expect(remainingVersions).not.toContain('sutta-studio-v0-ancient');
  });
});
