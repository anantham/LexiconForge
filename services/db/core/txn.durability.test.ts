// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { withTxn, promisifyRequest } from './txn';
import { TranslationRepository } from '../repositories/TranslationRepository';

/**
 * P0.1 durability contract (TECH-DEBT-FIX-PRIORITY-2026-07-07): a write's
 * promise must settle from the TRANSACTION's lifecycle, not the request's.
 *
 * IndexedDB fires request.onsuccess when a request is processed IN MEMORY;
 * the transaction can still abort at commit time (QuotaExceededError on a
 * large chapter being the canonical case). Code that resolves on
 * request.onsuccess reports success for writes that are then rolled back:
 * the store shows success, the retry policy never fires, the record is gone,
 * and the user cannot tell it happened.
 *
 * These tests demonstrate the failure with a real (fake-indexeddb)
 * transaction that aborts AFTER its put request succeeded.
 */

const getConnectionMock = vi.hoisted(() => vi.fn());
vi.mock('./connection', () => ({ getConnection: getConnectionMock }));

const STORE = 'translations';

const openTestDb = async (): Promise<IDBDatabase> => {
  const factory = new IDBFactory();
  return await new Promise((resolve, reject) => {
    const req = factory.open('txn-durability-test', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

const readAll = async (db: IDBDatabase): Promise<unknown[]> => {
  const tx = db.transaction([STORE], 'readonly');
  return await promisifyRequest(tx.objectStore(STORE).getAll());
};

describe('withTxn durability', () => {
  let db: IDBDatabase;

  beforeEach(async () => {
    db = await openTestDb();
    getConnectionMock.mockResolvedValue(db);
  });

  it('REJECTS when the transaction aborts after the put request already succeeded', async () => {
    const result = withTxn(
      STORE,
      'readwrite',
      async (transaction, stores) => {
        await promisifyRequest(stores[STORE].put({ id: 'ch-1', content: 'a translation' }));
        // The request SUCCEEDED in memory. Now the commit fails — the
        // deterministic stand-in for a commit-time QuotaExceededError.
        transaction.abort();
        return 'wrote-ok';
      },
      'test',
      'test',
      'abortAfterSuccess'
    );

    await expect(result).rejects.toThrow();
    expect(await readAll(db)).toEqual([]); // the write was rolled back — success would have been a lie
  }, 15000);

  it('resolves with the operation result once the transaction commits', async () => {
    const result = await withTxn(
      STORE,
      'readwrite',
      async (_tx, stores) => {
        await promisifyRequest(stores[STORE].put({ id: 'ch-2', content: 'persisted' }));
        return 'committed';
      },
      'test',
      'test',
      'happyPath'
    );

    expect(result).toBe('committed');
    expect(await readAll(db)).toHaveLength(1);
  });

  it('rejects and rolls back when the operation itself throws', async () => {
    const result = withTxn(
      STORE,
      'readwrite',
      async (_tx, stores) => {
        await promisifyRequest(stores[STORE].put({ id: 'ch-3', content: 'doomed' }));
        throw new Error('operation exploded');
      },
      'test',
      'test',
      'operationThrows'
    );

    await expect(result).rejects.toThrow();
    expect(await readAll(db)).toEqual([]);
  }, 15000);
});

describe('TranslationRepository write durability', () => {
  let db: IDBDatabase;
  let committed: boolean;
  let repo: TranslationRepository;

  beforeEach(async () => {
    db = await openTestDb();
    committed = false;
    // deps.getDb hands back a wrapper whose transactions flag their own
    // commit — so we can assert the method's promise settles AFTER commit,
    // not merely after request.onsuccess.
    const wrapped = {
      transaction: (names: string | string[], mode?: IDBTransactionMode) => {
        const tx = db.transaction(names as string[], mode);
        tx.addEventListener('complete', () => {
          committed = true;
        });
        return tx;
      },
    } as unknown as IDBDatabase;
    repo = new TranslationRepository({
      getDb: async () => wrapped,
      getChapter: async () => null,
      stores: { TRANSLATIONS: STORE, CHAPTERS: 'chapters', URL_MAPPINGS: 'urls' },
    });
  });

  it('writeTranslation resolves only after the transaction has committed', async () => {
    await (repo as unknown as { writeTranslation: (r: unknown) => Promise<void> }).writeTranslation({
      id: 't-1',
      chapterUrl: 'u',
      isActive: true,
    });

    expect(committed).toBe(true);
    expect(await readAll(db)).toHaveLength(1);
  });

  it('deactivateTranslations resolves only after the transaction has committed', async () => {
    // seed two active records
    await (repo as unknown as { writeTranslation: (r: unknown) => Promise<void> }).writeTranslation({
      id: 't-1',
      isActive: true,
    });
    committed = false;

    await (repo as unknown as { deactivateTranslations: (r: unknown[]) => Promise<void> }).deactivateTranslations([
      { id: 't-1', isActive: true },
    ]);

    expect(committed).toBe(true);
    const rows = (await readAll(db)) as Array<{ isActive: boolean }>;
    expect(rows.every((r) => r.isActive === false)).toBe(true);
  });
});
