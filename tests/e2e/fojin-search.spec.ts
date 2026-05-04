/**
 * E2E: FoJin search-and-load flow
 *
 * Verifies the full user journey for reading a Buddhist text:
 *   1. User types an English query ("heart sutra") in the library search bar
 *   2. LLM resolves identity → returns canonical Chinese title
 *   3. App queries FoJin's /api/search via the local fetch-proxy
 *   4. User clicks a result card
 *   5. Chapter is fetched via FoJin's /api/texts/{id}/juans/{n} (through proxy chain)
 *   6. Chapter content renders
 *
 * All external HTTP is mocked via page.route():
 *   - openrouter.ai (LLM identity resolution)
 *   - any URL containing fojin.app (covers local proxy AND external CORS proxy paths)
 *
 * The test does NOT call real APIs — it exercises the full UI wiring with
 * deterministic fixtures.
 */

import { test, expect, type Page, type Route } from '@playwright/test';
import { prepareFreshApp } from './helpers/sessionHarness';

const HEART_SUTRA_CONTENT = '觀自在菩薩，行深般若波羅蜜多時，照見五蘊皆空，度一切苦厄。';

const LLM_IDENTITY_RESPONSE = {
  identity: {
    titleZh: '般若波羅蜜多心經',
    titleEn: 'Heart Sutra',
    authorZh: '玄奘',
    aliases: ['Prajñāpāramitāhṛdaya'],
  },
  rawSources: [],
  fanTranslations: [],
};

const FOJIN_SEARCH_RESPONSE = {
  total: 5,
  page: 1,
  size: 20,
  results: [
    {
      id: 9,
      taisho_id: 'T0251',
      cbeta_id: 'T0251',
      title_zh: '般若波羅蜜多心經',
      translator: '玄奘',
      dynasty: '唐',
      category: '大正藏',
      cbeta_url: 'https://cbetaonline.dila.edu.tw/zh/T0251',
      has_content: true,
      source_code: 'cbeta',
      score: 505.8,
      highlight: { title_zh: ['<em>般若波羅蜜多心經</em>'] },
      related_translations: [],
    },
    {
      id: 6504,
      taisho_id: 'T0252',
      cbeta_id: 'T0252',
      title_zh: '般若波羅蜜多心經',
      translator: '般若共利言等',
      dynasty: '唐',
      category: '大正藏',
      cbeta_url: 'https://cbetaonline.dila.edu.tw/zh/T0252',
      has_content: true,
      source_code: 'cbeta',
      score: 505.8,
      highlight: { title_zh: ['<em>般若波羅蜜多心經</em>'] },
      related_translations: [],
    },
  ],
};

const FOJIN_JUAN_RESPONSE = {
  text_id: 9,
  cbeta_id: 'T0251',
  title_zh: '般若波羅蜜多心經',
  juan_num: 1,
  total_juans: 1,
  content: HEART_SUTRA_CONTENT,
  char_count: HEART_SUTRA_CONTENT.length,
  lang: 'lzh',
  prev_juan: null,
  next_juan: null,
};

const FOJIN_TEXT_META_RESPONSE = {
  id: 9,
  taisho_id: 'T0251',
  cbeta_id: 'T0251',
  title_zh: '般若波羅蜜多心經',
  translator: '玄奘',
  dynasty: '唐',
  fascicle_count: 1,
  category: '大正藏',
  has_content: true,
  content_char_count: HEART_SUTRA_CONTENT.length,
  lang: 'lzh',
};

/**
 * Build an OpenRouter chat completions response wrapping our LLM payload as
 * the assistant message.
 */
function buildOpenRouterCompletion(payload: unknown) {
  return {
    id: 'chatcmpl-test-fojin-e2e',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'mock-model',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: JSON.stringify(payload) },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  };
}

/**
 * Determine which FoJin API endpoint a request targets by inspecting the URL,
 * even if it's wrapped by a CORS proxy (URL-encoded inside a `?url=` param or
 * appended to the proxy path).
 */
function classifyFojinRequest(rawUrl: string): 'search' | 'juan' | 'meta' | 'unknown' {
  const decoded = (() => {
    try { return decodeURIComponent(rawUrl); } catch { return rawUrl; }
  })();
  // Decode twice in case of double-encoding through proxy chains
  const doubleDecoded = (() => {
    try { return decodeURIComponent(decoded); } catch { return decoded; }
  })();
  const haystack = `${rawUrl}\n${decoded}\n${doubleDecoded}`;

  if (haystack.includes('fojin.app/api/search') || haystack.includes('fojin.app%2Fapi%2Fsearch')) {
    return 'search';
  }
  if (/fojin\.app(?:%2F|\/)api(?:%2F|\/)texts(?:%2F|\/)\d+(?:%2F|\/)juans/.test(haystack)) {
    return 'juan';
  }
  if (/fojin\.app(?:%2F|\/)api(?:%2F|\/)texts(?:%2F|\/)\d+(?:[?#]|$)/.test(haystack)) {
    return 'meta';
  }
  return 'unknown';
}

const LLM_ENRICHMENT_RESPONSE = {
  candidates: [
    {
      id: 9,
      englishDescription: "Xuanzang's famous short version, the one most commonly recited in East Asia.",
      recommended: true,
    },
    {
      id: 6504,
      englishDescription: 'Long version with narrative framing; less commonly recited.',
      recommended: false,
    },
  ],
};

async function setupFojinMocks(page: Page) {
  // Mock OpenRouter chat completions. Two distinct LLM calls happen during a
  // Buddhist-text search: identity resolution, then candidate enrichment.
  // We pick which canned response to return based on the system prompt.
  await page.route('**/openrouter.ai/api/v1/chat/completions', async (route: Route) => {
    let body: any;
    try {
      body = JSON.parse(route.request().postData() || '{}');
    } catch {
      body = {};
    }
    const systemMsg = (body.messages || []).find((m: any) => m.role === 'system')?.content || '';
    const isEnrichment = typeof systemMsg === 'string' && systemMsg.includes('disambiguating');
    const payload = isEnrichment ? LLM_ENRICHMENT_RESPONSE : LLM_IDENTITY_RESPONSE;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildOpenRouterCompletion(payload)),
    });
  });

  // OpenRouter SDK probes the /models endpoint on init in some flows; stub it.
  await page.route('**/openrouter.ai/api/v1/models**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });

  // Match anything containing "fojin.app" (handles local proxy /api/fetch-proxy?url=...
  // AND external CORS proxies that wrap the URL in their own query/path).
  await page.route(
    (url) => {
      const s = url.toString();
      return s.includes('fojin.app') || s.includes('fojin.app%2F') || s.includes('fojin.app%252F');
    },
    async (route: Route) => {
      const requestUrl = route.request().url();
      const kind = classifyFojinRequest(requestUrl);
      const responseHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json; charset=utf-8',
      };

      switch (kind) {
        case 'search':
          await route.fulfill({
            status: 200,
            headers: responseHeaders,
            body: JSON.stringify(FOJIN_SEARCH_RESPONSE),
          });
          return;
        case 'juan':
          await route.fulfill({
            status: 200,
            headers: responseHeaders,
            body: JSON.stringify(FOJIN_JUAN_RESPONSE),
          });
          return;
        case 'meta':
          await route.fulfill({
            status: 200,
            headers: responseHeaders,
            body: JSON.stringify(FOJIN_TEXT_META_RESPONSE),
          });
          return;
        default:
          // Don't fail the request — let it pass through to allow the test to
          // surface unexpected callers in trace logs.
          await route.continue();
      }
    }
  );
}

// FoJin e2e tests share state through the dev server (single Vite instance,
// registry fetches to GitHub raw with rate limits, etc.). Running them in
// parallel against a default-config Playwright produces flaky failures even
// when each test is correct. Force serial within this file; cross-file
// parallelism between fojin specs is also disabled via fojin-e2e-serial
// project (see playwright.config.ts).
test.describe.configure({ mode: 'serial' });

test.describe('FoJin search-and-load E2E', () => {
  test('searches "heart sutra" → loads Heart Sutra content', async ({ page }) => {
    // Capture interesting console output for post-mortem.
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

    // Pre-seed an OpenRouter API key so the LLM call doesn't bail out for
    // "missing key" before we get a chance to intercept the network call.
    await prepareFreshApp(page, {
      appSettings: {
        provider: 'OpenRouter',
        model: 'mock-model',
        apiKeyOpenRouter: 'sk-test-mock-key',
      },
    });

    await setupFojinMocks(page);

    // Drive the search input on the landing page.
    const searchInput = page.getByPlaceholder(/Search by title or author/i);
    await expect(searchInput).toBeVisible();
    await searchInput.fill('heart sutra');
    await searchInput.press('Enter');

    // Wait for the resolved-identity card (proves the LLM mock fired AND
    // FoJin search results were merged in).
    await expect(page.getByText('般若波羅蜜多心經').first()).toBeVisible({ timeout: 15_000 });

    // Enrichment ran — the recommended Xuanzang version should be flagged.
    await expect(page.getByText(/★ Recommended/).first()).toBeVisible({ timeout: 5_000 });
    // English disambiguation should be visible (no longer just Chinese metadata).
    await expect(page.getByText(/Xuanzang/).first()).toBeVisible();

    // Click the recommended FoJin result card.
    const resultCard = page
      .locator('button')
      .filter({ hasText: '★ Recommended' })
      .first();
    await expect(resultCard).toBeVisible();
    await resultCard.click();

    // Confirm "Add to Library" then proceed.
    const addToLibrary = page.getByRole('button', { name: /Add to Library/i });
    await expect(addToLibrary).toBeVisible({ timeout: 5_000 });
    await addToLibrary.click();

    // Wait for the chapter to load — the title is the strongest signal.
    await expect(page.getByRole('heading', { name: '般若波羅蜜多心經', level: 1 }))
      .toBeVisible({ timeout: 30_000 });

    // The view defaults to 'english' which triggers auto-translate with our
    // mocked LLM (which only returns the identity-resolution payload, not a
    // valid translation). Click "Original" to render the canned source content.
    const originalTab = page.getByRole('button', { name: 'Original', exact: true });
    await expect(originalTab).toBeVisible({ timeout: 5_000 });
    await originalTab.click();

    // Verify the actual Heart Sutra content rendered in the chapter body.
    const contentArea = page.locator('[data-translation-content]');
    await expect(contentArea).toContainText(HEART_SUTRA_CONTENT.slice(0, 12), { timeout: 10_000 });

    // No console errors should have leaked through (filter benign ones).
    const significantErrors = errors.filter(
      (e) =>
        !e.includes('Failed to load resource') &&
        !e.includes('favicon') &&
        !e.toLowerCase().includes('rate limit')
    );
    expect(significantErrors, `Console errors during flow:\n${significantErrors.join('\n')}`).toEqual([]);
  });
});
