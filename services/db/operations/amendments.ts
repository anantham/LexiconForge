import type { AmendmentLogRecord } from '../types';
import { STORE_NAMES } from '../core/schema';
import { withReadTxn, withWriteTxn, promisifyRequest } from '../core/txn';

const STORE = STORE_NAMES.AMENDMENT_LOGS;

const generateId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const toRecord = (
  log: Omit<AmendmentLogRecord, 'id' | 'timestamp'>
): AmendmentLogRecord => ({
  id: generateId(),
  timestamp: Date.now(),
  ...log,
});

export class AmendmentOps {
  static async logAction(
    log: Omit<AmendmentLogRecord, 'id' | 'timestamp'>
  ): Promise<void> {
    const record = toRecord(log);
    await withWriteTxn(
      STORE,
      async (_txn, stores) => {
        const store = stores[STORE];
        await promisifyRequest(store.put(record));
      },
      'amendments',
      'operations',
      'logAction'
    );
  }

  static async getLogs(options?: {
    action?: 'accepted' | 'rejected' | 'modified';
    chapterId?: string;
    limit?: number;
  }): Promise<AmendmentLogRecord[]> {
    return withReadTxn(
      STORE,
      async (_txn, stores) => {
        const store = stores[STORE];
        let request: IDBRequest;

        if (options?.action) {
          request = store
            .index('action')
            .getAll(IDBKeyRange.only(options.action));
        } else if (options?.chapterId) {
          request = store
            .index('chapterId')
            .getAll(IDBKeyRange.only(options.chapterId));
        } else {
          request = store.getAll();
        }

        const items =
          ((await promisifyRequest(
            request
          )) as AmendmentLogRecord[] | undefined) ?? [];

        let logs = items.sort((a, b) => b.timestamp - a.timestamp);
        if (options?.limit) {
          logs = logs.slice(0, options.limit);
        }
        return logs;
      },
      'amendments',
      'operations',
      'getLogs'
    );
  }

  static async getStats(): Promise<{
    total: number;
    accepted: number;
    rejected: number;
    modified: number;
  }> {
    const logs = await this.getLogs();

    return {
      total: logs.length,
      accepted: logs.filter(l => l.action === 'accepted').length,
      rejected: logs.filter(l => l.action === 'rejected').length,
      modified: logs.filter(l => l.action === 'modified').length,
    };
  }

  static async deleteLog(logId: string): Promise<void> {
    await withWriteTxn(
      STORE,
      async (_txn, stores) => {
        const store = stores[STORE];
        await promisifyRequest(store.delete(logId));
      },
      'amendments',
      'operations',
      'deleteLog'
    );
  }

  static async storeRecord(record: AmendmentLogRecord): Promise<void> {
    await withWriteTxn(
      STORE,
      async (_txn, stores) => {
        const store = stores[STORE];
        await promisifyRequest(store.put(record));
      },
      'amendments',
      'operations',
      'storeRecord'
    );
  }

  static async importLogs(logs: AmendmentLogRecord[]): Promise<void> {
    if (!Array.isArray(logs) || logs.length === 0) return;

    await withWriteTxn(
      STORE,
      async (_txn, stores) => {
        const store = stores[STORE];
        await Promise.all(
          logs.map(log => promisifyRequest(store.put(log)))
        );
      },
      'amendments',
      'operations',
      'importLogs'
    );
  }
}
