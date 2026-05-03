/**
 * Reproduction harness for Issue #1 (boot time).
 *
 * Goal: verify the symptom from Issues.md - "Total init time" ~31s on a
 * fresh IndexedDB when the URL has a deep-link query (?novel=...).
 *
 * Three scenarios:
 *   A. cold cache, no deep link        - establishes baseline
 *   B. cold cache, ?novel=FMC          - the painful path the user reported
 *   C. warm cache, ?novel=FMC          - what the second visit looks like
 *
 * Run:
 *   npx playwright test issues/01-bootup-time/traces/repro.spec.ts \
 *     --config=playwright.config.ts --project=chromium --reporter=list
 *
 * Artifacts:
 *   - JSON written next to this file as repro-result.json
 */
import { test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RESULT_PATH = path.resolve(HERE, 'repro-result.json');

interface CapturedRun {
  scenario: string;
  url: string;
  marks: { raw: string; ts: number }[];
  totalInitMs: number | null;
  beginCount: number;
  skippedCount: number;
  consoleErrors: string[];
  pageErrors: string[];
  navTime: number;
}

const NOVEL_ID = 'forty-millenniums-of-cultivation';
const TOTAL_INIT_RE = /Total init time:\s+(\d+)ms/;
const STORE_INIT_RE = /\[Store:init\s+\+(\d+)ms\s+/;

const collected: CapturedRun[] = [];
function appendResult(r: CapturedRun) {
  collected.push(r);
  try {
    fs.writeFileSync(RESULT_PATH, JSON.stringify(collected, null, 2));
  } catch { /* ignore */ }
}

async function runScenario(page: any, scenario: string, urlPath: string): Promise<CapturedRun> {
  const marks: CapturedRun['marks'] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  let totalInitMs: number | null = null;
  let beginCount = 0;
  let skippedCount = 0;

  page.on('console', (msg: any) => {
    const text = msg.text();
    const ts = Date.now();
    if (STORE_INIT_RE.test(text)) {
      marks.push({ raw: text, ts });
      if (text.includes('initializeStore - begin') || text.includes('initializeStore – begin')) beginCount++;
      if (text.includes('initializeStore - skipped') || text.includes('initializeStore – skipped')) skippedCount++;
    }
    const m = TOTAL_INIT_RE.exec(text);
    if (m) totalInitMs = parseInt(m[1], 10);
    if (msg.type() === 'error') consoleErrors.push(text);
  });
  page.on('pageerror', (err: Error) => pageErrors.push(err.message));

  const start = Date.now();
  await page.goto(urlPath, { waitUntil: 'load', timeout: 90_000 });
  const deadline = Date.now() + 90_000;
  while (totalInitMs === null && Date.now() < deadline) {
    await page.waitForTimeout(250);
  }
  return {
    scenario, url: urlPath, marks, totalInitMs,
    beginCount, skippedCount, consoleErrors, pageErrors,
    navTime: Date.now() - start,
  };
}

test.describe('Issue #1 - boot time', () => {
  test('A: cold cache, no deep link', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    appendResult(await runScenario(page, 'A_cold_no_deeplink', '/'));
    await ctx.close();
  });

  test('B: cold cache, ?novel=FMC', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    appendResult(await runScenario(page, 'B_cold_with_deeplink', `/?novel=${NOVEL_ID}`));
    await ctx.close();
  });

  test('C: warm cache, ?novel=FMC', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await runScenario(page, 'C_warm_setup', `/?novel=${NOVEL_ID}`);
    appendResult(await runScenario(page, 'C_warm_with_deeplink', `/?novel=${NOVEL_ID}`));
    await ctx.close();
  });
});
