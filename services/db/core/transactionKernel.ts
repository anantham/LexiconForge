import { DbError, mapDomError } from './errors';

export type TransactionMode = 'readonly' | 'readwrite';
export type StoreNames = string | string[];
export type TransactionOperation<T> = (
  transaction: IDBTransaction,
  stores: Record<string, IDBObjectStore>
) => Promise<T> | T;

const transactionLabel = (domain: string, operationName?: string) =>
  `${domain}${operationName ? `.${operationName}` : ''}`;

/**
 * Run one transaction against an explicit database connection.
 *
 * Request success is only an operation-level signal. The returned promise does
 * not resolve until the operation has produced its result and IndexedDB emits
 * the terminal `complete` event for the enclosing transaction.
 */
export function runTransaction<T>(
  db: IDBDatabase,
  storeNames: StoreNames,
  mode: TransactionMode,
  operation: TransactionOperation<T>,
  domain: string = 'unknown',
  service: string = 'unknown',
  operationName?: string
): Promise<T> {
  const storeArray = Array.isArray(storeNames) ? storeNames : [storeNames];
  const mappedOperationName = operationName || 'transaction';

  return new Promise<T>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction(storeArray, mode);
    } catch (error) {
      reject(mapDomError(error, domain, service, mappedOperationName));
      return;
    }

    let terminalState: 'pending' | 'complete' | 'abort' = 'pending';
    let operationState: 'pending' | 'fulfilled' | 'rejected' = 'pending';
    let operationResult: T | undefined;
    let operationError: DbError | undefined;
    let transactionError: DbError | undefined;
    let promiseSettled = false;

    const resolveOnce = (result: T) => {
      if (promiseSettled) return;
      promiseSettled = true;
      if (backstopTimer) clearTimeout(backstopTimer);
      resolve(result);
    };

    const rejectOnce = (error: DbError) => {
      if (promiseSettled) return;
      promiseSettled = true;
      if (backstopTimer) clearTimeout(backstopTimer);
      reject(error);
    };

    const abortError = () =>
      transactionError ||
      (transaction.error
        ? mapDomError(transaction.error, domain, service, mappedOperationName)
        : new DbError(
            'Transient',
            domain,
            service,
            `Transaction aborted in ${transactionLabel(domain, operationName)}`,
            transaction.error
          ));

    // Review fixes (grok second-family pass, 2026-07-16):
    //  F2 A COMMITTED transaction whose operation callback then fails must
    //     reject NON-RETRYABLY — RetryPolicy retrying it would re-apply
    //     writes that already committed.
    //  F1 The abort()-threw path must not settle directly; the terminal event
    //     is guaranteed (throwing means the transaction is already finishing)
    //     and settling early lets a retry overlap a finishing transaction.
    //  F3 An abort that races a still-pending operation defers settlement so
    //     the richer operation error (which decides retryability) can win.
    //  F4 ...bounded by a backstop: if the operation promise never settles
    //     after the transaction is terminal, force settlement rather than
    //     hang forever.
    const committedButFailed = (cause: DbError) =>
      new DbError(
        'Constraint',
        domain,
        service,
        `Transaction ${transactionLabel(domain, operationName)} COMMITTED but the operation callback failed afterwards; not retryable (a retry would re-apply committed writes). Original: ${cause.message}`,
        cause
      );

    let backstopTimer: ReturnType<typeof setTimeout> | undefined;
    const BACKSTOP_MS = 5000;

    const settleFromState = (force = false) => {
      if (promiseSettled) return;

      if (terminalState === 'abort') {
        // F3: the operation promise is still in flight — its error carries
        // the retryability decision, so wait for it (bounded by the backstop).
        if (operationState === 'pending' && !force) return;
        rejectOnce(operationError || abortError());
        return;
      }

      if (terminalState !== 'complete') return;

      if (operationState === 'rejected') {
        rejectOnce(committedButFailed(operationError!)); // F2
      } else if (operationState === 'fulfilled') {
        resolveOnce(operationResult as T);
      } else if (force) {
        // F4: committed, but the operation promise never settled.
        rejectOnce(
          new DbError(
            'Constraint',
            domain,
            service,
            `Transaction ${transactionLabel(domain, operationName)} committed but the operation callback never settled; not retryable.`
          )
        );
      }
    };

    const armBackstop = () => {
      if (backstopTimer || promiseSettled || operationState !== 'pending') return;
      backstopTimer = setTimeout(() => settleFromState(true), BACKSTOP_MS);
    };

    const failOperation = (error: unknown) => {
      if (operationState !== 'pending') return;
      operationState = 'rejected';
      operationError =
        error instanceof DbError
          ? error
          : mapDomError(error, domain, service, mappedOperationName);

      if (terminalState === 'pending') {
        try {
          transaction.abort();
        } catch {
          // F1: abort() throwing means the transaction went inactive between
          // the operation rejection and the abort call — it is already
          // committing or aborting, and its terminal event WILL fire. Do not
          // settle here; the terminal handler settles with the operation
          // error given precedence (abort path) or wrapped non-retryably
          // (complete path).
        }
      }

      settleFromState();
    };

    transaction.addEventListener('error', () => {
      // `error` precedes the terminal `abort` event. Capture context here, but
      // do not settle early or a retry can overlap a transaction still aborting.
      if (transaction.error) {
        transactionError = mapDomError(
          transaction.error,
          domain,
          service,
          mappedOperationName
        );
      }
    });

    transaction.addEventListener('abort', () => {
      terminalState = 'abort';
      settleFromState();
      armBackstop(); // F4: bound the wait for a still-pending operation
    });

    transaction.addEventListener('complete', () => {
      terminalState = 'complete';
      settleFromState();
      armBackstop(); // F4
    });

    const stores: Record<string, IDBObjectStore> = {};
    try {
      for (const storeName of storeArray) {
        stores[storeName] = transaction.objectStore(storeName);
      }

      Promise.resolve(operation(transaction, stores)).then(
        result => {
          if (operationState !== 'pending') return;
          operationResult = result;
          operationState = 'fulfilled';
          settleFromState();
        },
        failOperation
      );
    } catch (error) {
      failOperation(error);
    }
  });
}
