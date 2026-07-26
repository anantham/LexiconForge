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

describe('fetcher.ts — dead VPS Playwright tier stays removed', () => {
  /**
   * The "Playwright proxy on VPS" fallback tier (PLAYWRIGHT_PROXY_URL →
   * 3-99-221-14.sslip.io) was removed 2026-07-26 after the VPS had been dead
   * ~4 months: the tier could never succeed and burned up to 30s of
   * user-facing latency per scrape that reached it.
   *
   * This structural test replaces the former "INV-4: TOC redirect in
   * Playwright fallback" check (vacuous once the tier is gone) and guards
   * against the dead tier being reintroduced without a health check.
   */
  it('fetcher.ts should not import (nor proxy.ts export) the dead Playwright VPS proxy', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const fetcherSource = fs.readFileSync(
      path.resolve(__dirname, '../../../services/scraping/fetcher.ts'),
      'utf-8'
    );
    const proxySource = fs.readFileSync(
      path.resolve(__dirname, '../../../services/scraping/proxy.ts'),
      'utf-8'
    );

    // Live-code references only — the removal NOTES in both files may still
    // name the constant/host for historical context.
    expect(fetcherSource).not.toMatch(/import[^;]*PLAYWRIGHT_PROXY_URL/s);
    expect(proxySource).not.toMatch(/export\s+const\s+PLAYWRIGHT_PROXY_URL/);
  });
});
