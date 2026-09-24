import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslationOps } from '../../../services/db/operations/translations';
import type { AppSettings, TranslationResult } from '../../../types';

/**
 * TranslationOps is the single write path for translations. Other suites mock
 * it; these run it end-to-end (ops -> facade -> repository -> IndexedDB).
 * Each test uses its own chapter URL, so they share one database safely.
 */

const settings = {
  provider: 'Gemini',
  model: 'gemini-2.5-flash',
  temperature: 0.3,
  systemPrompt: 'Translate faithfully.',
  enableAmendments: false,
  includeFanTranslationInPrompt: false,
  promptId: 'p1',
  promptName: 'Default',
  // Present at runtime because callers pass whole AppSettings objects.
  apiKeyGemini: 'SECRET-GEMINI-KEY',
  apiKeyOpenRouter: 'SECRET-OPENROUTER-KEY',
  deeplApiKey: 'SECRET-DEEPL-KEY',
} as AppSettings & { promptId: string; promptName: string };

const result = (translation: string): TranslationResult => ({
  translatedTitle: 'Title',
  translation,
  proposal: null,
  footnotes: [],
  suggestedIllustrations: [],
  usageMetrics: {
    totalTokens: 30,
    promptTokens: 20,
    completionTokens: 10,
    estimatedCost: 0.001,
    requestTime: 1,
    provider: 'Gemini',
    model: 'gemini-2.5-flash',
  },
});

let url: string;
let n = 0;
beforeEach(() => {
  url = `https://example.test/novel/chapter-${++n}`;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

const store = (text: string) => TranslationOps.store({ ref: { url }, result: result(text), settings });

describe('TranslationOps (IndexedDB round trip)', () => {
  it('persists the translation settings snapshot and never an API key', async () => {
    const stored = await store('first');
    const reloaded = await TranslationOps.getById(stored.id);

    expect(reloaded?.translation).toBe('first');
    expect(Object.keys(reloaded?.settingsSnapshot ?? {}).sort()).toEqual([
      'enableAmendments', 'includeFanTranslationInPrompt', 'model', 'promptId',
      'promptName', 'provider', 'systemPrompt', 'temperature',
    ]);
    expect(JSON.stringify(reloaded)).not.toContain('SECRET');
  });

  it('stores each retranslation as the next version and makes only it active', async () => {
    await store('first');
    const second = await store('second');

    const versions = await TranslationOps.getVersionsByUrl(url);
    expect(versions.map(v => v.version).sort()).toEqual([1, 2]);
    expect(versions.filter(v => v.isActive).map(v => v.id)).toEqual([second.id]);
    expect((await TranslationOps.getActiveByUrl(url))?.translation).toBe('second');
  });

  it('switches the active version without leaving two active', async () => {
    await store('first');
    await store('second');

    await TranslationOps.setActiveByUrl(url, 1);

    const versions = await TranslationOps.getVersionsByUrl(url);
    expect(versions.filter(v => v.isActive).map(v => v.version)).toEqual([1]);
    expect((await TranslationOps.getActiveByUrl(url))?.translation).toBe('first');
  });

  it('deletes one version and ignores an unknown id', async () => {
    const first = await store('first');
    await store('second');

    await TranslationOps.deleteVersion(first.id);
    await TranslationOps.deleteVersion('no-such-translation');

    const versions = await TranslationOps.getVersionsByUrl(url);
    expect(versions.map(v => v.translation)).toEqual(['second']);
  });

  it('keeps a stableId-only translation when the chapter URL cannot be resolved', async () => {
    const stableId = `unmapped-${n}`;

    const stored = await TranslationOps.storeByStableId(stableId, result('kept'), settings);

    expect(stored.chapterUrl).toBe(`stableId://${stableId}`);
    expect((await TranslationOps.getActiveByStableId(stableId))?.translation).toBe('kept');
  });

  it('rejects a write with neither a URL nor a stableId', async () => {
    await expect(
      TranslationOps.store({ ref: {}, result: result('lost'), settings }),
    ).rejects.toThrow('ChapterRef requires stableId or url');
  });
});
