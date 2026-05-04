/**
 * E2E (M1): FoJin chapters open in Sutta Studio
 *
 * Verifies the M1 wiring of the multi-source studio:
 *   1. Load a FoJin chapter (Heart Sutra) directly via URL
 *   2. The Sutta Studio button is visible in the chapter header
 *   3. Click → routes to /sutta/fojin/{textId}?juan={n}
 *   4. SuttaStudioApp recognises the FoJin pattern, skips the SuttaCentral
 *      Pali compiler entirely, and renders the chapter via the fallback view
 *   5. Heart Sutra Chinese content is visible inside the studio
 *
 * M1 scope: just wiring + display. M2 will add 84000 English column;
 * M3 will tackle morphology on non-Pali sources.
 *
 * All FoJin API traffic is mocked (covers local proxy + external CORS proxy
 * variants by matching any URL containing "fojin.app").
 */

import { test, expect, type Page, type Route } from '@playwright/test';
import { prepareFreshApp } from './helpers/sessionHarness';

const HEART_SUTRA_CONTENT = '觀自在菩薩，行深般若波羅蜜多時，照見五蘊皆空，度一切苦厄。';

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

function classifyFojinRequest(rawUrl: string): 'juan' | 'meta' | 'unknown' {
  const decoded = (() => { try { return decodeURIComponent(rawUrl); } catch { return rawUrl; } })();
  const doubleDecoded = (() => { try { return decodeURIComponent(decoded); } catch { return decoded; } })();
  const haystack = `${rawUrl}\n${decoded}\n${doubleDecoded}`;
  if (/fojin\.app(?:%2F|\/)api(?:%2F|\/)texts(?:%2F|\/)\d+(?:%2F|\/)juans/.test(haystack)) {
    return 'juan';
  }
  if (/fojin\.app(?:%2F|\/)api(?:%2F|\/)texts(?:%2F|\/)\d+(?:[?#]|$)/.test(haystack)) {
    return 'meta';
  }
  return 'unknown';
}

async function setupFojinApiMocks(page: Page) {
  await page.route(
    (url) => {
      const s = url.toString();
      return s.includes('fojin.app') || s.includes('fojin.app%2F') || s.includes('fojin.app%252F');
    },
    async (route: Route) => {
      const kind = classifyFojinRequest(route.request().url());
      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json; charset=utf-8',
      };
      if (kind === 'juan') {
        await route.fulfill({ status: 200, headers, body: JSON.stringify(FOJIN_JUAN_RESPONSE) });
        return;
      }
      if (kind === 'meta') {
        await route.fulfill({ status: 200, headers, body: JSON.stringify(FOJIN_TEXT_META_RESPONSE) });
        return;
      }
      await route.continue();
    }
  );
}

test.describe.configure({ mode: 'serial' });

test.describe('FoJin chapter → Sutta Studio (M1)', () => {
  test('button appears, click routes to /sutta/fojin/, studio renders Chinese', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

    await prepareFreshApp(page, {
      appSettings: {
        provider: 'OpenRouter',
        model: 'mock-model',
        apiKeyOpenRouter: 'sk-test-mock-key',
      },
    });

    await setupFojinApiMocks(page);

    // Navigate directly to the chapter via the URL bar — bypasses the search
    // flow (which has its own e2e). This loads the FoJin Heart Sutra chapter
    // through the normal fetch path.
    await page.goto('/?chapter=' + encodeURIComponent('https://fojin.app/texts/9/read?juan=1'));

    // Chapter header rendered with the canonical title
    await expect(page.getByRole('heading', { name: '般若波羅蜜多心經', level: 1 }))
      .toBeVisible({ timeout: 30_000 });

    // The Sutta Studio button (titled "Open Sutta Studio") should now be
    // present for FoJin chapters too — previously it was gated to suttacentral.net.
    const studioButton = page.getByRole('link', { name: 'Open Sutta Studio' }).first();
    await expect(studioButton).toBeVisible({ timeout: 5_000 });
    await expect(studioButton).toHaveAttribute('href', '/sutta/fojin/9?juan=1');

    // Click → navigate into Sutta Studio
    await studioButton.click();
    await expect(page).toHaveURL(/\/sutta\/fojin\/9\?juan=1/);

    // The Pali compiler is skipped for FoJin — fallback view should render
    // the chapter content directly. Heart Sutra text must appear.
    await expect(page.getByText(HEART_SUTRA_CONTENT.slice(0, 12)))
      .toBeVisible({ timeout: 30_000 });

    // No errors from the studio path itself. Filter out unrelated noise:
    // - registry fetch failures (test env has no GitHub access; registry is
    //   loaded by the landing page's NovelLibrary, not the studio)
    // - resource/favicon/rate-limit noise.
    const significantErrors = errors.filter(
      (e) =>
        !e.includes('Failed to load resource') &&
        !e.includes('favicon') &&
        !e.toLowerCase().includes('rate limit') &&
        !e.includes('registry') &&
        !e.includes('Registry') &&
        !e.includes('lexiconforge-novels') &&
        !e.includes('raw.githubusercontent.com')
    );
    expect(significantErrors, `Console errors during flow:\n${significantErrors.join('\n')}`).toEqual([]);
  });
});
