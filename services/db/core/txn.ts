/**
 * Transaction Management - Hybrid Approach
 * 
 * Centralized transaction handling to prevent heisenbugs across operations.
 * Provides consistent error handling and retry logic.
 */

import { getConnection } from './connection';
import { DbError, mapDomError, RetryPolicy } from './errors';

export type TransactionMode = 'readonly' | 'readwrite';
export type StoreNames = string | string[];

/**
 * Execute a function within a database transaction with proper error handling
 */
export async function withTxn<T>(
  storeNames: StoreNames,
  mode: TransactionMode,
  operation: (transaction: IDBTransaction, stores: Record<string, IDBObjectStore>) => Promise<T>,
  domain: string = 'unknown',
  service: string = 'unknown',
  operationName?: string
): Promise<T> {
  return RetryPolicy.execute(async () => {
    const db = await getConnection();
    const storeArray = Array.isArray(storeNames) ? storeNames : [storeNames];
    
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeArray, mode);
      
      // Build stores object for easy access
      const stores: Record<string, IDBObjectStore> = {};
      for (const storeName of storeArray) {
        stores[storeName] = transaction.objectStore(storeName);
      }
      
      // Durability contract (P0.1, TECH-DEBT-FIX-PRIORITY-2026-07-07):
      // resolve ONLY from transaction.oncomplete. request.onsuccess fires when
      // a request is processed IN MEMORY; the transaction can still abort at
      // commit time (QuotaExceededError on a large record is the canonical
      // case). The old code resolved from the operation promise, so a write
      // that was then rolled back reported success — no error, no retry, the
      // record silently gone.
      let opResult: T;
      let opFinished = false;

      transaction.onerror = () => {
        const error = mapDomError(
          transaction.error,
          domain,
          service,
          operationName || 'transaction'
        );
        reject(error);
      };

      transaction.onabort = () => {
        // Classify from the real abort cause when there is one (Quota etc. —
        // correctly non-retryable); a bare abort stays Transient.
        const error = transaction.error
          ? mapDomError(transaction.error, domain, service, operationName || 'transaction')
          : new DbError('Transient', domain, service,
              `Transaction aborted in ${domain}${operationName ? `.${operationName}` : ''}`,
              transaction.error
            );
        reject(error);
      };

      transaction.oncomplete = () => {
        if (opFinished) {
          resolve(opResult);
        } else {
          // The transaction auto-committed while the operation was still
          // running — it awaited non-IndexedDB work mid-transaction (fetch,
          // setTimeout, …), which closes the transaction. Surfacing this
          // loudly beats resolving with a half-finished operation's state.
          reject(new DbError('Constraint', domain, service,
            `Transaction committed before the operation finished in ${domain}${operationName ? `.${operationName}` : ''} — the operation must not await non-IndexedDB work mid-transaction`
          ));
        }
      };

      // Execute the operation. Its resolution means "all requests issued and
      // succeeded in memory" — the commit (oncomplete) settles the promise.
      operation(transaction, stores)
        .then(result => {
          opResult = result;
          opFinished = true;
        })
        .catch(error => {
          // Convert any operation errors to DbError
          const dbError = error instanceof DbError
            ? error
            : mapDomError(error, domain, service, operationName);
          // A failed operation must not leave its earlier requests to commit
          // as a partial write (verified live: pre-fix, a put issued before a
          // throw was durably committed while the caller saw a rejection).
          try {
            transaction.abort();
          } catch {
            // already committing/aborted — nothing to roll back
          }
          reject(dbError);
        });
    });
  }, domain, service, operationName || 'transaction');
}

/**
 * Execute a read-only operation
 */
export async function withReadTxn<T>(
  storeNames: StoreNames,
  operation: (transaction: IDBTransaction, stores: Record<string, IDBObjectStore>) => Promise<T>,
  domain: string = 'unknown',
  service: string = 'unknown',
  operationName?: string
): Promise<T> {
  return withTxn(storeNames, 'readonly', operation, domain, service, operationName);
}

/**
 * Execute a read-write operation
 */
export async function withWriteTxn<T>(
  storeNames: StoreNames,
  operation: (transaction: IDBTransaction, stores: Record<string, IDBObjectStore>) => Promise<T>,
  domain: string = 'unknown',
  service: string = 'unknown',
  operationName?: string
): Promise<T> {
  return withTxn(storeNames, 'readwrite', operation, domain, service, operationName);
}

/**
 * Helper to promisify IDBRequest operations
 */
export function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Helper to promisify cursor operations
 */
export function promisifyCursor<T>(
  request: IDBRequest<IDBCursorWithValue | null>,
  processor: (cursor: IDBCursorWithValue) => T | Promise<T>
): Promise<T[]> {
  return new Promise<T[]>((resolve, reject) => {
    const results: T[] = [];
    
    request.onsuccess = async () => {
      const cursor = request.result;
      if (cursor) {
        try {
          const result = await processor(cursor);
          results.push(result);
          cursor.continue();
        } catch (error) {
          reject(error);
        }
      } else {
        // No more entries
        resolve(results);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Batch operation helper for bulk inserts/updates
 */
export async function batchOperation<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  batchSize: number = 100,
  domain: string = 'unknown'
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPromises = batch.map(operation);
    
    try {
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    } catch (error) {
      throw new DbError('Transient', domain, 'batch', 
        `Batch operation failed at items ${i}-${i + batch.length - 1}`, error);
    }
  }
  
  return results;
}

/**
 * Transaction debugging helper
 */
export function debugTransaction(
  transaction: IDBTransaction,
  operationName: string
): void {
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev) return;
  
  const startTime = performance.now();
  
  transaction.addEventListener('complete', () => {
    const duration = performance.now() - startTime;
    console.log(`[DB] Transaction ${operationName} completed in ${duration.toFixed(2)}ms`);
  });
  
  transaction.addEventListener('abort', () => {
    const duration = performance.now() - startTime;
    console.warn(`[DB] Transaction ${operationName} aborted after ${duration.toFixed(2)}ms`);
  });
}