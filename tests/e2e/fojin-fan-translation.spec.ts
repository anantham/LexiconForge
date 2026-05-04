/**
 * E2E: Fan-translation flow end-to-end
 *
 * Verifies the three pieces from commit 7de46d9 working together:
 *   1. URL probe drops hallucinated fan cards (SuttaCentral for Heart Sutra)
 *   2. Real fan card (84000.co) survives the probe
 *   3. Selecting raw + fan, clicking "Add to Library", actually fetches the
 *      fan content and attaches it as chapter.fanTranslation
 *   4. Sutta Studio renders the 84000 English in the parallel column
 *      (not the auto-AI translation) because chapter.fanTranslation is
 *      preferred by the fallback view
 *
 * Mock surface:
 *   - OpenRouter (3 distinct call types: identity, enrichment, translation)
 *   - FoJin API (search + juan + meta)
 *   - 84000.co (probe via /api/fetch-proxy returning HTML; same proxy URL
 *     is also hit for the content fetch, so the same response works)
 *   - SuttaCentral (probe returns 404 → card dropped)
 */

import { test, expect, type Page, type Route } from '@playwright/test';
import { prepareFreshApp } from './helpers/sessionHarness';

const HEART_SUTRA_ZH = '觀自在菩薩，行深般若波羅蜜多時，照見五蘊皆空，度一切苦厄。';
const HEART_SUTRA_84000_EN =
  'When the bodhisattva Avalokita was practicing the profound Perfection of Wisdom, he illuminated the five aggregates and saw that they are empty of inherent existence — academic-translation-marker-do-not-collide.';

// --- FoJin fixtures ---

const FOJIN_SEARCH_RESPONSE = {
  total: 1,
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
  ],
};

const FOJIN_JUAN_RESPONSE = {
  text_id: 9,
  cbeta_id: 'T0251',
  title_zh: '般若波羅蜜多心經',
  juan_num: 1,
  total_juans: 1,
  content: HEART_SUTRA_ZH,
  char_count: HEART_SUTRA_ZH.length,
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
  has_content: true,
  lang: 'lzh',
};

// --- LLM payloads ---

const LLM_IDENTITY_RESPONSE = {
  identity: {
    titleZh: '般若波羅蜜多心經',
    titleEn: 'Heart Sutra',
    authorZh: '玄奘',
    aliases: ['Prajñāpāramitāhṛdaya'],
  },
  rawSources: [],
  fanTranslations: [
    {
      site: '84000',
      url: 'https://84000.co/translation/toh21',
      matchedTitle: 'The Heart of the Perfection of Wisdom',
      matchedAuthor: '84000 Translation Team',
      sourceType: 'official',
      chapterCount: null,
      status: 'completed',
      confidence: 0.95,
      whyThisMatches: 'Official academic translation of the canonical text.',
    },
    // This one is the LLM's hallucination — SC doesn't actually have the
    // Heart Sutra. Probe should drop it before the user sees the card.
    {
      site: 'SuttaCentral',
      url: 'https://suttacentral.net/heart-sutra/en/sujato',
      matchedTitle: 'Heart Sutra',
      matchedAuthor: null,
      sourceType: 'official',
      chapterCount: null,
      status: null,
      confidence: 0.85,
      whyThisMatches: 'Reliable scholarly repository for Buddhist texts.',
    },
  ],
};

const LLM_ENRICHMENT_RESPONSE = {
  candidates: [
    {
      id: 9,
      englishDescription: "Xuanzang's famous short version, the one most commonly recited in East Asia.",
      recommended: true,
    },
  ],
};

// In case auto-translate fires after the chapter is loaded, give it a
// recognisable response so it doesn't error and so we can prove the studio
// is showing 84000's text rather than this one.
const LLM_AUTO_TRANSLATE_RESPONSE = {
  translatedTitle: 'Auto-translated Heart Sutra (NOT the fan translation)',
  translation: 'auto-translation-marker-do-not-collide — this is the AI auto-translation, not the 84000 academic version.',
  footnotes: null,
  suggestedIllustrations: null,
  proposal: null,
};

// --- 84000 HTML fixture (what Site84000Adapter expects to scrape) ---

const SITE_84000_HTML = `<!DOCTYPE html>
<html><head><title>The Heart of the Perfection of Wisdom</title></head>
<body class="reading-room translation complete default-mode">
  <h1 class="panel-row title main-title"><span>The Heart of the Perfection of Wisdom, the Blessed Mother</span></h1>
  <section id="UT22084-034-009-summary" class="part-type-summary"><p>Summary apparatus that should NOT appear.</p></section>
  <section id="UT22084-034-009-section-1" class="part-type-section text page tei-parser preview relative">
    <p id="node-35">${HEART_SUTRA_84000_EN}</p>
  </section>
  <section id="UT22084-034-009-end-notes" class="part-type-end-notes"><p>End-notes apparatus that should NOT appear.</p></section>
</body></html>`;

// --- Helpers ---

function buildOpenRouterCompletion(payload: unknown) {
  return {
    id: 'chatcmpl-test-fan',
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

function classifyFojinRequest(rawUrl: string): 'search' | 'juan' | 'meta' | 'unknown' {
  const decoded = (() => { try { return decodeURIComponent(rawUrl); } catch { return rawUrl; } })();
  const doubleDecoded = (() => { try { return decodeURIComponent(decoded); } catch { return decoded; } })();
  const haystack = `${rawUrl}\n${decoded}\n${doubleDecoded}`;
  if (haystack.includes('fojin.app/api/search') || haystack.includes('fojin.app%2Fapi%2Fsearch')) return 'search';
  if (/fojin\.app(?:%2F|\/)api(?:%2F|\/)texts(?:%2F|\/)\d+(?:%2F|\/)juans/.test(haystack)) return 'juan';
  if (/fojin\.app(?:%2F|\/)api(?:%2F|\/)texts(?:%2F|\/)\d+(?:[?#]|$)/.test(haystack)) return 'meta';
  return 'unknown';
}

test.describe('Fan-translation flow E2E', () => {
  test('probe drops hallucinated SC card; selecting 84000 fan attaches its English to the studio column', async ({ page }) => {
    let llmCalls: { identity: number; enrichment: number; translation: number } = {
      identity: 0, enrichment: 0, translation: 0,
    };
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

    // OpenRouter — distinguish three LLM call types by system-prompt content.
    await page.route('**/openrouter.ai/api/v1/chat/completions', async (route: Route) => {
      let body: any;
      try { body = JSON.parse(route.request().postData() || '{}'); } catch { body = {}; }
      const systemMsg = (body.messages || []).find((m: any) => m.role === 'system')?.content || '';
      const sys = typeof systemMsg === 'string' ? systemMsg : '';

      let payload: unknown;
      if (sys.includes('disambiguating')) {
        llmCalls.enrichment += 1;
        payload = LLM_ENRICHMENT_RESPONSE;
      } else if (sys.includes('source finder') || sys.includes('Buddhist scripture')) {
        llmCalls.identity += 1;
        payload = LLM_IDENTITY_RESPONSE;
      } else {
        // Anything else — including the auto-translate prompt — gets a
        // recognisable translation-shaped response so the pipeline doesn't
        // error. Test asserts the studio shows the 84000 text, NOT this one.
        llmCalls.translation += 1;
        payload = LLM_AUTO_TRANSLATE_RESPONSE;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildOpenRouterCompletion(payload)),
      });
    });
    await page.route('**/openrouter.ai/api/v1/models**', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });

    // FoJin: search + juan content + text metadata.
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
        if (kind === 'search') {
          await route.fulfill({ status: 200, headers, body: JSON.stringify(FOJIN_SEARCH_RESPONSE) });
          return;
        }
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

    // 84000 — both the probe AND the content fetch hit /api/fetch-proxy?url=
    // wrapping the same 84000 URL. Returning the HTML body for both is fine:
    // probe checks status only, adapter parses HTML.
    await page.route(
      (url) => {
        const s = url.toString();
        return s.includes('84000.co') || s.includes('84000.co%2F') || s.includes('84000.co%252F');
      },
      async (route: Route) => {
        await route.fulfill({
          status: 200,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/html; charset=utf-8' },
          body: SITE_84000_HTML,
        });
      }
    );

    // SuttaCentral — probe returns 404, card must be dropped before reaching UI.
    await page.route(
      (url) => {
        const s = url.toString();
        return s.includes('suttacentral.net') || s.includes('suttacentral.net%2F') || s.includes('suttacentral.net%252F');
      },
      async (route: Route) => {
        await route.fulfill({
          status: 404,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain' },
          body: 'Not Found',
        });
      }
    );

    await prepareFreshApp(page, {
      appSettings: {
        provider: 'OpenRouter',
        model: 'mock-model',
        apiKeyOpenRouter: 'sk-test-mock-key',
      },
    });

    // 1. Search.
    const searchInput = page.getByPlaceholder(/Search by title or author/i);
    await searchInput.fill('heart sutra');
    await searchInput.press('Enter');

    // 2. Wait for results, then assert SC card was probe-dropped.
    await expect(page.getByText('★ Recommended').first()).toBeVisible({ timeout: 15_000 });
    // Only ONE fan card should be visible (84000). SuttaCentral was 404'd by the probe.
    const fanCards = page.locator('button').filter({ hasText: /84000|SuttaCentral/ });
    await expect(fanCards).toHaveCount(1, { timeout: 5_000 });
    await expect(fanCards.first()).toContainText('84000');

    // 3. Select raw + fan.
    await page.locator('button').filter({ hasText: '★ Recommended' }).first().click();
    await fanCards.first().click();

    // 4. Click "Add to Library (Raw + Fan Translation)".
    const addBtn = page.getByRole('button', { name: /Add to Library.*Raw \+ Fan Translation/i });
    await expect(addBtn).toBeVisible({ timeout: 5_000 });
    await addBtn.click();

    // 5. Wait for chapter to load.
    await expect(page.getByRole('heading', { name: '般若波羅蜜多心經', level: 1 }))
      .toBeVisible({ timeout: 30_000 });

    // 6. Open Sutta Studio.
    const studioBtn = page.getByRole('link', { name: 'Open Sutta Studio' }).first();
    await expect(studioBtn).toBeVisible({ timeout: 10_000 });
    await studioBtn.click();
    await expect(page).toHaveURL(/\/sutta\/fojin\/9/);

    // 7. Studio must render the 84000 academic English (NOT the AI auto-translation).
    // The marker strings are designed not to overlap so we can tell which text
    // ended up in the parallel column.
    await expect(page.getByText(/academic-translation-marker-do-not-collide/))
      .toBeVisible({ timeout: 20_000 });
    // The auto-translate marker must NOT appear — fanTranslation takes
    // priority in the studio fallback view.
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('auto-translation-marker-do-not-collide');

    // Sanity: identity LLM was called exactly once; enrichment may or may not
    // fire depending on whether FoJin returned hits (it did — 1).
    expect(llmCalls.identity).toBeGreaterThanOrEqual(1);

    // No console errors should leak through (filter unrelated noise).
    const significant = errors.filter(
      (e) => !e.includes('Failed to load resource')
        && !e.includes('favicon')
        && !e.includes('registry')
        && !e.includes('Registry')
        && !e.includes('lexiconforge-novels')
        && !e.includes('raw.githubusercontent.com')
    );
    expect(significant, `Console errors during flow:\n${significant.join('\n')}`).toEqual([]);
  });
});
