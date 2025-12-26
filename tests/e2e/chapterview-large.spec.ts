import { test, expect } from '@playwright/test';
import { importSessionFromFile, prepareFreshApp } from './helpers/sessionHarness';

const buildLargeTranslationHtml = (paragraphCount: number, fillerRepeat: number): string => {
  const filler = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(fillerRepeat).trim();
  const paragraphs: string[] = [];
  for (let i = 0; i < paragraphCount; i += 1) {
    paragraphs.push(`Paragraph ${i + 1}: ${filler}`);
  }
  return paragraphs.join('<br><br>');
};

test.describe('ChapterView (E2E) — Large Translation + Diff Navigation', () => {
  // This spec does a fresh app boot + session import; give the beforeEach enough headroom
  // when running alongside other parallel E2E tests.
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    await prepareFreshApp(page, {
      // Enable diff heatmap to validate marker layout in real browser geometry.
      appSettings: { showDiffHeatmap: true },
    });
  });

  test('imports a large session and renders within a reasonable time', async ({ page }) => {
    const chapterId = 'fixture-large-chapter';
    const paragraphCount = 120;
    const translation = buildLargeTranslationHtml(paragraphCount, 12);

    const sessionData = {
      metadata: { format: 'lexiconforge-full-1', exportedAt: new Date().toISOString() },
      settings: null,
      urlMappings: [],
      novels: [],
      promptTemplates: [],
      amendmentLogs: [],
      chapters: [
        {
          stableId: chapterId,
          url: 'https://example.com/large',
          canonicalUrl: 'https://example.com/large',
          title: 'Large Fixture Chapter',
          content: 'Raw content (fixture)',
          nextUrl: null,
          prevUrl: null,
          chapterNumber: 1,
          fanTranslation: null,
          feedback: [],
          translations: [
            {
              id: 'translation-1',
              version: 1,
              translatedTitle: 'Large Fixture Chapter',
              translation,
              proposal: null,
              footnotes: [],
              suggestedIllustrations: [],
              usageMetrics: {
                totalTokens: 100,
                promptTokens: 60,
                completionTokens: 40,
                estimatedCost: 0.0,
                requestTime: 0,
                provider: 'Gemini',
                model: 'gemini-2.5-flash',
              },
              provider: 'Gemini',
              model: 'gemini-2.5-flash',
              temperature: 0.7,
              systemPrompt: 'fixture',
              promptId: null,
              promptName: null,
              isActive: true,
              createdAt: new Date().toISOString(),
            },
          ],
        },
      ],
      diffResults: [
        {
          chapterId,
          aiVersionId: 'ai-v1',
          fanVersionId: null,
          rawVersionId: 'raw-v1',
          algoVersion: '1.0.0',
          analyzedAt: Date.now(),
          costUsd: 0,
          model: 'gpt-4o-mini',
          markers: [
            {
              chunkId: 'fixture-marker-0',
              colors: ['blue'],
              reasons: ['fan-divergence'],
              explanations: ['Fixture marker'],
              aiRange: { start: 0, end: 10 },
              position: 0,
            },
            {
              chunkId: 'fixture-marker-mid',
              colors: ['orange'],
              reasons: ['raw-divergence'],
              explanations: ['Fixture marker'],
              aiRange: { start: 0, end: 10 },
              position: 60,
            },
            {
              chunkId: 'fixture-marker-last',
              colors: ['grey'],
              reasons: ['stylistic'],
              explanations: ['Fixture marker'],
              aiRange: { start: 0, end: 10 },
              position: 119,
            },
          ],
        },
      ],
    };

    const t0 = Date.now();
    await importSessionFromFile(page, sessionData);

    await page
      .locator('span[data-lf-type="text"][data-lf-chunk]')
      .first()
      .waitFor({ state: 'visible' });

    const ms = Date.now() - t0;
    console.log(`[E2E] Large session import+render took ${ms}ms`);
    expect(ms).toBeLessThan(15_000);

    const paragraphs = page.locator('[data-testid^="diff-paragraph-"]');
    await expect(paragraphs).toHaveCount(paragraphCount);

    const pips = page.locator('[data-testid^="diff-pip-"]');
    await expect(pips).toHaveCount(3);

    // Clicking a later marker should scroll the corresponding paragraph into view.
    const lastPip = pips.nth(2);
    const pos = await lastPip.getAttribute('data-diff-position');
    expect(pos).toBe('119');

    const lastPara = page.locator(`[data-testid^="diff-paragraph-"][data-diff-position=\"${pos}\"]`);
    await lastPip.locator('button').first().click();

    // Verify the paragraph intersects viewport (scroll happened).
    await expect
      .poll(async () => {
        return await lastPara.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const vh = window.innerHeight || document.documentElement.clientHeight;
          return r.bottom > 0 && r.top < vh;
        });
      }, { timeout: 5_000 })
      .toBe(true);
  });
});

