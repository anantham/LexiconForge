// tests/db/diffResults.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { DiffResult } from '../../services/diff/types';

const DB_NAME = 'test-diff-results';
const DB_VERSION = 1;

describe('DiffResults IndexedDB store', () => {
  let db: IDBDatabase;

  beforeEach(async () => {
    // Open test database with diffResults store
    db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('diffResults')) {
          const store = db.createObjectStore('diffResults', {
            keyPath: ['chapterId', 'aiVersionId', 'fanVersionId', 'rawVersionId', 'algoVersion']
          });
          store.createIndex('by_chapter', 'chapterId');
          store.createIndex('by_analyzed_at', 'analyzedAt');
        }
      };
    });
  });

  afterEach(async () => {
    db.close();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });

  it('should store and retrieve diff results by composite key', async () => {
    const diffResult: DiffResult = {
      chapterId: 'ch-001',
      aiVersionId: '1234567890',
      fanVersionId: '0987654321',
      rawVersionId: 'abc12345',
      rawHash: 'abc12345',
      algoVersion: '1.0.0',
      markers: [],
      analyzedAt: Date.now(),
      costUsd: 0.0011,
      model: 'gpt-4o-mini'
    };

    // Store the diff result
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(['diffResults'], 'readwrite');
      const store = transaction.objectStore('diffResults');
      const request = store.put(diffResult);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Retrieve the diff result
    const retrieved = await new Promise<DiffResult | undefined>((resolve, reject) => {
      const transaction = db.transaction(['diffResults'], 'readonly');
      const store = transaction.objectStore('diffResults');
      const request = store.get([
        'ch-001', '1234567890', '0987654321', 'abc12345', '1.0.0'
      ]);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    expect(retrieved).toMatchObject(diffResult);
    expect(retrieved?.aiHash ?? null).toBeNull();
    expect(retrieved?.rawHash).toBe(diffResult.rawVersionId);
  });

  it('should store and retrieve diff results with null fanVersionId', async () => {
    const diffResult: DiffResult = {
      chapterId: 'ch-002',
      aiVersionId: '1111111111',
      fanVersionId: null,
      rawVersionId: 'xyz98765',
      rawHash: 'xyz98765',
      algoVersion: '1.0.0',
      markers: [{
        chunkId: 'para-0-test',
        colors: ['orange'],
        reasons: ['raw-divergence'],
        aiRange: { start: 0, end: 20 },
        position: 0
      }],
      analyzedAt: Date.now(),
      costUsd: 0.0015,
      model: 'gpt-4o-mini'
    };

    // Store the diff result (convert null to empty string for composite key)
    const diffResultForStorage = {
      ...diffResult,
      fanVersionId: diffResult.fanVersionId ?? ''
    };

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(['diffResults'], 'readwrite');
      const store = transaction.objectStore('diffResults');
      const request = store.put(diffResultForStorage);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Retrieve the diff result (use empty string in key for null fanVersionId)
    const retrieved = await new Promise<DiffResult | undefined>((resolve, reject) => {
      const transaction = db.transaction(['diffResults'], 'readonly');
      const store = transaction.objectStore('diffResults');
      const request = store.get([
        'ch-002', '1111111111', '', 'xyz98765', '1.0.0'
      ]);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Convert empty string back to null for comparison
    const retrievedWithNull = retrieved ? {
      ...retrieved,
      fanVersionId: retrieved.fanVersionId === '' ? null : retrieved.fanVersionId
    } : undefined;

    expect(retrievedWithNull).toMatchObject(diffResult);
  });

  it('should query diff results by chapter using by_chapter index', async () => {
    const diffResult1: DiffResult = {
      chapterId: 'ch-003',
      aiVersionId: '1000',
      fanVersionId: null,
      rawVersionId: 'raw1',
      algoVersion: '1.0.0',
      aiHash: 'hash-ai-1',
      rawHash: 'hash-raw-1',
      markers: [],
      analyzedAt: Date.now(),
      costUsd: 0.001,
      model: 'gpt-4o-mini'
    };

    const diffResult2: DiffResult = {
      chapterId: 'ch-003',
      aiVersionId: '2000',
      fanVersionId: null,
      rawVersionId: 'raw2',
      algoVersion: '1.0.0',
      aiHash: 'hash-ai-2',
      rawHash: 'hash-raw-2',
      markers: [],
      analyzedAt: Date.now() + 1000,
      costUsd: 0.002,
      model: 'gpt-4o-mini'
    };

    // Store both diff results (convert null to empty string for composite key)
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(['diffResults'], 'readwrite');
      const store = transaction.objectStore('diffResults');

      const storage1 = { ...diffResult1, fanVersionId: diffResult1.fanVersionId ?? '' };
      const storage2 = { ...diffResult2, fanVersionId: diffResult2.fanVersionId ?? '' };

      store.put(storage1);
      const request = store.put(storage2);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Query by chapter
    const results = await new Promise<DiffResult[]>((resolve, reject) => {
      const transaction = db.transaction(['diffResults'], 'readonly');
      const store = transaction.objectStore('diffResults');
      const index = store.index('by_chapter');
      const request = index.getAll('ch-003');

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    expect(results).toHaveLength(2);
    expect(results[0].chapterId).toBe('ch-003');
    expect(results[1].chapterId).toBe('ch-003');
  });

  it('should support hash-based lookup fallback via repository helper', async () => {
    const { DiffResultsRepo } = await import('../../adapters/repo/DiffResultsRepo');
    const repo = new DiffResultsRepo();

    const diffResult: DiffResult = {
      chapterId: 'ch-004',
      aiVersionId: '3000',
      fanVersionId: null,
      rawVersionId: 'raw-hash',
      algoVersion: '1.0.0',
      aiHash: 'ai-hash',
      rawHash: 'raw-hash',
      markers: [],
      analyzedAt: Date.now(),
      costUsd: 0.003,
      model: 'gpt-4o-mini'
    };

    // Monkey patch getByChapter to avoid touching IndexedDB
    (repo as any).getByChapter = vi.fn(async () => [diffResult]);

    const hit = await repo.findByHashes('ch-004', 'ai-hash', null, 'raw-hash', '1.0.0');
    expect(hit).not.toBeNull();
    expect(hit?.chapterId).toBe('ch-004');
  });
});
