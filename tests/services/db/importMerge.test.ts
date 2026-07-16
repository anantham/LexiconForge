// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORE_NAMES } from '../../../services/db/core/schema';

/**
 * P0.3 (TECH-DEBT-FIX-PRIORITY-2026-07-07) — a backup you cannot reliably
 * restore is not a backup.
 *
 * The translations store carries UNIQUE indexes on [chapterUrl, version] and
 * [stableId, version]. Re-importing a session whose translation ids differ
 * from the stored rows (ids are regenerated whenever the export omits them)
 * raised ConstraintError, aborted the batch transaction, and stopped the
 * import HALFWAY: earlier batches were already committed, later ones never
 * ran, and nothing rolled back.
 *
 * These tests exercise ImportOps against a real (fake-indexeddb) database
 * carrying the REAL unique indexes, so the pre-fix code genuinely aborts.
 */

const getConnectionMock = vi.hoisted(() => vi.fn());
vi.mock('../../../services/db/core/connection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/db/core/connection')>();
  return { ...actual, getConnection: getConnectionMock };
});
vi.mock('../../../services/db/operations/maintenance', () => ({
  MaintenanceOps: { syncSummaries: vi.fn(async () => {}) },
}));

import { ImportOps } from '../../../services/db/operations/imports';

const DB_NAME = 'import-merge-test';

const openTestDb = async (): Promise<IDBDatabase> =>
  await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      const translations = db.createObjectStore(STORE_NAMES.TRANSLATIONS, { keyPath: 'id' });
      translations.createIndex('chapterUrl', 'chapterUrl', { unique: false });
      translations.createIndex('stableId', 'stableId', { unique: false });
      // The real uniqueness constraints — the whole point of this suite.
      translations.createIndex('chapterUrl_version', ['chapterUrl', 'version'], { unique: true });
      translations.createIndex('stableId_version', ['stableId', 'version'], { unique: true });

      const chapters = db.createObjectStore(STORE_NAMES.CHAPTERS, { keyPath: 'url' });
      chapters.createIndex('stableId', 'stableId', { unique: false });

      db.createObjectStore(STORE_NAMES.FEEDBACK, { keyPath: 'id' });
      db.createObjectStore(STORE_NAMES.SETTINGS, { keyPath: 'key' });
      db.createObjectStore(STORE_NAMES.PROMPT_TEMPLATES, { keyPath: 'id' });
      db.createObjectStore(STORE_NAMES.URL_MAPPINGS, { keyPath: 'url' });
      db.createObjectStore(STORE_NAMES.NOVELS, { keyPath: 'id' });
      db.createObjectStore(STORE_NAMES.CHAPTER_SUMMARIES, { keyPath: 'id' });
      db.createObjectStore(STORE_NAMES.AMENDMENT_LOGS, { keyPath: 'id' });
      db.createObjectStore(STORE_NAMES.DIFF_RESULTS, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const deleteDb = async () =>
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });

const readAllTranslations = async (db: IDBDatabase): Promise<any[]> =>
  await new Promise((resolve, reject) => {
    const req = db.transaction([STORE_NAMES.TRANSLATIONS], 'readonly')
      .objectStore(STORE_NAMES.TRANSLATIONS)
      .getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

const seedTranslation = async (db: IDBDatabase, record: Record<string, unknown>) =>
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAMES.TRANSLATIONS], 'readwrite');
    tx.objectStore(STORE_NAMES.TRANSLATIONS).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

const CHAPTER_URL = 'https://example.com/ch1';
const STABLE_ID = 'stable-ch1';

const payloadWith = (translations: Array<Record<string, unknown>>) => ({
  chapters: [
    {
      url: CHAPTER_URL,
      canonicalUrl: CHAPTER_URL,
      stableId: STABLE_ID,
      title: 'Chapter One',
      content: '<p>source</p>',
      chapterNumber: 1,
      translations,
    },
  ],
});

const exportedTranslation = (version: number, id: string, title: string) => ({
  id,
  version,
  translatedTitle: title,
  translation: `<p>v${version}</p>`,
  provider: 'OpenAI',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  systemPrompt: '',
  isActive: version === 2,
  usageMetrics: { totalTokens: 10, promptTokens: 5, completionTokens: 5, estimatedCost: 0.01, requestTime: 100 },
});

describe('ImportOps.importFullSessionData — version-slot merge (P0.3)', () => {
  let db: IDBDatabase;

  beforeEach(async () => {
    // deleteDatabase BLOCKS while a connection is open — close first or the
    // hook hangs.
    db?.close();
    await deleteDb();
    db = await openTestDb();
    getConnectionMock.mockResolvedValue(db);
  });

  afterEach(() => {
    db?.close();
  });

  it('re-importing a backup whose translation ids differ MERGES instead of aborting', async () => {
    // A row already occupies (chapterUrl, version 1) under a DIFFERENT id —
    // exactly what happens when the export omitted ids and the first import
    // generated fresh UUIDs.
    await seedTranslation(db, {
      id: 'stored-uuid-A',
      chapterUrl: CHAPTER_URL,
      stableId: STABLE_ID,
      version: 1,
      translatedTitle: 'Old title',
      translation: '<p>old</p>',
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    await ImportOps.importFullSessionData(
      payloadWith([exportedTranslation(1, 'incoming-uuid-B', 'New title')])
    );

    const rows = await readAllTranslations(db);
    // Pre-fix: ConstraintError → batch abort → import stops halfway.
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('stored-uuid-A'); // slot's id survives, indexes stay valid
    expect(rows[0].translatedTitle).toBe('New title'); // incoming content wins
    expect(rows[0].version).toBe(1);
  });

  it('imports every version of a multi-version chapter and preserves the exported active flag', async () => {
    await ImportOps.importFullSessionData(
      payloadWith([
        exportedTranslation(1, 'v1', 'First'),
        exportedTranslation(2, 'v2', 'Second'), // isActive: true
        exportedTranslation(3, 'v3', 'Third'),
      ])
    );

    const rows = (await readAllTranslations(db)).sort((a, b) => a.version - b.version);
    expect(rows.map((r) => r.version)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.translatedTitle)).toEqual(['First', 'Second', 'Third']);
    expect(rows.filter((r) => r.isActive).map((r) => r.version)).toEqual([2]);
  });

  it('a second import of the SAME payload is idempotent (no duplicate rows, no abort)', async () => {
    const payload = payloadWith([exportedTranslation(1, 'v1', 'First'), exportedTranslation(2, 'v2', 'Second')]);

    await ImportOps.importFullSessionData(payload);
    await ImportOps.importFullSessionData(payload);

    const rows = await readAllTranslations(db);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.version).sort()).toEqual([1, 2]);
  });
});
