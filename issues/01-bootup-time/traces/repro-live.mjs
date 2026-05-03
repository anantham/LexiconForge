#!/usr/bin/env node
// Hit the user's running dev server at :5180 with a ?chapter= deep link.
// Two scenarios: cold IndexedDB and warm IndexedDB (re-navigate same context).
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULT = resolve(HERE, 'repro-live-result.json');
const TARGET = 'http://localhost:5180/?chapter=lexiconforge%3A%2F%2Fforty-millenniums-of-cultivation%2Fchapter%2F339';

const TOTAL_INIT_RE = /Total init time:\s+(\d+)ms/;
const STORE_INIT_RE = /\[Store:init\s+\+(\d+)ms\s+/;

async function capture(page, label, url) {
  const marks = [], errors = [], all = [];
  let totalInitMs = null;
  let beginCount = 0, skippedCount = 0;
  page.on('console', (msg) => {
    const text = msg.text();
    all.push({ type: msg.type(), text, ts: Date.now() });
    if (STORE_INIT_RE.test(text)) {
      marks.push({ raw: text, ts: Date.now() });
      if (text.includes('initializeStore - begin') || text.includes('initializeStore – begin')) beginCount++;
      if (text.includes('initializeStore - skipped') || text.includes('initializeStore – skipped')) skippedCount++;
    }
    const m = TOTAL_INIT_RE.exec(text);
    if (m) totalInitMs = parseInt(m[1], 10);
    if (msg.type() === 'error') errors.push(text);
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const t0 = Date.now();
  console.log(`[live] ${label} -> ${url}`);
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
  } catch (e) {
    errors.push('goto: ' + e.message);
  }
  // wait up to 120s for "Total init time"
  const deadline = Date.now() + 120_000;
  while (totalInitMs === null && Date.now() < deadline) {
    await page.waitForTimeout(250);
  }
  // also wait a beat after init to catch trailing logs
  await page.waitForTimeout(2000);
  return {
    label, url,
    totalInitMs,
    beginCount,
    skippedCount,
    navTime: Date.now() - t0,
    markCount: marks.length,
    marks,
    errors,
    interestingLogs: all
      .filter((l) => /DeepLink|ImportService|loadNovelIntoStore|registry|fetchNovel|reader|chapter/i.test(l.text))
      .slice(0, 60)
      .map((l) => ({ type: l.type, text: l.text.slice(0, 300), ts: l.ts })),
  };
}

const browser = await chromium.launch();
const results = [];
try {
  // A: cold — fresh context, no IndexedDB
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    results.push(await capture(page, 'A_cold', TARGET));
    await ctx.close();
  }
  // B: warm — same context navigated twice (second visit reuses IDB)
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await capture(page, 'B_warm_setup', TARGET);  // not recorded
    await page.waitForTimeout(2_000);
    // fresh log capture for the second visit
    results.push(await capture(page, 'B_warm', TARGET));
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync(RESULT, JSON.stringify(results, null, 2));
console.log('---');
for (const r of results) {
  console.log(`${r.label.padEnd(16)} totalInitMs=${r.totalInitMs}  begin=${r.beginCount}  skipped=${r.skippedCount}  navTime=${r.navTime}ms  marks=${r.markCount}  errors=${r.errors.length}`);
}
console.log(`wrote ${RESULT}`);
