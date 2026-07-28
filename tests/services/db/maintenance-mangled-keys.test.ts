// @vitest-environment node
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * V6 migration guard: normalizeUrlAggressively's custom-scheme mangle
 * (URL.origin === literal "null") was persisted by five maintenance paths as
 * url_mappings PRIMARY KEYS ("null/chapter/64"), chapters.canonicalUrl and
 * summaries.canonicalUrl. The generator is fixed; this migration heals the
 * rows it already wrote — and checks its flag BEFORE any store scan.
 */

const settingsStore = new Map<string, unknown>();
vi.mock('../../../services/db/operations/settings', () => ({
  SettingsOps: {
    getKey: vi.fn(async (k: string) => settingsStore.get(k) ?? null),
    set: vi.fn(async (k: string, v: unknown) => void settingsStore.set(k, v)),
  },
}));

const ensureUrlMappingsMock = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock('../../../services/db/core/stable-ids', () => ({
  StableIdManager: { ensureUrlMappings: (...a: unknown[]) => ensureUrlMappingsMock(...a) },
}));

import { STORE_NAMES } from '../../../services/db/core/schema';
import { getConnection } from '../../../services/db/core/connection';
import { MaintenanceOps } from '../../../services/db/operations/maintenance';

const put = async (store: string, value: Record<string, unknown>) => {
  const db = await getConnection();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction([store], 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
};

const getAll = async (store: string): Promise<any[]> => {
  const db = await getConnection();
  return await new Promise((res, rej) => {
    const tx = db.transaction([store], 'readonly');
    const rq = tx.objectStore(store).getAll();
    rq.onsuccess = () => res(rq.result || []);
    rq.onerror = () => rej(rq.error);
  });
};

describe('MaintenanceOps.repairMangledCanonicalKeys (V6)', () => {
  beforeEach(async () => {
    settingsStore.clear();
    ensureUrlMappingsMock.mockClear();
    const db = await getConnection();
    for (const store of [STORE_NAMES.URL_MAPPINGS, STORE_NAMES.CHAPTERS, STORE_NAMES.CHAPTER_SUMMARIES]) {
      await new Promise<void>((res) => {
        const tx = db.transaction([store], 'readwrite');
        tx.objectStore(store).clear();
        tx.oncomplete = () => res();
      });
    }
  });

  it('deletes mangled mapping keys, repairs canonicalUrls, re-emits via the canonical upsert, sets the flag', async () => {
    await put(STORE_NAMES.URL_MAPPINGS, { url: 'null/chapter/64', stableId: 'lf-library:novel%3A%3Av1:ch64_ab_cd', novelId: null, isCanonical: true, dateAdded: '2026-07-01' });
    await put(STORE_NAMES.URL_MAPPINGS, { url: 'lexiconforge://novel/chapter/64', stableId: 'lf-library:novel%3A%3Av1:ch64_ab_cd', novelId: null, isCanonical: false, dateAdded: '2026-07-01' });
    await put(STORE_NAMES.CHAPTERS, { url: 'lf-library://novel%3A%3Av1/ch64', stableId: 'lf-library:novel%3A%3Av1:ch64_ab_cd', canonicalUrl: 'null/chapter/64', originalUrl: 'lexiconforge://novel/chapter/64', title: 'T', content: 'C', novelId: 'novel', libraryVersionId: 'v1', chapterNumber: 64, dateAdded: '2026-07-01', lastAccessed: '2026-07-01' });
    await put(STORE_NAMES.CHAPTER_SUMMARIES, { stableId: 'lf-library:novel%3A%3Av1:ch64_ab_cd', canonicalUrl: 'null/chapter/64', title: 'T' });

    const report = await MaintenanceOps.repairMangledCanonicalKeys();

    expect(report.skipped).toBe(false);
    expect(report.mappingsDeleted).toBe(1);
    expect(report.chaptersRepaired).toBe(1);
    expect(report.summariesRepaired).toBe(1);

    const mappings = await getAll(STORE_NAMES.URL_MAPPINGS);
    expect(mappings.some((m) => m.url.startsWith('null/'))).toBe(false);
    expect(mappings.some((m) => m.url === 'lexiconforge://novel/chapter/64')).toBe(true);

    const [chapter] = await getAll(STORE_NAMES.CHAPTERS);
    // With the fixed normalizer the custom scheme passes through intact.
    expect(chapter.canonicalUrl).toBe('lexiconforge://novel/chapter/64');
    const [summary] = await getAll(STORE_NAMES.CHAPTER_SUMMARIES);
    expect(summary.canonicalUrl).toBe('lexiconforge://novel/chapter/64');

    // Honest mappings re-emitted through THE canonical upsert.
    expect(ensureUrlMappingsMock).toHaveBeenCalledTimes(1);
  });

  it('is a flag-first no-op on the second run (no store scans, no writes)', async () => {
    await MaintenanceOps.repairMangledCanonicalKeys();
    ensureUrlMappingsMock.mockClear();
    const second = await MaintenanceOps.repairMangledCanonicalKeys();
    expect(second.skipped).toBe(true);
    expect(ensureUrlMappingsMock).not.toHaveBeenCalled();
  });

  it('repairs a mangled summary from a HEALTHY chapter, and deletes true orphans (codex P2)', async () => {
    // Chapter healthy, summary mangled — repaired from the chapter.
    await put(STORE_NAMES.CHAPTERS, { url: 'lf-library://n%3A%3Av1/ch2', stableId: 'sid-healthy', canonicalUrl: 'lexiconforge://n/chapter/2', title: 'T', content: 'C', dateAdded: '2026-07-01' });
    await put(STORE_NAMES.CHAPTER_SUMMARIES, { stableId: 'sid-healthy', canonicalUrl: 'null/chapter/2', title: 'T' });
    // Orphan: no chapter row at all — must be DELETED, not left as a
    // relative "chapter/9" path under a permanent flag.
    await put(STORE_NAMES.CHAPTER_SUMMARIES, { stableId: 'sid-orphan', canonicalUrl: 'null/chapter/9', title: 'O' });

    const report = await MaintenanceOps.repairMangledCanonicalKeys();
    expect(report.summariesRepaired).toBe(2);

    const summaries = await getAll(STORE_NAMES.CHAPTER_SUMMARIES);
    const healthy = summaries.find((s) => s.stableId === 'sid-healthy');
    expect(healthy.canonicalUrl).toBe('lexiconforge://n/chapter/2');
    expect(summaries.some((s) => s.stableId === 'sid-orphan')).toBe(false);
    expect(summaries.some((s) => String(s.canonicalUrl || '').startsWith('chapter/'))).toBe(false);
  });

  it('leaves healthy stores untouched', async () => {
    await put(STORE_NAMES.CHAPTERS, { url: 'https://example.com/ch1', stableId: 'ch1_ab_cd', canonicalUrl: 'https://example.com/ch1', title: 'T', content: 'C', dateAdded: '2026-07-01' });
    const report = await MaintenanceOps.repairMangledCanonicalKeys();
    expect(report.mappingsDeleted + report.chaptersRepaired + report.summariesRepaired).toBe(0);
  });
});
