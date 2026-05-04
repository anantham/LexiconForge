import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { searchNovelSources } from '../../services/librarySearch/searchService';
import type { AppSettings } from '../../types';

// Mock LLM responses keyed by call type. The search service makes two LLM
// calls when there's a Buddhist-text match: (1) identity resolution,
// (2) FoJin candidate disambiguation. We pick which to return based on the
// system prompt's contents.
let identityResponse: any = {
  identity: { titleZh: null, titleEn: null, authorZh: null, aliases: [] },
  rawSources: [],
  fanTranslations: [],
};
let enrichmentResponse: any | null = null; // null = enrichment LLM call throws/fails
let enrichmentCallCount = 0;

vi.mock('../../adapters/providers', () => ({
  initializeProviders: vi.fn(async () => {}),
}));

vi.mock('../../adapters/providers/registry', () => ({
  getProvider: () => ({
    chatJSON: async (input: any) => {
      const systemMsg = input.messages?.find((m: any) => m.role === 'system')?.content || '';
      const isEnrichment = systemMsg.includes('disambiguating');
      if (isEnrichment) {
        enrichmentCallCount += 1;
        if (enrichmentResponse === null) {
          throw new Error('enrichment LLM call failed');
        }
        return { text: JSON.stringify(enrichmentResponse) };
      }
      return { text: JSON.stringify(identityResponse) };
    },
  }),
}));

const settings = { provider: 'openrouter', model: 'test-model' } as unknown as AppSettings;

describe('searchNovelSources — FoJin integration', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    enrichmentCallCount = 0;
    enrichmentResponse = null;
    identityResponse = {
      identity: { titleZh: null, titleEn: null, authorZh: null, aliases: [] },
      rawSources: [],
      fanTranslations: [],
    };
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('queries FoJin when LLM resolves a Chinese title and merges results into rawSources', async () => {
    identityResponse = {
      identity: {
        titleZh: '般若波羅蜜多心經',
        titleEn: 'Heart Sutra',
        authorZh: '玄奘',
        aliases: ['Prajñāpāramitāhṛdaya'],
      },
      rawSources: [],
      fanTranslations: [],
    };
    enrichmentResponse = null; // simulate enrichment failure → fall back to Chinese metadata

    const fojinResults = {
      total: 5,
      results: [
        { id: 9, cbeta_id: 'T0251', title_zh: '般若波羅蜜多心經', translator: '玄奘', dynasty: '唐', category: '大正藏', has_content: true, source_code: 'cbeta', score: 505.8 },
        { id: 6504, cbeta_id: 'T0252', title_zh: '般若波羅蜜多心經', translator: '般若共利言等', dynasty: '唐', category: '大正藏', has_content: true, source_code: 'cbeta', score: 505.8 },
      ],
    };

    globalThis.fetch = vi.fn(async (input: any) => {
      const url = String(input);
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
    // Fall-back metadata when enrichment fails — Chinese context still present.
    expect(result.rawSources[0].whyThisMatches).toContain('唐');
    expect(result.rawSources[0].whyThisMatches).toContain('玄奘');
  });

  it('uses LLM-enriched English descriptions and prefers the recommended candidate', async () => {
    identityResponse = {
      identity: {
        titleZh: '般若波羅蜜多心經',
        titleEn: 'Heart Sutra',
        authorZh: '玄奘',
        aliases: [],
      },
      rawSources: [],
      fanTranslations: [],
    };
    enrichmentResponse = {
      candidates: [
        { id: 9, englishDescription: 'Xuanzang\'s famous short version, the one most commonly recited in East Asia.', recommended: true },
        { id: 6504, englishDescription: 'Long version with narrative framing; less commonly recited.', recommended: false },
        { id: 7884, englishDescription: 'Commentary on the Heart Sutra, not the sutra itself.', recommended: false },
      ],
    };

    const fojinResults = {
      total: 3,
      results: [
        // Note: scores are equal but enrichment should reorder so id=9 ranks first.
        { id: 6504, cbeta_id: 'T0253', title_zh: '般若波羅蜜多心經', translator: '般若共利言等', dynasty: '唐', category: '大正藏', has_content: true, source_code: 'cbeta', score: 505.8 },
        { id: 9, cbeta_id: 'T0251', title_zh: '般若波羅蜜多心經', translator: '玄奘', dynasty: '唐', category: '大正藏', has_content: true, source_code: 'cbeta', score: 505.8 },
        { id: 7884, cbeta_id: 'T1711', title_zh: '般若波羅蜜多心經贊', translator: '圓測撰', dynasty: '唐', category: '大正藏', has_content: true, source_code: 'cbeta', score: 471.8 },
      ],
    };

    globalThis.fetch = vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes('/api/fetch-proxy') && url.includes('fojin.app%2Fapi%2Fsearch')) {
        return new Response(JSON.stringify(fojinResults), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as any;

    const result = await searchNovelSources('heart sutra', settings);

    expect(enrichmentCallCount).toBe(1);
    expect(result.rawSources).toHaveLength(3);

    // Recommended (id=9, Xuanzang's T0251) sorts first regardless of FoJin score order.
    expect(result.rawSources[0].url).toBe('https://fojin.app/texts/9/read?juan=1');
    expect(result.rawSources[0].matchedTitle).toContain('★ Recommended');
    expect(result.rawSources[0].matchedTitle).toContain('般若波羅蜜多心經');
    expect(result.rawSources[0].confidence).toBe(1);
    expect(result.rawSources[0].whyThisMatches).toContain('Xuanzang');

    // Other enriched cards still have descriptions, no star, and original metadata appended.
    const commentary = result.rawSources.find((c) => c.url.includes('/texts/7884/'));
    expect(commentary?.whyThisMatches).toContain('Commentary');
    expect(commentary?.matchedTitle).not.toContain('★');
  });

  it('skips FoJin search when LLM returns no titleZh', async () => {
    identityResponse = {
      identity: { titleZh: null, titleEn: 'Some random query', authorZh: null, aliases: [] },
      rawSources: [],
      fanTranslations: [],
    };

    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    globalThis.fetch = fetchMock as any;

    const result = await searchNovelSources('random query that resolves nothing', settings);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(enrichmentCallCount).toBe(0);
    expect(result.rawSources).toHaveLength(0);
  });

  it('merges FoJin results above LLM novel candidates by confidence', async () => {
    identityResponse = {
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
    enrichmentResponse = { candidates: [] }; // no recommendations

    const fojinResults = {
      total: 1,
      results: [
        { id: 42, cbeta_id: null, title_zh: '某小說 (Buddhist match)', translator: null, dynasty: null, category: null, has_content: true, source_code: 'cbeta', score: 200 },
      ],
    };

    globalThis.fetch = vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes('/api/fetch-proxy') && url.includes('fojin.app%2Fapi%2Fsearch')) {
        return new Response(JSON.stringify(fojinResults), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as any;

    const result = await searchNovelSources('某小說', settings);

    expect(result.rawSources).toHaveLength(2);
    expect(result.rawSources[0].url).toContain('fojin.app');
    expect(result.rawSources[1].url).toBe('https://example-novel.com/book/1');
  });

  it('returns LLM-only results when FoJin search fails', async () => {
    identityResponse = {
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
    expect(enrichmentCallCount).toBe(0); // no enrichment when no FoJin hits
  });

  it('caps recommended count at one even if LLM marks multiple', async () => {
    identityResponse = {
      identity: { titleZh: '般若波羅蜜多心經', titleEn: 'Heart Sutra', authorZh: null, aliases: [] },
      rawSources: [],
      fanTranslations: [],
    };
    enrichmentResponse = {
      candidates: [
        { id: 9, englishDescription: 'First.', recommended: true },
        { id: 6504, englishDescription: 'Second.', recommended: true }, // should be ignored
      ],
    };

    const fojinResults = {
      total: 2,
      results: [
        { id: 9, cbeta_id: 'T0251', title_zh: 'A', translator: '玄奘', dynasty: '唐', category: null, has_content: true, source_code: 'cbeta', score: 100 },
        { id: 6504, cbeta_id: 'T0253', title_zh: 'B', translator: '般若', dynasty: '唐', category: null, has_content: true, source_code: 'cbeta', score: 100 },
      ],
    };

    globalThis.fetch = vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes('/api/fetch-proxy') && url.includes('fojin.app%2Fapi%2Fsearch')) {
        return new Response(JSON.stringify(fojinResults), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as any;

    const result = await searchNovelSources('heart sutra', settings);
    const recommended = result.rawSources.filter((c) => c.matchedTitle.includes('★'));
    expect(recommended).toHaveLength(1);
    expect(recommended[0].url).toContain('/texts/9/');
  });
});
