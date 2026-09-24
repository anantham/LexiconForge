/**
 * Transaction Management - Hybrid Approach
 * 
 * Centralized transaction handling to prevent heisenbugs across operations.
 * Provides consistent error handling and retry logic.
 */

import { getConnection } from './connection';
import { RetryPolicy } from './errors';
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
