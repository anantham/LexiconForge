// tests/utils/db-harness.ts
import { getConnection } from '@/services/db/core/connection';

/**
 * Helper to get a direct handle to the database for test assertions.
 * This bypasses the service's singleton logic to get a fresh connection for setup/teardown.
 */
export async function getTestDB() {
  return await getConnection();
}

/**
 * Helper to introspect the database schema.
 */
export async function getDBSchema() {
  const db = await getTestDB()
  const schema = {
    version: db.version,
    stores: Array.from(db.objectStoreNames).map(storeName => {
      const transaction = db.transaction(storeName, 'readonly')
      const store = transaction.objectStore(storeName)
      return {
        name: store.name,
        keyPath: store.keyPath,
        autoIncrement: store.autoIncrement,
        indexNames: Array.from(store.indexNames)
      }
    })
  }
  db.close()
  return schema
}

/**
 * Helper to clear specific object stores.
 */
export async function clearObjectStores(stores: string[]) {
  const db = await getTestDB()
  const tx = db.transaction(stores, 'readwrite')
  await Promise.all(stores.map(s => {
    return new Promise<void>((resolve, reject) => {
      const request = tx.objectStore(s).clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }))
  db.close()
}

/**
 * Helper to seed data into an object store.
 */
export async function seedData(storeName: string, data: any[]) {
    const db = await getTestDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    for (const item of data) {
        store.put(item);
    }
    return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}
