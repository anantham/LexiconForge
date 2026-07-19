/**
 * Real-network smoke test for the FoJin / 84000 / Sutta Studio flow.
 *
 * Unlike tests/e2e/* which mocks all upstream APIs, this drives the live
 * dev server with real LLM, fojin.app, and 84000.co calls. Used to verify
 * what the user actually sees in their browser.
 *
 * Run with the dev server already up on localhost:5181:
 *   npx tsx scripts/smoke-real-fojin.ts
 *
 * Outputs screenshots to test-results/smoke-real-fojin/*.png
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5181';
const OUT_DIR = path.resolve(__dirname, '../test-results/smoke-real-fojin');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  console.log(`[smoke] using base URL: ${BASE_URL}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console.err] ${msg.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

  const screenshot = async (name: string) => {
    const p = path.join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: p, fullPage: true });
    console.log(`[smoke] screenshot → ${p}`);
  };

  // 1. Landing page
  console.log('[smoke] step 1: open landing');
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
  // Wait for the input bar / search field to be ready.
  await page
    .locator('input[placeholder*="Search by title or author"]')
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 });
  await screenshot('01-landing');

  // 2. Search
  console.log('[smoke] step 2: search "heart sutra"');
  const search = page.getByPlaceholder(/Search by title or author/i);
  await search.fill('heart sutra');
  await search.press('Enter');

  // Wait for either ★ Recommended raw card OR a "no results" error.
  console.log('[smoke] step 2a: waiting for results...');
  const recommended = page.getByText('★ Recommended').first();
  const noResults = page.getByText(/No sources found|Search failed/i).first();
  try {
    await Promise.race([
      recommended.waitFor({ state: 'visible', timeout: 60_000 }),
      noResults.waitFor({ state: 'visible', timeout: 60_000 }),
    ]);
  } catch (e) {
    console.error('[smoke] FAIL: neither results nor no-results message appeared');
  }
  await screenshot('02-search-results');

  // Print a summary of what's on the screen.
  const recommendedVisible = await recommended.isVisible().catch(() => false);
  const noResultsVisible = await noResults.isVisible().catch(() => false);
  console.log(`[smoke] results state: recommended=${recommendedVisible} noResults=${noResultsVisible}`);

  // Count fan cards
  const fanCards = page
    .locator('button')
    .filter({ hasText: /84000|SuttaCentral|wuxiaworld|webnovel|novelcool/i });
  const fanCount = await fanCards.count();
  console.log(`[smoke] fan card count: ${fanCount}`);
  for (let i = 0; i < fanCount; i++) {
    const txt = (await fanCards.nth(i).innerText()).slice(0, 200).replace(/\s+/g, ' ');
    console.log(`[smoke]   fan[${i}]: ${txt}`);
  }

  if (!recommendedVisible) {
    console.log('[smoke] aborting — no recommended card to click');
    await browser.close();
    if (errors.length) console.log('[smoke] errors:\n' + errors.join('\n'));
    process.exit(1);
  }

  // 3. Click recommended raw card
  console.log('[smoke] step 3: select recommended raw card');
  await recommended.click();

  // 4. Click 84000 fan card if present
  const eight4k = page.locator('button').filter({ hasText: /84000/i }).first();
  const has84000 = await eight4k.isVisible().catch(() => false);
  if (has84000) {
    console.log('[smoke] step 4: select 84000 fan card');
    await eight4k.click();
  } else {
    console.log('[smoke] step 4: NO 84000 fan card available (skipping fan selection)');
  }
  await screenshot('03-cards-selected');

  // 5. Click Add to Library
  console.log('[smoke] step 5: Add to Library');
  const addBtn = page.getByRole('button', { name: /Add to Library/i });
  await addBtn.click();

  // 6. Wait for chapter to actually load. Don't trust "any h1" — the landing
  // page also has h1="Lexicon Forge". Wait for either the URL to change to
  // include ?chapter= (chapter view) OR for a Chinese-character heading
  // (FoJin chapter title).
  console.log('[smoke] step 6: waiting for chapter to load');
  try {
    await Promise.race([
      page.waitForURL(/\?chapter=/, { timeout: 120_000 }),
      page.locator('h1:has-text("般若")').first().waitFor({ state: 'visible', timeout: 120_000 }),
    ]);
  } catch (e) {
    console.error('[smoke] FAIL: chapter did not load (timeout). URL:', page.url());
    await screenshot('06-FAIL-no-chapter');
    await browser.close();
    process.exit(1);
  }
  // Give the chapter view's React state another moment to settle.
  await page.waitForTimeout(2_000);
  await screenshot('04-chapter-loaded');
  console.log(`[smoke]   chapter URL: ${page.url()}`);

  // 7. Find and click the studio button (🔯)
  console.log('[smoke] step 7: open Sutta Studio');
  const studioBtn = page.getByRole('link', { name: /Open Sutta Studio/i }).first();
  const hasStudioBtn = await studioBtn.isVisible().catch(() => false);
  if (!hasStudioBtn) {
    console.error('[smoke] FAIL: Sutta Studio button not visible on chapter');
    await screenshot('07-FAIL-no-studio-button');
    await browser.close();
    process.exit(1);
  }
  await studioBtn.click();
  await page.waitForURL(/\/sutta\/fojin\//, { timeout: 15_000 });
  console.log(`[smoke]   url after click: ${page.url()}`);

  // 8. Wait for studio to render content
  console.log('[smoke] step 8: studio render');
  // Look for either the original column or any Chinese text
  await page.waitForTimeout(3_000); // give SPA + chapter resolve a moment
  await screenshot('05-studio');

  // Check what's actually in the studio
  const bodyText = await page.locator('body').innerText();
  const hasChinese = /[一-鿿]/.test(bodyText);
  const hasEnglish = /heart|wisdom|emptiness|prajñā/i.test(bodyText);
  const hasOriginalLabel = bodyText.toLowerCase().includes('original');
  const hasMetadataStrip = bodyText.includes('Translator:') || bodyText.includes('CBETA');
  console.log('[smoke] studio rendering check:');
  console.log(`  - Chinese characters present: ${hasChinese}`);
  console.log(`  - English content present: ${hasEnglish}`);
  console.log(`  - "Original" column label present: ${hasOriginalLabel}`);
  console.log(`  - Metadata strip (translator/cbeta): ${hasMetadataStrip}`);

  // Surface a sample of the rendered content
  const visibleText = bodyText.replace(/\s+/g, ' ').slice(0, 500);
  console.log(`[smoke] visible text (first 500): ${visibleText}`);

  await browser.close();

  if (errors.length) {
    console.log('[smoke] console / page errors:');
    errors.forEach((e) => console.log('  ' + e));
  }

  const ok = hasChinese && hasOriginalLabel;
  console.log(ok ? '[smoke] ✅ DONE' : '[smoke] ⚠ DONE with issues');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('[smoke] crashed:', e);
  process.exit(2);
});
