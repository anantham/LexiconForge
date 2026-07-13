/**
 * Transaction Management - Hybrid Approach
 * 
 * Centralized transaction handling to prevent heisenbugs across operations.
 * Provides consistent error handling and retry logic.
 */

import { getConnection } from './connection';
import { DbError, RetryPolicy } from './errors';
import {
  runTransaction,
  type StoreNames,
  type TransactionMode,
  type TransactionOperation,
} from './transactionKernel';

export { runTransaction } from './transactionKernel';
export type {
  StoreNames,
  TransactionMode,
  TransactionOperation,
} from './transactionKernel';

/**
 * Execute a function within a database transaction with proper error handling
 */
export async function withTxn<T>(
  storeNames: StoreNames,
  mode: TransactionMode,
  operation: TransactionOperation<T>,
  domain: string = 'unknown',
  service: string = 'unknown',
  operationName?: string
): Promise<T> {
  return RetryPolicy.execute(async () => {
    const db = await getConnection();
    return runTransaction(
      db,
      storeNames,
      mode,
      operation,
      domain,
      service,
      operationName
    );
  }, domain, service, operationName || 'transaction');
}

/**
 * Execute a read-only operation
 */
export async function withReadTxn<T>(
  storeNames: StoreNames,
  operation: TransactionOperation<T>,
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
  operation: TransactionOperation<T>,
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
