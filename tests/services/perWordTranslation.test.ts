/**
 * Tests for services/perWordTranslation.ts (issue #15 Phase 2).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { lookupWord, __resetPerWordCache } from '../../services/perWordTranslation';
import type { GlossaryEntry } from '../../types';

describe('perWordTranslation', () => {
  let originalFetch: typeof fetch;
  beforeEach(() => {
    __resetPerWordCache();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('glossary lookup', () => {
    it('matches case-insensitively against glossary source', async () => {
      const glossary: GlossaryEntry[] = [
        { source: '李逍遥', target: 'Li Xiaoyao', note: 'protagonist' },
        { source: 'sati', target: 'mindfulness' },
      ];
      const r = await lookupWord({
        sourceWord: '李逍遥',
        sourceLang: 'zh',
        glossary,
        providers: ['glossary'],
      });
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({ english: 'Li Xiaoyao', provider: 'glossary', note: 'protagonist' });
    });

    it('returns empty when source word has no glossary entry', async () => {
      const r = await lookupWord({
        sourceWord: 'unknown',
        sourceLang: 'en',
        glossary: [{ source: '李', target: 'Li' }],
        providers: ['glossary'],
      });
      expect(r).toHaveLength(0);
    });

    it('returns empty when glossary is undefined', async () => {
      const r = await lookupWord({
        sourceWord: 'anything',
        sourceLang: 'en',
        providers: ['glossary'],
      });
      expect(r).toHaveLength(0);
    });

    it('handles multiple glossary entries for same source (returns all)', async () => {
      const glossary: GlossaryEntry[] = [
        { source: 'sati', target: 'mindfulness' },
        { source: 'sati', target: 'memory' }, // alternate gloss
      ];
      const r = await lookupWord({
        sourceWord: 'sati',
        sourceLang: 'pi',
        glossary,
        providers: ['glossary'],
      });
      expect(r).toHaveLength(2);
      expect(r.map((s) => s.english)).toEqual(['mindfulness', 'memory']);
    });
  });

  describe('DeepL lookup', () => {
    it('skips DeepL when apiKey is not provided', async () => {
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy as any;
      const r = await lookupWord({
        sourceWord: '李逍遥',
        sourceLang: 'zh',
        providers: ['deepl'],
        // no apiKeys
      });
      expect(r).toHaveLength(0);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('uses free-tier endpoint when key ends with :fx', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ translations: [{ text: 'Li Xiaoyao' }] }),
      });
      global.fetch = fetchSpy as any;

      await lookupWord({
        sourceWord: '李逍遥',
        sourceLang: 'zh',
        providers: ['deepl'],
        apiKeys: { deepl: 'abc123:fx' },
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const url = fetchSpy.mock.calls[0][0];
      expect(url).toBe('https://api-free.deepl.com/v2/translate');
    });

    it('uses pro endpoint when key does not end with :fx', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ translations: [{ text: 'X' }] }),
      });
      global.fetch = fetchSpy as any;

      await lookupWord({
        sourceWord: 'a',
        sourceLang: 'zh',
        providers: ['deepl'],
        apiKeys: { deepl: 'paid-key-xyz' },
      });

      expect(fetchSpy.mock.calls[0][0]).toBe('https://api.deepl.com/v2/translate');
    });

    it('returns Sense for each DeepL translation', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          translations: [{ text: 'Li Xiaoyao', detected_source_language: 'ZH' }],
        }),
      }) as any;

      const r = await lookupWord({
        sourceWord: '李逍遥',
        sourceLang: 'zh',
        providers: ['deepl'],
        apiKeys: { deepl: 'k:fx' },
      });
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({ english: 'Li Xiaoyao', provider: 'deepl' });
      expect(r[0].note).toContain('detected: ZH');
    });

    it('skips DeepL for unsupported source language', async () => {
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy as any;
      await lookupWord({
        sourceWord: 'सति',
        sourceLang: 'sa', // Sanskrit not in DEEPL_LANG_CODE
        providers: ['deepl'],
        apiKeys: { deepl: 'k:fx' },
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns empty on DeepL HTTP error', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as any;
      const r = await lookupWord({
        sourceWord: 'a',
        sourceLang: 'zh',
        providers: ['deepl'],
        apiKeys: { deepl: 'k:fx' },
      });
      expect(r).toHaveLength(0);
    });
  });

  describe('Google lookup', () => {
    it('skips Google when apiKey is not provided', async () => {
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy as any;
      const r = await lookupWord({
        sourceWord: 'a',
        sourceLang: 'zh',
        providers: ['google'],
      });
      expect(r).toHaveLength(0);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns Sense from Google translation response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { translations: [{ translatedText: 'Li Xiaoyao' }] },
        }),
      }) as any;
      const r = await lookupWord({
        sourceWord: '李逍遥',
        sourceLang: 'zh',
        providers: ['google'],
        apiKeys: { google: 'AIza-fake' },
      });
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({ english: 'Li Xiaoyao', provider: 'google' });
    });
  });

  describe('cache behavior', () => {
    it('caches glossary lookups (no repeated work)', async () => {
      const glossary: GlossaryEntry[] = [{ source: 'sati', target: 'mindfulness' }];
      const r1 = await lookupWord({ sourceWord: 'sati', sourceLang: 'pi', glossary, providers: ['glossary'] });
      // Modify glossary; cached result should not change
      const r2 = await lookupWord({ sourceWord: 'sati', sourceLang: 'pi', glossary: [], providers: ['glossary'] });
      expect(r1).toEqual(r2);
    });

    it('caches DeepL lookups (no repeated network calls)', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ translations: [{ text: 'X' }] }),
      });
      global.fetch = fetchSpy as any;

      const opts = { sourceWord: 'a', sourceLang: 'zh' as const, providers: ['deepl' as const], apiKeys: { deepl: 'k:fx' } };
      await lookupWord(opts);
      await lookupWord(opts);
      await lookupWord(opts);

      expect(fetchSpy).toHaveBeenCalledTimes(1); // 2nd + 3rd calls hit cache
    });

    it('cache key distinguishes by sourceLang', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ translations: [{ text: 'X' }] }),
      });
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ translations: [{ text: 'X' }] }) }) as any;

      await lookupWord({ sourceWord: 'a', sourceLang: 'zh', providers: ['deepl'], apiKeys: { deepl: 'k:fx' } });
      await lookupWord({ sourceWord: 'a', sourceLang: 'ja', providers: ['deepl'], apiKeys: { deepl: 'k:fx' } });

      expect((global.fetch as any).mock.calls).toHaveLength(2); // different lang, no shared cache
    });
  });

  describe('multi-provider order', () => {
    it('returns senses in provider order', async () => {
      global.fetch = vi.fn(async (url: string) => {
        if (url.includes('deepl')) {
          return { ok: true, json: async () => ({ translations: [{ text: 'deepl-result' }] }) } as any;
        }
        if (url.includes('googleapis')) {
          return { ok: true, json: async () => ({ data: { translations: [{ translatedText: 'google-result' }] } }) } as any;
        }
        return { ok: false } as any;
      }) as any;

      const r = await lookupWord({
        sourceWord: 'sati',
        sourceLang: 'pi',
        glossary: [{ source: 'sati', target: 'glossary-mindfulness' }],
        providers: ['glossary', 'deepl', 'google'],
        apiKeys: { deepl: 'k:fx', google: 'AIza-x' },
      });
      // Note: 'pi' is not in DEEPL_LANG_CODE, so DeepL skips
      expect(r.map((s) => s.provider)).toEqual(['glossary', 'google']);
      expect(r[0].english).toBe('glossary-mindfulness');
      expect(r[1].english).toBe('google-result');
    });
  });
});
