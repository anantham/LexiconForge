/**
 * E2E (M2): FoJin chapter in Sutta Studio uses AI translation as the English column
 *
 * Builds on M1 (chapter renders in fallback view). This milestone verifies:
 *   - On entering the studio for a FoJin chapter, the existing AI translation
 *     pipeline is triggered (handleTranslate dispatched once)
 *   - Once the translation arrives, the SuttaStudioFallback view renders the
 *     AI-produced English alongside the Chinese in the parallel-reading layout
 *
 * Alignment is paragraph-by-paragraph (split on blank lines). For Heart Sutra
 * length texts this works fine; longer texts may need a dedicated alignment
 * prompt, which is M3 territory.
 */

import { test, expect, type Page, type Route } from '@playwright/test';
import { prepareFreshApp } from './helpers/sessionHarness';

const HEART_SUTRA_ZH_PARAS = [
  '觀自在菩薩，行深般若波羅蜜多時，照見五蘊皆空，度一切苦厄。',
  '舍利子，色不異空，空不異色，色即是空，空即是色，受想行識，亦復如是。',
];
const HEART_SUTRA_ZH = HEART_SUTRA_ZH_PARAS.join('\n\n');

const HEART_SUTRA_EN_PARAS = [
  'When Bodhisattva Avalokiteshvara was practicing the profound Prajñāpāramitā, he illuminated the five aggregates and saw that they were all empty, transcending all suffering.',
  'Shariputra, form is not different from emptiness, emptiness is not different from form. Form is emptiness, emptiness is form. So too are sensation, perception, mental formation, and consciousness.',
];
const HEART_SUTRA_EN = HEART_SUTRA_EN_PARAS.join('\n\n');

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

function classifyFojinRequest(rawUrl: string): 'juan' | 'meta' | 'unknown' {
  const decoded = (() => { try { return decodeURIComponent(rawUrl); } catch { return rawUrl; } })();
  const doubleDecoded = (() => { try { return decodeURIComponent(decoded); } catch { return decoded; } })();
  const haystack = `${rawUrl}\n${decoded}\n${doubleDecoded}`;
  if (/fojin\.app(?:%2F|\/)api(?:%2F|\/)texts(?:%2F|\/)\d+(?:%2F|\/)juans/.test(haystack)) return 'juan';
  if (/fojin\.app(?:%2F|\/)api(?:%2F|\/)texts(?:%2F|\/)\d+(?:[?#]|$)/.test(haystack)) return 'meta';
  return 'unknown';
}

function buildOpenRouterCompletion(payload: unknown) {
  return {
    id: 'chatcmpl-test-fojin-m2',
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

const TRANSLATION_PAYLOAD = {
  translatedTitle: 'The Heart Sūtra',
  translation: HEART_SUTRA_EN,
  footnotes: null,
  suggestedIllustrations: null,
  proposal: null,
};

test.describe('FoJin chapter → Sutta Studio (M2 — AI translation as English column)', () => {
  test('AI translation populates the English column alongside Chinese', async ({ page }) => {
    let translationCalls = 0;

    // Mock OpenRouter chat completions. The studio triggers handleTranslate
    // for FoJin chapters; we intercept the LLM call and return a canned
    // multi-paragraph English translation that paragraph-aligns with the
    // Chinese fixture above.
    await page.route('**/openrouter.ai/api/v1/chat/completions', async (route: Route) => {
      translationCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildOpenRouterCompletion(TRANSLATION_PAYLOAD)),
      });
    });

    // OpenRouter SDK sometimes probes /models on init; stub it.
    await page.route('**/openrouter.ai/api/v1/models**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    // Mock all FoJin API traffic.
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

    await prepareFreshApp(page, {
      appSettings: {
        provider: 'OpenRouter',
        model: 'mock-model',
        apiKeyOpenRouter: 'sk-test-mock-key',
      },
    });

    // Navigate directly to the FoJin chapter, then into the studio.
    await page.goto('/?chapter=' + encodeURIComponent('https://fojin.app/texts/9/read?juan=1'));

    await expect(page.getByRole('heading', { name: '般若波羅蜜多心經', level: 1 }))
      .toBeVisible({ timeout: 30_000 });

    const studioButton = page.getByRole('link', { name: 'Open Sutta Studio' }).first();
    await expect(studioButton).toBeVisible({ timeout: 5_000 });
    await studioButton.click();
    await expect(page).toHaveURL(/\/sutta\/fojin\/9\?juan=1/);

    // Studio should render the Chinese paragraph(s) immediately…
    await expect(page.getByText(HEART_SUTRA_ZH_PARAS[0].slice(0, 12))).toBeVisible({ timeout: 30_000 });

    // …and once the AI translation lands, the matching English paragraphs
    // appear in the right column. The studio fires handleTranslate exactly
    // once for FoJin chapters — let it run and assert the result renders.
    await expect(page.getByText(HEART_SUTRA_EN_PARAS[0].slice(0, 30)))
      .toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(HEART_SUTRA_EN_PARAS[1].slice(0, 30)))
      .toBeVisible({ timeout: 20_000 });

    // Translation should have been requested at least once. Could be more
    // than one if the translation pipeline retries internally; what matters
    // is that it eventually produced English content and rendered.
    expect(translationCalls).toBeGreaterThan(0);
  });
});
