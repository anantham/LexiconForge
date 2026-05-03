import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAndParseUrl } from '../../services/scraping/fetcher';
import { getSupportedSiteInfo, isUrlSupported } from '../../services/scraping/urlUtils';

const makeResponse = (body: string) => ({
  ok: true,
  status: 200,
  text: async () => body,
  json: async () => JSON.parse(body),
  arrayBuffer: async () => new TextEncoder().encode(body).buffer,
});

describe('FoJin adapter wiring', () => {
  beforeEach(() => {
    if (typeof AbortSignal.timeout !== 'function') {
      (AbortSignal as any).timeout = () => new AbortController().signal;
    }
  });

  it('treats fojin.app URLs as supported', () => {
    expect(isUrlSupported('https://fojin.app/texts/9/read?juan=1')).toBe(true);
    const sites = getSupportedSiteInfo();
    const fojin = sites.find((site) => site.domain === 'fojin.app');
    expect(fojin).toBeDefined();
    expect(fojin?.example).toContain('fojin.app');
  });

  it('fetches a single-juan text via the API and uses canonical title', async () => {
    const juanPayload = {
      text_id: 9,
      cbeta_id: 'T0251',
      title_zh: '般若波羅蜜多心經',
      juan_num: 1,
      total_juans: 1,
      content: '觀自在菩薩，行深般若波羅蜜多時...',
      char_count: 260,
      lang: 'lzh',
      prev_juan: null,
      next_juan: null,
    };
    const metaPayload = {
      id: 9,
      title_zh: '般若波羅蜜多心經',
      translator: '玄奘',
      dynasty: '唐',
      fascicle_count: 1,
      has_content: true,
      lang: 'lzh',
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const decoded = (() => { try { return decodeURIComponent(url); } catch { return url; } })();
      if (decoded.includes('/api/texts/9/juans/1')) return makeResponse(JSON.stringify(juanPayload));
      if (decoded.endsWith('/api/texts/9') || decoded.includes('/api/texts/9?')) {
        return makeResponse(JSON.stringify(metaPayload));
      }
      // CORS proxies reflect via param; match any URL that contains the API path
      return makeResponse(JSON.stringify(juanPayload));
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as any;

    try {
      const result = await fetchAndParseUrl('https://fojin.app/texts/9/read?juan=1');
      expect(result.title).toBe('般若波羅蜜多心經');
      expect(result.content).toContain('觀自在菩薩');
      expect(result.chapterNumber).toBe(1);
      expect(result.sourceLanguage).toBe('Classical Chinese');
      expect(result.prevUrl).toBeNull();
      expect(result.nextUrl).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('builds prev/next juan URLs for multi-juan texts', async () => {
    const juanPayload = {
      text_id: 16,
      title_zh: '大般涅槃經',
      juan_num: 2,
      total_juans: 36,
      content: 'Some content from juan 2.',
      char_count: 11676,
      lang: 'lzh',
      prev_juan: 1,
      next_juan: 3,
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const decoded = (() => { try { return decodeURIComponent(url); } catch { return url; } })();
      if (decoded.includes('/api/texts/16/juans/2')) return makeResponse(JSON.stringify(juanPayload));
      if (decoded.includes('/api/texts/16')) {
        return makeResponse(JSON.stringify({ id: 16, title_zh: '大般涅槃經', fascicle_count: 36, has_content: true, lang: 'lzh' }));
      }
      return makeResponse(JSON.stringify(juanPayload));
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as any;

    try {
      const result = await fetchAndParseUrl('https://fojin.app/texts/16/read?juan=2');
      expect(result.title).toBe('大般涅槃經 卷2');
      expect(result.prevUrl).toBe('https://fojin.app/texts/16/read?juan=1');
      expect(result.nextUrl).toBe('https://fojin.app/texts/16/read?juan=3');
      expect(result.chapterNumber).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('defaults to juan 1 when query param is missing', async () => {
    const juanPayload = {
      text_id: 9,
      title_zh: '般若波羅蜜多心經',
      juan_num: 1,
      total_juans: 1,
      content: 'Heart Sutra content.',
      char_count: 260,
      lang: 'lzh',
      prev_juan: null,
      next_juan: null,
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const decoded = (() => { try { return decodeURIComponent(url); } catch { return url; } })();
      if (decoded.includes('/api/texts/9/juans/1')) return makeResponse(JSON.stringify(juanPayload));
      if (decoded.includes('/api/texts/9')) return makeResponse(JSON.stringify({ id: 9, title_zh: '般若波羅蜜多心經', fascicle_count: 1, has_content: true, lang: 'lzh' }));
      throw new Error(`Unexpected URL: ${url}`);
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as any;

    try {
      const result = await fetchAndParseUrl('https://fojin.app/texts/9/read');
      expect(result.chapterNumber).toBe(1);
      expect(result.title).toBe('般若波羅蜜多心經');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('throws a clear error when juan content is empty (catalog-only text)', async () => {
    const emptyJuanPayload = {
      text_id: 999,
      title_zh: 'Catalog-only text',
      juan_num: 1,
      total_juans: 1,
      content: '',
      char_count: 0,
      lang: 'lzh',
      prev_juan: null,
      next_juan: null,
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      return makeResponse(JSON.stringify(emptyJuanPayload));
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as any;

    try {
      await expect(
        fetchAndParseUrl('https://fojin.app/texts/999/read?juan=1')
      ).rejects.toThrow();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
