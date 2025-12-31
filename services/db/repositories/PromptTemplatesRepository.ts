import type { PromptTemplate } from '../../../types';
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
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => Promise<T> | T
  ): Promise<T> {
    const db = await this.deps.getDb();
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction([this.deps.stores.PROMPT_TEMPLATES], mode);
      const store = tx.objectStore(this.deps.stores.PROMPT_TEMPLATES);
      Promise.resolve(fn(store))
        .then(resolve)
        .catch(reject);
      tx.onerror = () => reject(tx.error);
    });
  }

  async storeTemplate(template: PromptTemplate): Promise<void> {
    const record = toStoredRecord(template);
    await this.withStore('readwrite', async store => {
      await new Promise<void>((resolve, reject) => {
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  }

  async getTemplates(): Promise<PromptTemplateRecord[]> {
    return this.withStore('readonly', store => {
      return new Promise<PromptTemplateRecord[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const items = (req.result as StoredPromptTemplateRecord[] | undefined) ?? [];
          resolve(
            items
              .map(item => ({
                ...item,
                isDefault: Boolean(item.isDefault),
              }))
              .sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )
          );
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  async getDefaultTemplate(): Promise<PromptTemplateRecord | null> {
    return this.withStore('readonly', store => {
      return new Promise<PromptTemplateRecord | null>((resolve, reject) => {
        // Check if isDefault index exists - fallback to getAll() scan if not
        // This handles databases created before the index was added
        if (!store.indexNames.contains('isDefault')) {
          console.warn('[PromptTemplates] isDefault index missing, using fallback scan');
          const req = store.getAll();
          req.onsuccess = () => {
            const records = (req.result as StoredPromptTemplateRecord[]) ?? [];
            const defaultRecord = records.find(r => r.isDefault === 1);
            resolve(defaultRecord ? normalizeRecord(defaultRecord) : null);
          };
          req.onerror = () => reject(req.error);
          return;
        }

        const index = store.index('isDefault');
        const req = index.get(IDBKeyRange.only(1));
        req.onsuccess = () => {
        const record = req.result as StoredPromptTemplateRecord | undefined;
        resolve(record ? normalizeRecord(record) : null);
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  async getTemplate(id: string): Promise<PromptTemplateRecord | null> {
    return this.withStore('readonly', store => {
      return new Promise<PromptTemplateRecord | null>((resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = () => {
        const record = req.result as StoredPromptTemplateRecord | undefined;
        resolve(record ? normalizeRecord(record) : null);
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.withStore('readwrite', async store => {
      await new Promise<void>((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  }

  async setDefaultTemplate(id: string): Promise<void> {
    await this.withStore('readwrite', async store => {
      const all = await new Promise<StoredPromptTemplateRecord[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve((req.result as StoredPromptTemplateRecord[]) || []);
        req.onerror = () => reject(req.error);
      });

      await Promise.all(
        all.map(record => {
          const isDefault = record.id === id;
          record.isDefault = isDefault ? 1 : 0;
          if (isDefault) {
            record.lastUsed = new Date().toISOString();
          }
          return new Promise<void>((resolve, reject) => {
            const req = store.put(record);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          });
        })
      );
    });
  }
}
