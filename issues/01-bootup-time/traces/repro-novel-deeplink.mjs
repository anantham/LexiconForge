import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const RESULT = resolve(HERE, 'repro-novel-deeplink-result.json');
const TARGET = 'http://localhost:5180/?novel=forty-millenniums-of-cultivation&version=v1-composite&chapter=lexiconforge%3A%2F%2Fforty-millenniums-of-cultivation%2Fchapter%2F339';
const TOTAL_INIT_RE = /Total init time:\s+(\d+)ms/;
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
let totalInitMs = null, beginCount = 0;
const interesting = [];
page.on('console', (msg) => {
  const text = msg.text();
  if (text.includes('initializeStore - begin') || text.includes('initializeStore – begin')) beginCount++;
  const m = TOTAL_INIT_RE.exec(text);
  if (m) totalInitMs = parseInt(m[1], 10);
  if (/DeepLink|ImportService|loadNovel|Registry|fetchNovel|importFromUrl|streamingImport|chunked|chapters loaded|hydrat/i.test(text)) {
    interesting.push({ ts: Date.now(), text: text.slice(0, 220) });
  }
});
page.on('pageerror', (e) => console.log('pageerror:', e.message));
const t0 = Date.now();
console.log(`[live2] -> ${TARGET}`);
try { await page.goto(TARGET, { waitUntil: 'load', timeout: 180_000 }); } catch (e) { console.log('goto:', e.message); }
const deadline = Date.now() + 180_000;
while (totalInitMs === null && Date.now() < deadline) {
  await page.waitForTimeout(500);
}
await page.waitForTimeout(3_000);
console.log(`totalInitMs=${totalInitMs}  begin=${beginCount}  navTime=${Date.now()-t0}ms`);
console.log('--- interesting (last 30) ---');
const t = interesting[0]?.ts ?? t0;
for (const l of interesting.slice(-30)) {
  console.log(`  +${l.ts - t}ms  ${l.text}`);
}
writeFileSync(RESULT, JSON.stringify({
  url: TARGET, totalInitMs, beginCount,
  navTimeMs: Date.now() - t0,
  capturedAt: new Date().toISOString(),
  interestingLogs: interesting,
}, null, 2));
console.log('wrote', RESULT);
await ctx.close(); await browser.close();
