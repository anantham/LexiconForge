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
      resolve(result);
    };

    const rejectOnce = (error: DbError) => {
      if (promiseSettled) return;
      promiseSettled = true;
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

    const settleFromState = () => {
      if (promiseSettled) return;

      if (terminalState === 'abort') {
        rejectOnce(operationError || abortError());
        return;
      }

      if (terminalState !== 'complete') return;

      if (operationState === 'rejected') {
        rejectOnce(operationError!);
      } else if (operationState === 'fulfilled') {
        resolveOnce(operationResult as T);
      }
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
          // The transaction may have become inactive between the operation
          // rejection and abort(). The operation error is still authoritative.
          rejectOnce(operationError);
          return;
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
    });

    transaction.addEventListener('complete', () => {
      terminalState = 'complete';
      settleFromState();
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
