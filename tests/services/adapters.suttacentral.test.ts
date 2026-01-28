import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAndParseUrl, getSupportedSiteInfo, isUrlSupported } from '../../services/adapters';

const makeResponse = (body: string) => ({
  ok: true,
  status: 200,
  text: async () => body,
  json: async () => JSON.parse(body),
  arrayBuffer: async () => new TextEncoder().encode(body).buffer,
});

describe('SuttaCentral adapter wiring', () => {
  beforeEach(() => {
    if (typeof AbortSignal.timeout !== 'function') {
      (AbortSignal as any).timeout = () => new AbortController().signal;
    }
  });

  it('treats SuttaCentral URLs as supported', () => {
    expect(isUrlSupported('https://suttacentral.net/mn10/en/sujato')).toBe(true);
    const sites = getSupportedSiteInfo();
    const suttaCentral = sites.find((site) => site.domain === 'suttacentral.net');
    expect(suttaCentral).toBeDefined();
    expect(suttaCentral?.example).toContain('suttacentral.net');
  });

  it('parses SuttaCentral URLs and honors query lang override', async () => {
    const plexPayload = [
      {
        translated_title: 'Satipatthana',
        blurb: 'Mindfulness summary',
      },
    ];
    const bilaraPayload = {
      root_text: {
        'mn10:1.1': 'Pali one',
        'mn10:1.2': 'Pali two',
      },
      translation_text: {
        'mn10:1.1': 'Eng one',
        'mn10:1.2': 'Eng two',
      },
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/suttaplex/')) {
        return makeResponse(JSON.stringify(plexPayload));
      }
      if (url.includes('/api/bilarasuttas/')) {
        return makeResponse(JSON.stringify(bilaraPayload));
      }
      return makeResponse('<html></html>');
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as any;

    try {
      const result = await fetchAndParseUrl('https://suttacentral.net/mn10/en/sujato?lang=fr');
      expect(result.title).toBe('Satipatthana');
      expect(result.content).toBe('Pali one\n\nPali two');
      expect(result.fanTranslation).toBe('Eng one\n\nEng two');
      expect(result.blurb).toBe('Mindfulness summary');
      expect(result.targetLanguage).toBe('fr');
      expect(result.nextUrl).toBe('https://suttacentral.net/mn11/fr/sujato');
      expect(result.prevUrl).toBe('https://suttacentral.net/mn9/fr/sujato');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('increments dotted sutta ids for navigation', async () => {
    const plexPayload = [{ translated_title: 'Samyutta' }];
    const bilaraPayload = {
      root_text: {
        'sn1.2:1.1': 'Pali',
      },
      translation_text: {
        'sn1.2:1.1': 'Eng',
      },
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/suttaplex/')) {
        return makeResponse(JSON.stringify(plexPayload));
      }
      if (url.includes('/api/bilarasuttas/')) {
        return makeResponse(JSON.stringify(bilaraPayload));
      }
      return makeResponse('<html></html>');
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as any;

    try {
      const result = await fetchAndParseUrl('https://suttacentral.net/sn1.2/en/sujato');
      expect(result.nextUrl).toBe('https://suttacentral.net/sn1.3/en/sujato');
      expect(result.prevUrl).toBe('https://suttacentral.net/sn1.1/en/sujato');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('uses API endpoints without fetching HTML for SuttaCentral navigation', async () => {
    const plexPayload = [{ translated_title: 'MN11' }];
    const bilaraPayload = {
      root_text: {
        'mn11:1.1': 'Pali',
      },
      translation_text: {
        'mn11:1.1': 'Eng',
      },
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      let decodedUrl = url;
      try {
        decodedUrl = decodeURIComponent(url);
      } catch {
        decodedUrl = url;
      }

      if (decodedUrl.includes('/api/suttaplex/')) {
        return makeResponse(JSON.stringify(plexPayload));
      }
      if (decodedUrl.includes('/api/bilarasuttas/')) {
        return makeResponse(JSON.stringify(bilaraPayload));
      }

      throw new Error(`Unexpected HTML fetch: ${url}`);
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as any;

    try {
      await fetchAndParseUrl('https://suttacentral.net/mn11/en/sujato');
      const calls = fetchMock.mock.calls.map((args) => String(args[0]));
      const htmlCall = calls.find(
        (call) => call.includes('suttacentral.net/mn11/en/sujato') && !call.includes('/api/')
      );
      expect(htmlCall).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
