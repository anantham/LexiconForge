import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { searchNovelSources } from '../../services/librarySearch/searchService';
import type { AppSettings } from '../../types';

// Mock the LLM provider so we control the identity-resolution step.
let llmResponse: any = {
  identity: { titleZh: null, titleEn: null, authorZh: null, aliases: [] },
  rawSources: [],
  fanTranslations: [],
};

vi.mock('../../adapters/providers', () => ({
  initializeProviders: vi.fn(async () => {}),
}));

vi.mock('../../adapters/providers/registry', () => ({
  getProvider: () => ({
    chatJSON: async () => ({ text: JSON.stringify(llmResponse) }),
  }),
}));

const settings = { provider: 'openrouter', model: 'test-model' } as unknown as AppSettings;

describe('searchNovelSources — FoJin integration', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    llmResponse = {
      identity: { titleZh: null, titleEn: null, authorZh: null, aliases: [] },
      rawSources: [],
      fanTranslations: [],
    };
  });

  it('queries FoJin when LLM resolves a Chinese title and merges results into rawSources', async () => {
    llmResponse = {
      identity: {
        titleZh: '般若波羅蜜多心經',
        titleEn: 'Heart Sutra',
        authorZh: '玄奘',
        aliases: ['Prajñāpāramitāhṛdaya'],
      },
      rawSources: [],
      fanTranslations: [],
    };

    const fojinResults = {
      total: 5,
      results: [
        { id: 9, cbeta_id: 'T0251', title_zh: '般若波羅蜜多心經', translator: '玄奘', dynasty: '唐', category: '大正藏', has_content: true, source_code: 'cbeta', score: 505.8 },
        { id: 6504, cbeta_id: 'T0252', title_zh: '般若波羅蜜多心經', translator: '般若共利言等', dynasty: '唐', category: '大正藏', has_content: true, source_code: 'cbeta', score: 505.8 },
      ],
    };

    globalThis.fetch = vi.fn(async (input: any) => {
      const url = String(input);
      // Proxy route: /api/fetch-proxy?url=<encoded fojin.app/api/search...>
      if (url.includes('/api/fetch-proxy') && url.includes('fojin.app%2Fapi%2Fsearch')) {
        return new Response(JSON.stringify(fojinResults), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as any;

    const result = await searchNovelSources('heart sutra', settings);

    expect(result.identity.titleZh).toBe('般若波羅蜜多心經');
    expect(result.rawSources).toHaveLength(2);
    expect(result.rawSources[0].url).toBe('https://fojin.app/texts/9/read?juan=1');
    expect(result.rawSources[0].matchedTitle).toBe('般若波羅蜜多心經');
    expect(result.rawSources[0].matchedAuthor).toBe('玄奘');
    expect(result.rawSources[0].adapterSupported).toBe(true);
    expect(result.rawSources[0].whyThisMatches).toContain('唐');
    expect(result.rawSources[0].whyThisMatches).toContain('玄奘');
  });

  it('skips FoJin search when LLM returns no titleZh', async () => {
    llmResponse = {
      identity: { titleZh: null, titleEn: 'Some random query', authorZh: null, aliases: [] },
      rawSources: [],
      fanTranslations: [],
    };

    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    globalThis.fetch = fetchMock as any;

    const result = await searchNovelSources('random query that resolves nothing', settings);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.rawSources).toHaveLength(0);
  });

  it('merges FoJin results above LLM novel candidates by confidence', async () => {
    llmResponse = {
      identity: { titleZh: '某小說', titleEn: null, authorZh: null, aliases: [] },
      rawSources: [
        {
          site: 'Some Novel Site',
          url: 'https://example-novel.com/book/1',
          matchedTitle: '某小說',
          matchedAuthor: null,
          sourceType: 'mirror',
          chapterCount: null,
          status: null,
          confidence: 0.4,
          whyThisMatches: 'low confidence match',
        },
      ],
      fanTranslations: [],
    };

    const fojinResults = {
      total: 1,
      results: [
        { id: 42, cbeta_id: null, title_zh: '某小說 (Buddhist match)', translator: null, dynasty: null, category: null, has_content: true, source_code: 'cbeta', score: 200 },
      ],
    };

    globalThis.fetch = vi.fn(async (input: any) => {
      const url = String(input);
      // Proxy route: /api/fetch-proxy?url=<encoded fojin.app/api/search...>
      if (url.includes('/api/fetch-proxy') && url.includes('fojin.app%2Fapi%2Fsearch')) {
        return new Response(JSON.stringify(fojinResults), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as any;

    const result = await searchNovelSources('某小說', settings);

    expect(result.rawSources).toHaveLength(2);
    // FoJin's high-score result should rank above the low-confidence novel candidate.
    expect(result.rawSources[0].url).toContain('fojin.app');
    expect(result.rawSources[1].url).toBe('https://example-novel.com/book/1');
  });

  it('returns LLM-only results when FoJin search fails', async () => {
    llmResponse = {
      identity: { titleZh: '某書', titleEn: null, authorZh: null, aliases: [] },
      rawSources: [
        {
          site: 'Working Site',
          url: 'https://kakuyomu.jp/works/1/episodes/1',
          matchedTitle: '某書',
          matchedAuthor: null,
          sourceType: 'official',
          chapterCount: null,
          status: null,
          confidence: 0.9,
          whyThisMatches: 'works on supported site',
        },
      ],
      fanTranslations: [],
    };

    globalThis.fetch = vi.fn(async () => new Response('Server Error', { status: 500 })) as any;

    const result = await searchNovelSources('某書', settings);

    expect(result.rawSources).toHaveLength(1);
    expect(result.rawSources[0].url).toBe('https://kakuyomu.jp/works/1/episodes/1');
  });
});
