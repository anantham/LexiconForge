import { describe, expect, it, vi } from 'vitest';
import { TranslationRepository } from '../../../services/db/repositories/TranslationRepository';

const flushAsync = () => new Promise(resolve => setTimeout(resolve, 0));

const makeRequest = () => ({
  error: null as unknown,
  onsuccess: null as null | (() => void),
  onerror: null as null | (() => void),
});

const makeRepositoryWithControlledStore = () => {
  const requests: ReturnType<typeof makeRequest>[] = [];
  const store = {
    put: vi.fn(() => {
      const request = makeRequest();
      requests.push(request);
      return request;
    }),
    delete: vi.fn(() => {
      const request = makeRequest();
      requests.push(request);
      return request;
    }),
  };
  const transaction = {
    error: null as unknown,
    objectStore: vi.fn(() => store),
    oncomplete: null as null | (() => void),
    onerror: null as null | (() => void),
    onabort: null as null | (() => void),
  };
  const db = {
    transaction: vi.fn(() => transaction),
  };
  const repo = new TranslationRepository({
    getDb: async () => db as unknown as IDBDatabase,
    getChapter: async () => null,
    stores: {
      TRANSLATIONS: 'translations',
      CHAPTERS: 'chapters',
      URL_MAPPINGS: 'url_mappings',
    },
  });

  return { repo: repo as any, requests, store, transaction };
};

const translationRecord = {
  id: 'translation-1',
  chapterUrl: 'https://example.com/ch1',
  version: 1,
  translatedTitle: 'Translated',
  translation: '<p>Hello</p>',
  footnotes: [],
  suggestedIllustrations: [],
  provider: 'OpenAI',
  model: 'gpt-4o-mini',
  totalTokens: 0,
  promptTokens: 0,
  completionTokens: 0,
  estimatedCost: 0,
  requestTime: 0,
  createdAt: '2026-07-08T00:00:00.000Z',
  isActive: true,
  settingsSnapshot: {
    provider: 'OpenAI',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    systemPrompt: 'translate',
  },
};

describe('TranslationRepository write durability', () => {
  it('writeTranslation waits for the transaction commit after put succeeds', async () => {
    const { repo, requests, transaction } = makeRepositoryWithControlledStore();

    let resolved = false;
    const promise = repo.writeTranslation(translationRecord);
    void promise.then(() => {
      resolved = true;
    });

    await flushAsync();
    expect(requests).toHaveLength(1);

    requests[0].onsuccess?.();
    await flushAsync();
    expect(resolved).toBe(false);

    transaction.oncomplete?.();

    await expect(promise).resolves.toBeUndefined();
    expect(resolved).toBe(true);
  });

  it('writeTranslation rejects if the transaction aborts after put succeeds', async () => {
    const { repo, requests, transaction } = makeRepositoryWithControlledStore();

    const promise = repo.writeTranslation(translationRecord);

    await flushAsync();
    expect(requests).toHaveLength(1);
    requests[0].onsuccess?.();

    transaction.error = new DOMException('quota full', 'QuotaExceededError');
    transaction.onabort?.();

    await expect(promise).rejects.toMatchObject({
      name: 'QuotaExceededError',
    });
  });

  it('deactivateTranslations waits for commit after all put requests succeed', async () => {
    const { repo, requests, transaction } = makeRepositoryWithControlledStore();

    let resolved = false;
    const promise = repo.deactivateTranslations([
      { ...translationRecord, id: 'translation-1', version: 1, isActive: true },
      { ...translationRecord, id: 'translation-2', version: 2, isActive: false },
      { ...translationRecord, id: 'translation-3', version: 3, isActive: true },
    ]);
    void promise.then(() => {
      resolved = true;
    });

    await flushAsync();
    expect(requests).toHaveLength(2);

    requests.forEach(request => request.onsuccess?.());
    await flushAsync();
    expect(resolved).toBe(false);

    transaction.oncomplete?.();

    await expect(promise).resolves.toBeUndefined();
    expect(resolved).toBe(true);
  });
});
