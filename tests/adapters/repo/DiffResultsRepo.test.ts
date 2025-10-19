import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiffResultsRepo } from '../../../adapters/repo/DiffResultsRepo';
import type { DiffResult } from '../../../services/diff/types';
import * as idbModule from '../../../services/indexeddb';

describe('DiffResultsRepo', () => {
  let repo: DiffResultsRepo;
  let mockDb: any;

  const createMockRequest = (result?: any, shouldError: boolean = false) => {
    return {
      result,
      error: shouldError ? new Error('Mock error') : null,
      onsuccess: null as any,
      onerror: null as any,
    };
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    // Default mock implementations
    mockDb = {
      transaction: vi.fn(),
    };

    vi.spyOn(idbModule.indexedDBService, 'openDatabase').mockResolvedValue(mockDb);
    repo = new DiffResultsRepo();
  });

  it('should save diff result', async () => {
    const diffResult: DiffResult = {
      chapterId: 'ch-test',
      aiVersionId: '111',
      fanVersionId: '222',
      rawVersionId: 'aaa',
      algoVersion: '1.0.0',
      markers: [{ chunkId: 'para-0-test', colors: ['grey'], reasons: ['stylistic-choice'], aiRange: { start: 0, end: 10 }, position: 0 }],
      analyzedAt: Date.now(),
      costUsd: 0.001,
      model: 'gpt-4o-mini'
    };

    const mockRequest = createMockRequest();
    const mockStore = { put: vi.fn(() => mockRequest) };
    const mockTransaction = { objectStore: vi.fn(() => mockStore) };
    mockDb.transaction = vi.fn(() => mockTransaction);

    const savePromise = repo.save(diffResult);
    setImmediate(() => mockRequest.onsuccess());
    await savePromise;

    expect(mockStore.put).toHaveBeenCalledWith(expect.objectContaining({
      chapterId: diffResult.chapterId,
      fanVersionId: diffResult.fanVersionId,
      aiHash: null,
      fanHash: null,
      rawHash: diffResult.rawVersionId,
    }));
  });

  it('should retrieve diff result by composite key', async () => {
    const diffResult: DiffResult = {
      chapterId: 'ch-test',
      aiVersionId: '111',
      fanVersionId: '222',
      rawVersionId: 'aaa',
      algoVersion: '1.0.0',
      markers: [],
      analyzedAt: Date.now(),
      costUsd: 0.001,
      model: 'gpt-4o-mini'
    };

    const mockRequest = createMockRequest(diffResult);
    const mockStore = { get: vi.fn(() => mockRequest) };
    const mockTransaction = { objectStore: vi.fn(() => mockStore) };
    mockDb.transaction = vi.fn(() => mockTransaction);

    const getPromise = repo.get('ch-test', '111', '222', 'aaa', '1.0.0');
    setImmediate(() => mockRequest.onsuccess());
    const result = await getPromise;

    expect(mockStore.get).toHaveBeenCalledWith(['ch-test', '111', '222', 'aaa', '1.0.0']);
    expect(result).toMatchObject({
      chapterId: diffResult.chapterId,
      aiVersionId: diffResult.aiVersionId,
      fanVersionId: diffResult.fanVersionId,
      rawVersionId: diffResult.rawVersionId,
      aiHash: null,
      fanHash: null,
      rawHash: diffResult.rawVersionId,
    });
  });

  it('should return null for non-existent diff result', async () => {
    const mockRequest = createMockRequest(undefined);
    const mockStore = { get: vi.fn(() => mockRequest) };
    const mockTransaction = { objectStore: vi.fn(() => mockStore) };
    mockDb.transaction = vi.fn(() => mockTransaction);

    const getPromise = repo.get('nonexistent', '0', null, 'xyz', '1.0.0');
    setImmediate(() => mockRequest.onsuccess());
    const result = await getPromise;

    expect(result).toBeNull();
  });

  it('should handle null fanVersionId in get', async () => {
    const diffResult: DiffResult = {
      chapterId: 'ch-no-fan',
      aiVersionId: '999',
      fanVersionId: null,
      rawVersionId: 'bbb',
      algoVersion: '1.0.0',
      markers: [],
      analyzedAt: Date.now(),
      costUsd: 0.002,
      model: 'gpt-4o-mini'
    };

    const mockRequest = createMockRequest(diffResult);
    const mockStore = { get: vi.fn(() => mockRequest) };
    const mockTransaction = { objectStore: vi.fn(() => mockStore) };
    mockDb.transaction = vi.fn(() => mockTransaction);

    const getPromise = repo.get('ch-no-fan', '999', null, 'bbb', '1.0.0');
    setImmediate(() => mockRequest.onsuccess());
    const result = await getPromise;

    expect(mockStore.get).toHaveBeenCalledWith(['ch-no-fan', '999', '', 'bbb', '1.0.0']);
    expect(result).toMatchObject({
      chapterId: diffResult.chapterId,
      fanVersionId: null,
      aiHash: null,
      fanHash: null,
      rawHash: diffResult.rawVersionId,
    });
  });

  it('should get all diff results for a chapter sorted by analyzedAt desc', async () => {
    const diffResult1: DiffResult = {
      chapterId: 'ch-multi',
      aiVersionId: '100',
      fanVersionId: '200',
      rawVersionId: 'raw1',
      algoVersion: '1.0.0',
      markers: [],
      analyzedAt: 1000,
      costUsd: 0.001,
      model: 'gpt-4o-mini'
    };

    const diffResult2: DiffResult = {
      chapterId: 'ch-multi',
      aiVersionId: '101',
      fanVersionId: '201',
      rawVersionId: 'raw2',
      algoVersion: '1.0.0',
      markers: [],
      analyzedAt: 2000,
      costUsd: 0.001,
      model: 'gpt-4o-mini'
    };

    const mockRequest = createMockRequest([diffResult1, diffResult2]);
    const mockIndex = { getAll: vi.fn(() => mockRequest) };
    const mockStore = { index: vi.fn(() => mockIndex) };
    const mockTransaction = { objectStore: vi.fn(() => mockStore) };
    mockDb.transaction = vi.fn(() => mockTransaction);

    const getPromise = repo.getByChapter('ch-multi');
    setImmediate(() => mockRequest.onsuccess());
    const results = await getPromise;

    expect(mockStore.index).toHaveBeenCalledWith('by_chapter');
    expect(mockIndex.getAll).toHaveBeenCalledWith('ch-multi');
    expect(results).toHaveLength(2);
    // Should be sorted by analyzedAt descending
    expect(results[0].analyzedAt).toBe(2000);
    expect(results[1].analyzedAt).toBe(1000);
  });

  it('should delete a specific diff result', async () => {
    const mockRequest = createMockRequest();
    const mockStore = { delete: vi.fn(() => mockRequest) };
    const mockTransaction = { objectStore: vi.fn(() => mockStore) };
    mockDb.transaction = vi.fn(() => mockTransaction);

    const deletePromise = repo.delete('ch-delete', '300', '400', 'raw3', '1.0.0');
    setImmediate(() => mockRequest.onsuccess());
    await deletePromise;

    expect(mockStore.delete).toHaveBeenCalledWith(['ch-delete', '300', '400', 'raw3', '1.0.0']);
  });

  it('should delete all diff results for a chapter', async () => {
    const diffResult1: DiffResult = {
      chapterId: 'ch-delete-all',
      aiVersionId: '500',
      fanVersionId: '600',
      rawVersionId: 'raw4',
      algoVersion: '1.0.0',
      markers: [],
      analyzedAt: Date.now(),
      costUsd: 0.001,
      model: 'gpt-4o-mini'
    };

    const diffResult2: DiffResult = {
      chapterId: 'ch-delete-all',
      aiVersionId: '501',
      fanVersionId: '601',
      rawVersionId: 'raw5',
      algoVersion: '1.0.0',
      markers: [],
      analyzedAt: Date.now(),
      costUsd: 0.001,
      model: 'gpt-4o-mini'
    };

    // Mock getByChapter
    const mockGetRequest = createMockRequest([diffResult1, diffResult2]);
    const mockIndex = { getAll: vi.fn(() => mockGetRequest) };

    // Mock delete operations
    const mockDeleteRequest1 = createMockRequest();
    const mockDeleteRequest2 = createMockRequest();
    const deleteRequests = [mockDeleteRequest1, mockDeleteRequest2];
    let deleteCallCount = 0;

    const mockStore = {
      index: vi.fn(() => mockIndex),
      delete: vi.fn(() => deleteRequests[deleteCallCount++])
    };
    const mockTransaction = { objectStore: vi.fn(() => mockStore) };
    mockDb.transaction = vi.fn(() => mockTransaction);

    const deletePromise = repo.deleteByChapter('ch-delete-all');

    // Trigger callbacks
    setImmediate(() => {
      mockGetRequest.onsuccess();
      setTimeout(() => {
        mockDeleteRequest1.onsuccess();
        mockDeleteRequest2.onsuccess();
      }, 0);
    });

    await deletePromise;

    expect(mockStore.delete).toHaveBeenCalledTimes(2);
    expect(mockStore.delete).toHaveBeenCalledWith(['ch-delete-all', '500', '600', 'raw4', '1.0.0']);
    expect(mockStore.delete).toHaveBeenCalledWith(['ch-delete-all', '501', '601', 'raw5', '1.0.0']);
  });

  it('should handle deleteByChapter with empty results', async () => {
    const mockGetRequest = createMockRequest([]);
    const mockIndex = { getAll: vi.fn(() => mockGetRequest) };
    const mockStore = { index: vi.fn(() => mockIndex) };
    const mockTransaction = { objectStore: vi.fn(() => mockStore) };
    mockDb.transaction = vi.fn(() => mockTransaction);

    const deletePromise = repo.deleteByChapter('ch-empty');
    setImmediate(() => mockGetRequest.onsuccess());
    await deletePromise;

    // Should not attempt any deletes
    expect(mockStore.index).toHaveBeenCalledWith('by_chapter');
  });
});
