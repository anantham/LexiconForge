import { describe, expect, it, vi } from 'vitest';
import { ChapterRepository } from '../../../services/db/repositories/ChapterRepository';
import { FeedbackRepository } from '../../../services/db/repositories/FeedbackRepository';
import { PromptTemplatesRepository } from '../../../services/db/repositories/PromptTemplatesRepository';
import { SettingsRepository } from '../../../services/db/repositories/SettingsRepository';
import type { ChapterRecord } from '../../../services/db/types';

const flushAsync = () => new Promise(resolve => setTimeout(resolve, 0));

interface ControlledRequest<T = unknown> {
  result: T | undefined;
  onsuccess: null | (() => void);
}

const makeRequest = <T = unknown>(): ControlledRequest<T> => ({
  result: undefined,
  onsuccess: null,
});

const succeed = <T>(request: ControlledRequest<T>, result?: T) => {
  request.result = result;
  request.onsuccess?.();
};

const observeSettlement = (promise: Promise<unknown>) => {
  let settled = false;
  void promise.then(
    () => { settled = true; },
    () => { settled = true; }
  );
  return () => settled;
};

const makeControlledDb = () => {
  const requests = {
    indexGet: [] as ControlledRequest[],
    put: [] as ControlledRequest[],
    delete: [] as ControlledRequest[],
  };
  const listeners: Record<'complete' | 'error' | 'abort', Array<() => void>> = {
    complete: [],
    error: [],
    abort: [],
  };

  const addRequest = (kind: keyof typeof requests) => {
    const request = makeRequest();
    requests[kind].push(request);
    return request;
  };
  const index = { get: vi.fn(() => addRequest('indexGet')) };
  const store = {
    indexNames: { contains: vi.fn((name: string) => name === 'stableId') },
    index: vi.fn(() => index),
    put: vi.fn(() => addRequest('put')),
    delete: vi.fn(() => addRequest('delete')),
  };
  const transaction = {
    error: null as unknown,
    abort: vi.fn(),
    objectStore: vi.fn(() => store),
    addEventListener: vi.fn(
      (event: 'complete' | 'error' | 'abort', listener: () => void) => {
        listeners[event].push(listener);
      }
    ),
    emit: (event: 'complete' | 'error' | 'abort') => {
      listeners[event].forEach(listener => listener());
    },
  };
  const db = { transaction: vi.fn(() => transaction) };

  return { db: db as unknown as IDBDatabase, requests, transaction };
};

const chapterRecord = { stableId: 'stable-1' } as ChapterRecord;

const durabilityCases = [
  {
    name: 'SettingsRepository after put succeeds',
    domain: 'settings',
    service: 'SettingsRepository',
    run: (db: IDBDatabase) => new SettingsRepository({
      getDb: async () => db,
      stores: { SETTINGS: 'settings' },
    }).setSetting('theme', 'dark'),
    finishRequests: (requests: ReturnType<typeof makeControlledDb>['requests']) =>
      succeed(requests.put[0]),
  },
  {
    name: 'FeedbackRepository after delete succeeds',
    domain: 'feedback',
    service: 'FeedbackRepository',
    run: (db: IDBDatabase) => new FeedbackRepository({
      getDb: async () => db,
      stores: { FEEDBACK: 'feedback' },
    }).deleteFeedback('feedback-1'),
    finishRequests: (requests: ReturnType<typeof makeControlledDb>['requests']) =>
      succeed(requests.delete[0]),
  },
  {
    name: 'PromptTemplatesRepository after delete succeeds',
    domain: 'promptTemplates',
    service: 'PromptTemplatesRepository',
    run: (db: IDBDatabase) => new PromptTemplatesRepository({
      getDb: async () => db,
      stores: { PROMPT_TEMPLATES: 'prompt_templates' },
    }).deleteTemplate('template-1'),
    finishRequests: (requests: ReturnType<typeof makeControlledDb>['requests']) =>
      succeed(requests.delete[0]),
  },
  {
    name: 'ChapterRepository after its metadata put succeeds',
    domain: 'chapters',
    service: 'ChapterRepository',
    run: (db: IDBDatabase) => new ChapterRepository({
      getDb: async () => db,
      normalizeUrl: url => url,
      stores: { CHAPTERS: 'chapters' },
    }).setChapterNumberByStableId('stable-1', 5),
    finishRequests: async (requests: ReturnType<typeof makeControlledDb>['requests']) => {
      succeed(requests.indexGet[0], chapterRecord);
      await flushAsync();
      succeed(requests.put[0]);
    },
  },
];

describe('repository transaction durability', () => {
  it.each(durabilityCases)('rejects a commit-time abort in $name', async testCase => {
    const control = makeControlledDb();
    const promise = testCase.run(control.db);
    const isSettled = observeSettlement(promise);
    await flushAsync();
    await testCase.finishRequests(control.requests);
    await flushAsync();
    expect(isSettled()).toBe(false);
    control.transaction.error = new DOMException('quota full', 'QuotaExceededError');
    control.transaction.emit('abort');
    await expect(promise).rejects.toMatchObject({
      name: 'DbError',
      kind: 'Quota',
      domain: testCase.domain,
      service: testCase.service,
    });
  });
});
