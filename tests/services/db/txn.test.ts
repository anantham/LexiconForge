import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DbError } from '../../../services/db/core/errors';

const getConnectionMock = vi.hoisted(() => vi.fn());

vi.mock('../../../services/db/core/connection', () => ({
  getConnection: getConnectionMock,
}));

import { runTransaction, withWriteTxn } from '../../../services/db/core/txn';

const flushAsync = () => new Promise(resolve => setTimeout(resolve, 0));

const makeControlledDb = () => {
  const store = {};
  const listeners: Record<'complete' | 'error' | 'abort', Array<() => void>> = {
    complete: [],
    error: [],
    abort: [],
  };
  const transaction = {
    error: null as unknown,
    abort: vi.fn(),
    objectStore: vi.fn(() => store),
    addEventListener: vi.fn((event: 'complete' | 'error' | 'abort', listener: () => void) => {
      listeners[event].push(listener);
    }),
    emit: (event: 'complete' | 'error' | 'abort') => {
      listeners[event].forEach(listener => listener());
    },
  };
  const db = {
    transaction: vi.fn(() => transaction),
  };
  getConnectionMock.mockResolvedValue(db);
  return { db, store, transaction };
};

describe('withTxn durability contract', () => {
  beforeEach(() => {
    getConnectionMock.mockReset();
  });

  it('waits for transaction.oncomplete before resolving the operation result', async () => {
    const { store, transaction } = makeControlledDb();

    let resolved = false;
    const promise = withWriteTxn(
      'translations',
      async (_tx, stores) => {
        expect(stores.translations).toBe(store);
        return 'operation-result';
      },
      'translations',
      'txn-test',
      'store'
    );
    void promise.then(() => {
      resolved = true;
    });

    await flushAsync();
    expect(resolved).toBe(false);

    transaction.emit('complete');

    await expect(promise).resolves.toBe('operation-result');
    expect(resolved).toBe(true);
  });

  it('rejects commit-time aborts after the operation has already succeeded', async () => {
    const { transaction } = makeControlledDb();

    const promise = withWriteTxn(
      'translations',
      async () => 'operation-result',
      'translations',
      'txn-test',
      'store'
    );

    await flushAsync();
    transaction.error = new DOMException('quota full', 'QuotaExceededError');
    transaction.emit('abort');

    await expect(promise).rejects.toMatchObject({
      name: 'DbError',
      kind: 'Quota',
    });
    expect(getConnectionMock).toHaveBeenCalledTimes(1);
  });

  it('waits for the operation result when the transaction completes first', async () => {
    const { db, transaction } = makeControlledDb();
    let releaseOperation!: (value: string) => void;
    const operationResult = new Promise<string>(resolve => {
      releaseOperation = resolve;
    });
    let settled = false;

    const promise = runTransaction(
      db as unknown as IDBDatabase,
      'translations',
      'readwrite',
      () => operationResult,
      'translations',
      'txn-test',
      'store'
    );
    void promise.then(
      () => { settled = true; },
      () => { settled = true; }
    );

    transaction.emit('complete');
    await flushAsync();
    expect(settled).toBe(false);

    releaseOperation('late-result');
    await expect(promise).resolves.toBe('late-result');
  });

  it('does not settle on transaction.onerror before the terminal abort event', async () => {
    const { db, transaction } = makeControlledDb();
    let settled = false;
    const promise = runTransaction(
      db as unknown as IDBDatabase,
      'translations',
      'readwrite',
      () => 'operation-result',
      'translations',
      'txn-test',
      'store'
    );
    void promise.then(
      () => { settled = true; },
      () => { settled = true; }
    );

    await flushAsync();
    transaction.error = new DOMException('quota full', 'QuotaExceededError');
    transaction.emit('error');
    await flushAsync();
    expect(settled).toBe(false);

    transaction.emit('abort');
    await expect(promise).rejects.toMatchObject({ kind: 'Quota' });
  });

  it('aborts scheduled writes and preserves a typed operation error', async () => {
    const { db, transaction } = makeControlledDb();
    const operationError = new DbError(
      'Constraint',
      'translations',
      'txn-test',
      'duplicate version'
    );

    const promise = runTransaction(
      db as unknown as IDBDatabase,
      'translations',
      'readwrite',
      async () => {
        throw operationError;
      },
      'translations',
      'txn-test',
      'store'
    );

    await flushAsync();
    expect(transaction.abort).toHaveBeenCalledTimes(1);

    transaction.emit('abort');
    await expect(promise).rejects.toBe(operationError);

    transaction.emit('complete');
    expect(transaction.abort).toHaveBeenCalledTimes(1);
  });
});
