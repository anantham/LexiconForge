import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { DiffResult } from '../../services/diff/types';
import { DiffOps } from '../../services/db/operations/diffResults';
import * as connectionModule from '../../services/db/core/connection';

const DB_NAME = 'diff-results-ops-test';
const DB_VERSION = 1;

const openTestDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('diffResults')) {
        const store = db.createObjectStore('diffResults', {
          keyPath: ['chapterId', 'aiVersionId', 'fanVersionId', 'rawVersionId', 'algoVersion'],
        });
        store.createIndex('by_chapter', 'chapterId');
        store.createIndex('by_analyzed_at', 'analyzedAt');
      }
    };
  });
};

const closeAndDeleteDatabase = async (db: IDBDatabase) => {
  db.close();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const buildDiffResult = (overrides: Partial<DiffResult> = {}): DiffResult => ({
  chapterId: 'chapter-1',
  aiVersionId: 'ai-v1',
  fanVersionId: null,
  rawVersionId: 'raw-v1',
  rawHash: 'raw-hash',
  algoVersion: '1.0.0',
  markers: [],
  analyzedAt: Date.now(),
  costUsd: 0.001,
  model: 'gpt-4o-mini',
  ...overrides,
});

describe('DiffOps', () => {
  let db: IDBDatabase;
  let getConnectionSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    db = await openTestDatabase();
    getConnectionSpy = vi
      .spyOn(connectionModule, 'getConnection')
      .mockImplementation(async () => db);
  });

  afterEach(async () => {
    getConnectionSpy.mockRestore();
    await closeAndDeleteDatabase(db);
  });

  it('saves and retrieves a diff result by composite key', async () => {
    const diffResult = buildDiffResult({
      chapterId: 'ch-001',
      aiVersionId: 'ai-1',
      rawVersionId: 'raw-1',
    });

    await DiffOps.save(diffResult);

    const retrieved = await DiffOps.get({
      chapterId: 'ch-001',
      aiVersionId: 'ai-1',
      fanVersionId: null,
      rawVersionId: 'raw-1',
      algoVersion: '1.0.0',
    });

    expect(retrieved).toMatchObject({
      chapterId: 'ch-001',
      aiVersionId: 'ai-1',
      fanVersionId: null,
      rawVersionId: 'raw-1',
    });
  });

  it('normalizes null fanVersionId for storage and retrieval', async () => {
    const diffResult = buildDiffResult({
      chapterId: 'ch-null-fan',
      fanVersionId: null,
      rawVersionId: 'raw-null',
    });

    await DiffOps.save(diffResult);

    const retrieved = await DiffOps.get({
      chapterId: 'ch-null-fan',
      aiVersionId: diffResult.aiVersionId,
      fanVersionId: null,
      rawVersionId: 'raw-null',
      algoVersion: diffResult.algoVersion,
    });

    expect(retrieved?.fanVersionId).toBeNull();
  });

  it('returns diff results ordered by analyzedAt in getByChapter', async () => {
    const older = buildDiffResult({
      chapterId: 'ch-ordered',
      aiVersionId: 'ai-old',
      analyzedAt: Date.now(),
    });
    const newer = buildDiffResult({
      chapterId: 'ch-ordered',
      aiVersionId: 'ai-new',
      analyzedAt: Date.now() + 1000,
    });

    await DiffOps.save(older);
    await DiffOps.save(newer);

    const results = await DiffOps.getByChapter('ch-ordered');
    expect(results).toHaveLength(2);
    expect(results[0].aiVersionId).toBe('ai-new');
    expect(results[1].aiVersionId).toBe('ai-old');
  });

  it('finds a diff result via hash fallback', async () => {
    const target = buildDiffResult({
      chapterId: 'ch-hash',
      aiHash: 'ai-hash',
      rawHash: 'raw-hash',
      fanHash: null,
    });
    await DiffOps.save(target);

    const match = await DiffOps.findByHashes(
      'ch-hash',
      'ai-hash',
      null,
      'raw-hash',
      '1.0.0'
    );

    expect(match).not.toBeNull();
    expect(match?.chapterId).toBe('ch-hash');
  });
});
