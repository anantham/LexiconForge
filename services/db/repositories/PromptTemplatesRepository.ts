import type { PromptTemplate } from '../../../types';
import {
  promisifyRequest,
  runTransaction,
  type TransactionMode,
} from '../core/txn';
import type { PromptTemplateRecord } from '../types';
import type { IPromptTemplatesRepository } from './interfaces/IPromptTemplatesRepository';

interface PromptTemplatesRepositoryDeps {
  getDb: () => Promise<IDBDatabase>;
  stores: {
    PROMPT_TEMPLATES: string;
  };
}

type StoredPromptTemplateRecord = Omit<PromptTemplateRecord, 'isDefault'> & {
  isDefault: number;
};

const toStoredRecord = (template: PromptTemplate): StoredPromptTemplateRecord => ({
  id: template.id,
  name: template.name,
  description: template.description,
  content: template.content,
  isDefault: template.isDefault ? 1 : 0,
  createdAt: template.createdAt ?? new Date().toISOString(),
  lastUsed: template.lastUsed,
});

const normalizeRecord = (record: StoredPromptTemplateRecord): PromptTemplateRecord => ({
  ...record,
  isDefault: Boolean(record.isDefault),
});

export class PromptTemplatesRepository implements IPromptTemplatesRepository {
  constructor(private readonly deps: PromptTemplatesRepositoryDeps) {}

  private async withStore<T>(
    mode: TransactionMode,
    operationName: string,
    fn: (store: IDBObjectStore) => Promise<T> | T
  ): Promise<T> {
    const db = await this.deps.getDb();
    const storeName = this.deps.stores.PROMPT_TEMPLATES;
    return runTransaction(
      db,
      storeName,
      mode,
      (_transaction, stores) => fn(stores[storeName]),
      'promptTemplates',
      'PromptTemplatesRepository',
      operationName
    );
  }

  async storeTemplate(template: PromptTemplate): Promise<void> {
    const record = toStoredRecord(template);
    await this.withStore('readwrite', 'storeTemplate', async store => {
      await promisifyRequest(store.put(record));
    });
  }

  async getTemplates(): Promise<PromptTemplateRecord[]> {
    return this.withStore('readonly', 'getTemplates', async store => {
      const items = await promisifyRequest<StoredPromptTemplateRecord[]>(store.getAll());
      return items
        .map(normalizeRecord)
        .sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    });
  }

  async getDefaultTemplate(): Promise<PromptTemplateRecord | null> {
    return this.withStore('readonly', 'getDefaultTemplate', async store => {
      if (!store.indexNames.contains('isDefault')) {
        console.warn('[PromptTemplates] isDefault index missing, using fallback scan');
        const records = await promisifyRequest<StoredPromptTemplateRecord[]>(store.getAll());
        const defaultRecord = records.find(record => record.isDefault === 1);
        return defaultRecord ? normalizeRecord(defaultRecord) : null;
      }

      const record = await promisifyRequest<StoredPromptTemplateRecord | undefined>(
        store.index('isDefault').get(IDBKeyRange.only(1))
      );
      return record ? normalizeRecord(record) : null;
    });
  }

  async getTemplate(id: string): Promise<PromptTemplateRecord | null> {
    return this.withStore('readonly', 'getTemplate', async store => {
      const record = await promisifyRequest<StoredPromptTemplateRecord | undefined>(
        store.get(id)
      );
      return record ? normalizeRecord(record) : null;
    });
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.withStore('readwrite', 'deleteTemplate', async store => {
      await promisifyRequest(store.delete(id));
    });
  }

  async setDefaultTemplate(id: string): Promise<void> {
    await this.withStore('readwrite', 'setDefaultTemplate', async store => {
      const all = await promisifyRequest<StoredPromptTemplateRecord[]>(store.getAll());

      await Promise.all(
        all.map(record => {
          const isDefault = record.id === id;
          record.isDefault = isDefault ? 1 : 0;
          if (isDefault) {
            record.lastUsed = new Date().toISOString();
          }
          return promisifyRequest(store.put(record));
        })
      );
    });
  }
}
