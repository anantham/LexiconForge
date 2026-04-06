/**
 * Contract tests for fetch transport invariants.
 *
 * INV-2: SuttaCentral must bypass the HTML proxy path entirely.
 * INV-4: TOC redirect logic must be consistent across all transport paths.
 *
 * These tests verify structural properties of the fetcher code by inspecting
 * its behavior with mocked transports. They are expected to FAIL on current
 * main and PASS after the fix.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// We test fetcher behavior by intercepting global fetch and checking
// which URLs it attempts to call.

describe('fetcher.ts — INV-2: SuttaCentral bypasses HTML proxy', () => {
  const fetchCalls: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    fetchCalls.length = 0;

    // Intercept all fetch calls to record URLs
    vi.stubGlobal('fetch', vi.fn(async (input: string | Request, _init?: any) => {
      const url = typeof input === 'string' ? input : input.url;
      fetchCalls.push(url);

      // SuttaCentral API response (valid JSON)
      if (url.includes('suttacentral.net') && url.includes('/api/')) {
        return new Response(JSON.stringify({
          suttaplex: { uid: 'mn10', title: 'Mindfulness' },
          text: '<article><p>Test sutta content</p></article>',
        }), { status: 200 });
      }

      // Local proxy / any proxy — return minimal HTML
      if (url.includes('/api/fetch-proxy') || url.includes('cors')) {
        return new Response('<html><body>proxy html</body></html>', { status: 200 });
      }

      // Default: 404
      return new Response('Not found', { status: 404 });
    }));

    // Mock DOMParser for Node environment
    vi.stubGlobal('DOMParser', class {
      parseFromString(html: string) {
        return { querySelector: () => null, querySelectorAll: () => [], body: { textContent: html } };
      }
    });
  });

  it('should NOT attempt the local HTML proxy for SuttaCentral URLs', async () => {
    // This test will FAIL on current main because fetcher.ts tries the local
    // proxy for ALL URLs before checking if it's SuttaCentral.
    //
    // After the fix, SuttaCentral URLs should go directly to the API path
    // and never touch /api/fetch-proxy.

    try {
      const { fetchAndParseUrl } = await import('../../../services/scraping/fetcher');
      await fetchAndParseUrl('https://suttacentral.net/mn10/en/sujato');
    } catch {
      // May throw due to incomplete mocking — that's OK, we're checking fetch calls
    }

    const localProxyCalls = fetchCalls.filter(url => url.includes('/api/fetch-proxy'));

    // INV-2: No calls to the local HTML proxy for SuttaCentral
    expect(localProxyCalls).toHaveLength(0);
  });

  it('SuttaCentral requests should use the API path (JSON), not HTML scraping', async () => {
    try {
      const { fetchAndParseUrl } = await import('../../../services/scraping/fetcher');
      await fetchAndParseUrl('https://suttacentral.net/mn10/en/sujato');
    } catch {
      // May throw — we're checking the fetch call pattern
    }

    // Should have attempted a SuttaCentral API URL at some point
    const suttaApiCalls = fetchCalls.filter(url =>
      url.includes('suttacentral.net') && !url.includes('/api/fetch-proxy')
    );

    expect(suttaApiCalls.length).toBeGreaterThan(0);
  });
});

describe('fetcher.ts — INV-4: TOC redirect in Playwright fallback', () => {
  /**
   * This test verifies that when the Playwright fallback path fetches a TOC/index
   * page, it calls getRedirectUrl() and follows the redirect to chapter 1.
   *
   * On current main, the Playwright fallback goes straight to extractTitle()/
   * extractContent() without checking getRedirectUrl(). This test should FAIL
   * on current main.
   *
   * We test this structurally: the Playwright path in fetcher.ts should contain
   * a getRedirectUrl() call. This is a code inspection test.
   */
  it('Playwright fallback path should call getRedirectUrl()', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const fetcherSource = fs.readFileSync(
      path.resolve(__dirname, '../../../services/scraping/fetcher.ts'),
      'utf-8'
    );

    // Find the Playwright fallback section
    const playwrightSection = fetcherSource.slice(
      fetcherSource.indexOf('Playwright fallback'),
      fetcherSource.indexOf('Final fallback: attempt direct fetch')
    );

    // It should contain a getRedirectUrl() call
    expect(playwrightSection).toContain('getRedirectUrl');
  });
});
