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

describe('review fixes: commit/abort races (grok second-family findings, 2026-07-16)', () => {
  beforeEach(() => {
    getConnectionMock.mockReset();
  });

  it('F2: an operation that fails AFTER commit rejects non-retryably (no retry of committed writes)', async () => {
    const { transaction } = makeControlledDb();
    let rejectOp!: (e: unknown) => void;
    const promise = withWriteTxn(
      'translations',
      () => new Promise((_res, rej) => { rejectOp = rej; }),
      'translations',
      'txn-test',
      'store'
    );

    await flushAsync();
    transaction.emit('complete'); // IndexedDB auto-commits; callback still pending
    await flushAsync();
    rejectOp(new DOMException('late failure', 'UnknownError')); // would map retryable

    await expect(promise).rejects.toMatchObject({ name: 'DbError', kind: 'Constraint' });
    await expect(promise).rejects.toMatchObject({ message: expect.stringContaining('COMMITTED') });
    expect(getConnectionMock).toHaveBeenCalledTimes(1); // RetryPolicy must NOT retry
  });

  it('F1: abort() throwing (transaction went inactive) defers settlement to the terminal event', async () => {
    const { transaction } = makeControlledDb();
    transaction.abort.mockImplementation(() => {
      throw new DOMException('inactive', 'InvalidStateError');
    });
    let settled = false;
    const promise = withWriteTxn(
      'translations',
      async () => {
        throw new DOMException('op failed', 'UnknownError');
      },
      'translations',
      'txn-test',
      'store'
    );
    promise.catch(() => { settled = true; });

    await flushAsync();
    expect(settled).toBe(false); // must NOT settle while the txn is still finishing

    transaction.emit('complete'); // the inactive txn was actually committing
    await expect(promise).rejects.toMatchObject({ kind: 'Constraint' });
    expect(getConnectionMock).toHaveBeenCalledTimes(1);
  });

  it('F3: an abort racing a pending operation lets the richer operation error win', async () => {
    const { transaction } = makeControlledDb();
    let rejectOp!: (e: unknown) => void;
    let settled = false;
    const promise = withWriteTxn(
      'translations',
      () => new Promise((_res, rej) => { rejectOp = rej; }),
      'translations',
      'txn-test',
      'store'
    );
    promise.catch(() => { settled = true; });

    await flushAsync();
    transaction.emit('abort'); // terminal abort while the operation is still pending
    await flushAsync();
    expect(settled).toBe(false); // deferred, waiting for the operation's own error

    rejectOp(new DbError('Permission', 'translations', 'txn-test', 'access denied'));
    // old behaviour: generic Transient abort error → 3 retries; now: Permission, once
    await expect(promise).rejects.toMatchObject({ kind: 'Permission' });
    expect(getConnectionMock).toHaveBeenCalledTimes(1);
  });

  it('F4: a never-settling operation after commit is force-settled by the backstop', async () => {
    vi.useFakeTimers();
    try {
      const { transaction } = makeControlledDb();
      const promise = withWriteTxn(
        'translations',
        () => new Promise(() => {}), // never settles
        'translations',
        'txn-test',
        'store'
      );
      const outcome = promise.catch((e: DbError) => e);

      await vi.advanceTimersByTimeAsync(0);
      transaction.emit('complete');
      await vi.advanceTimersByTimeAsync(5001);

      const err = (await outcome) as DbError;
      expect(err.kind).toBe('Constraint');
      expect(err.message).toContain('never settled');
    } finally {
      vi.useRealTimers();
    }
  });
});
