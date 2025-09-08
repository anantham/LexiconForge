import { describe, it, expect, beforeEach } from 'vitest';
import { indexedDBService } from '../../../services/indexeddb';
import { TranslationOps } from '../../../services/db/operations';

const deleteDb = async () => new Promise<void>((res) => {
  const req = indexedDB.deleteDatabase('lexicon-forge');
  req.onsuccess = () => res();
  req.onerror = () => res();
  req.onblocked = () => res();
});

describe('New TranslationOps (migration-aware)', () => {
  beforeEach(async () => {
    await deleteDb();
  });

  it('auto-repairs URL mappings when storing by stableId only', async () => {
    // Arrange: store a chapter via legacy API (no URL mappings written)
    const url = 'https://example.com/ch1';
    const chapter = { title: 'Ch1', content: 'C1', originalUrl: url, nextUrl: null, prevUrl: null } as any;
    await indexedDBService.storeChapter(chapter);

    // Backfill a stableId on chapter record to simulate legacy data with stableId
    const rec = await indexedDBService.getChapter(url);
    expect(rec).toBeTruthy();
    const stableId = 'ch1_abcd1234_wxyz';
    (rec as any)!.stableId = stableId;
    // Persist the updated chapter record directly
    const db = await (indexedDBService as any).openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['chapters'], 'readwrite');
      tx.objectStore('chapters').put(rec as any).onsuccess = () => resolve();
      tx.onerror = () => reject(tx.error as any);
    });

    // Act: store translation via TranslationOps using only stableId
    const result = await TranslationOps.store({
      ref: { stableId },
      result: { translatedTitle: 'T1', translation: 'Hello', footnotes: [], suggestedIllustrations: [], usageMetrics: { totalTokens: 0, promptTokens: 0, completionTokens: 0, estimatedCost: 0, requestTime: 0, provider: 'OpenAI', model: 'gpt-5' } as any },
      settings: { provider: 'OpenAI', model: 'gpt-5', temperature: 0.7, systemPrompt: 'x' }
    });

    expect(result.version).toBe(1);

    // Assert: URL mappings exist now
    const mappings = await indexedDBService.getAllUrlMappings();
    expect(mappings.some(m => m.stableId === stableId && m.url === url)).toBe(true);
  });

  it('assigns unique sequential versions under concurrency (best-effort atomic)', async () => {
    const url = 'https://example.com/ch2';
    const chapter = { title: 'Ch2', content: 'C2', originalUrl: url, nextUrl: null, prevUrl: null } as any;
    await indexedDBService.storeChapter(chapter);

    const base = await TranslationOps.store({
      ref: { url },
      result: { translatedTitle: 'T0', translation: 'Base', footnotes: [], suggestedIllustrations: [], usageMetrics: { totalTokens: 0, promptTokens: 0, completionTokens: 0, estimatedCost: 0, requestTime: 0, provider: 'OpenAI', model: 'gpt-5' } as any },
      settings: { provider: 'OpenAI', model: 'gpt-5', temperature: 0.7, systemPrompt: 'x' }
    });
    expect(base.version).toBe(1);

    // Concurrent two writes
    const p1 = TranslationOps.store({ ref: { url }, result: { translatedTitle: 'T1', translation: 'A', footnotes: [], suggestedIllustrations: [], usageMetrics: { totalTokens: 0, promptTokens: 0, completionTokens: 0, estimatedCost: 0, requestTime: 0, provider: 'OpenAI', model: 'gpt-5' } as any }, settings: { provider: 'OpenAI', model: 'gpt-5', temperature: 0.7, systemPrompt: 'x' } });
    const p2 = TranslationOps.store({ ref: { url }, result: { translatedTitle: 'T2', translation: 'B', footnotes: [], suggestedIllustrations: [], usageMetrics: { totalTokens: 0, promptTokens: 0, completionTokens: 0, estimatedCost: 0, requestTime: 0, provider: 'OpenAI', model: 'gpt-5' } as any }, settings: { provider: 'OpenAI', model: 'gpt-5', temperature: 0.7, systemPrompt: 'x' } });
    const [r1, r2] = await Promise.all([p1, p2]);

    const versions = [r1.version, r2.version];
    const unique = new Set(versions);
    expect(unique.size).toBe(2);
  });
});

