import { test, expect, type Page, type Route } from '@playwright/test';
import { prepareFreshApp } from './helpers/sessionHarness';

const HETUSHU_INDEX_URL = 'https://hetushu.com/book/2991/index.html';
const HETUSHU_TITLE = 'Chapter 1: The Beginning';
const HETUSHU_CONTENT = 'This is the first mocked Hetushu paragraph.';

function decodedUrl(rawUrl: string): string {
  let current = rawUrl;
  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }
  return current;
}

async function setupHetushuMocks(page: Page) {
  await page.route(
    (url) => {
      const s = url.toString();
      return s.includes('hetushu.com') || s.includes('hetushu.com%2F') || s.includes('hetushu.com%252F');
    },
    async (route: Route) => {
      const target = decodedUrl(route.request().url());
      const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' };

      if (target.includes('/book/2991/index.html')) {
        await route.fulfill({
          status: 200,
          headers,
          body: `
            <!doctype html>
            <html>
              <body>
                <div id="dir">
                  <a href="2051039.html">${HETUSHU_TITLE}</a>
                </div>
              </body>
            </html>
          `,
        });
        return;
      }

      if (target.includes('/book/2991/2051039.html')) {
        await route.fulfill({
          status: 200,
          headers,
          body: `
            <!doctype html>
            <html>
              <body>
                <div id="ctitle"><h1 class="title">${HETUSHU_TITLE}</h1></div>
                <div id="content">
                  <h2 class="h2">${HETUSHU_TITLE}</h2>
                  <div>${HETUSHU_CONTENT}</div>
                  <div><big>https://www.hetushu.com</big></div>
                  <div>Second paragraph survives watermark cleanup.</div>
                </div>
                <div id="right">
                  <span class="pre"><a href="2051038.html">Prev</a></span>
                  <a id="next" href="2051040.html">Next</a>
                </div>
              </body>
            </html>
          `,
        });
        return;
      }

      await route.continue();
    }
  );
}

test.describe('stale issue verification', () => {
  test('issue #26: Hetushu URL loads through the app fetch path', async ({ page }) => {
    const hetushuRuntimeErrors: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error' && /hetushu|site adapter|scraping/i.test(text)) {
        hetushuRuntimeErrors.push(text);
      }
    });
    page.on('pageerror', (err) => hetushuRuntimeErrors.push(`pageerror: ${err.message}`));

    await setupHetushuMocks(page);
    await prepareFreshApp(page);

    const input = page.locator('input[placeholder^="Paste chapter URL"]').first();
    await input.fill(HETUSHU_INDEX_URL);
    await input.press('Enter');

    await expect(page.getByRole('heading', { name: HETUSHU_TITLE, level: 1 })).toBeVisible({ timeout: 30_000 });

    const originalTab = page.getByRole('button', { name: 'Original', exact: true });
    await expect(originalTab).toBeVisible({ timeout: 5_000 });
    await originalTab.click();

    const contentArea = page.locator('[data-translation-content]');
    await expect(contentArea).toContainText(HETUSHU_CONTENT, { timeout: 10_000 });
    await expect(contentArea).toContainText('Second paragraph survives watermark cleanup.');
    await expect(contentArea).not.toContainText('hetushu.com');

    expect(
      hetushuRuntimeErrors,
      `Hetushu runtime errors:\n${hetushuRuntimeErrors.join('\n')}`
    ).toEqual([]);
  });

  test('issue #45: citation chips live in audit panel, not hover tooltip footer', async ({ page }) => {
    await page.goto('/sutta/demo', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('MN10 · Pāli').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('label').filter({ hasText: 'Audit panel' }).locator('div').first().click();

    const evaSegment = page.locator('[id="phase-a-seg-a1s1"]').first();
    await expect(evaSegment).toBeVisible({ timeout: 10_000 });

    await evaSegment.hover();
    const evaTooltip = page.getByText(/evaṁ means 'thus; in this way'/).first();
    await expect(evaTooltip).toBeVisible({ timeout: 5_000 });

    const tooltipText = await evaTooltip.innerText();
    expect(tooltipText).toContain("evaṁ means 'thus; in this way'");
    expect(tooltipText).not.toContain('SOURCES');
    expect(tooltipText).not.toContain('DPD');
    expect(tooltipText).not.toContain('Sujato');

    await page.getByText('Thus').first().click();
    await expect(page.getByText('Senses').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('link', { name: /DPD.*↗/ }).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('link', { name: /Sujato.*↗/ }).first()).toBeVisible({ timeout: 5_000 });
  });
});
