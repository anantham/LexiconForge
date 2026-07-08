import { beforeEach, describe, expect, it, vi } from 'vitest';

const getConnectionMock = vi.hoisted(() => vi.fn());

vi.mock('../../../services/db/core/connection', () => ({
  getConnection: getConnectionMock,
}));

import { withWriteTxn } from '../../../services/db/core/txn';

const flushAsync = () => new Promise(resolve => setTimeout(resolve, 0));

const makeControlledDb = () => {
  const store = {};
  const transaction = {
    error: null as unknown,
    objectStore: vi.fn(() => store),
    oncomplete: null as null | (() => void),
    onerror: null as null | (() => void),
    onabort: null as null | (() => void),
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

    transaction.oncomplete?.();

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
    transaction.onabort?.();

    await expect(promise).rejects.toMatchObject({
      name: 'DbError',
      kind: 'Quota',
    });
    expect(getConnectionMock).toHaveBeenCalledTimes(1);
  });
});
