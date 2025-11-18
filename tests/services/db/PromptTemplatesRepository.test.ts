import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import type { PromptTemplate } from '../../../types';
import { PromptTemplatesRepository } from '../../../services/db/repositories/PromptTemplatesRepository';

const DB_NAME = 'prompt-templates-repo-test';
const STORE_NAME = 'prompt_templates';

const baseTemplate: PromptTemplate = {
  id: 'template-1',
  name: 'Heroic Epic',
  description: 'Adds dramatic flair',
  content: 'You are a heroic narrator.',
  isDefault: false,
  createdAt: new Date('2024-01-01').toISOString(),
};

let db: IDBDatabase;
let repo: PromptTemplatesRepository;

const openTestDb = async (): Promise<IDBDatabase> => {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const upgradeDb = request.result;
      if (!upgradeDb.objectStoreNames.contains(STORE_NAME)) {
        const store = upgradeDb.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('isDefault', 'isDefault', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const deleteDb = async () =>
  new Promise<void>(resolve => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });

beforeEach(async () => {
  await deleteDb();
  db = await openTestDb();
  repo = new PromptTemplatesRepository({
    getDb: () => Promise.resolve(db),
    stores: { PROMPT_TEMPLATES: STORE_NAME },
  });
});

afterEach(async () => {
  db.close();
  await deleteDb();
});

describe('PromptTemplatesRepository', () => {
  it('stores and lists templates sorted by createdAt', async () => {
    await repo.storeTemplate(baseTemplate);
    await repo.storeTemplate({
      ...baseTemplate,
      id: 'template-2',
      name: 'Noir Detective',
      createdAt: new Date('2024-02-01').toISOString(),
    });

    const templates = await repo.getTemplates();
    expect(templates).toHaveLength(2);
    expect(templates[0].id).toBe('template-2');
    expect(typeof templates[0].isDefault).toBe('boolean');
  });

  it('retrieves and updates default template', async () => {
    await repo.storeTemplate(baseTemplate);
    await repo.storeTemplate({ ...baseTemplate, id: 'template-3', name: 'Wholesome', isDefault: true });

    let currentDefault = await repo.getDefaultTemplate();
    expect(currentDefault?.id).toBe('template-3');

    await repo.setDefaultTemplate(baseTemplate.id);
    currentDefault = await repo.getDefaultTemplate();
    expect(currentDefault?.id).toBe(baseTemplate.id);
  });

  it('gets template by id and deletes templates', async () => {
    await repo.storeTemplate(baseTemplate);
    const fetched = await repo.getTemplate(baseTemplate.id);
    expect(fetched?.name).toBe(baseTemplate.name);

    await repo.deleteTemplate(baseTemplate.id);
    const afterDelete = await repo.getTemplate(baseTemplate.id);
    expect(afterDelete).toBeNull();
  });
});
