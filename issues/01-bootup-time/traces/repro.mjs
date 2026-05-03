#!/usr/bin/env node
/**
 * Standalone Playwright reproduction for Issue #1 (boot time).
 *
 * Why standalone (not @playwright/test): the project's playwright.config.ts
 * pins testDir to ./tests/e2e, and we want this artifact to live alongside
 * the issue investigation, not in the production test suite.
 *
 * Usage: node issues/01-bootup-time/traces/repro.mjs
 *   - Auto-starts a vite dev server on a free port if 5180/5177 aren't up.
 *   - Runs three scenarios (A: cold/no-deeplink, B: cold/deeplink, C: warm/deeplink).
 *   - Writes repro-result.json next to this script.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const RESULT = resolve(HERE, 'repro-result.json');
const NOVEL_ID = 'forty-millenniums-of-cultivation';
const TOTAL_INIT_RE = /Total init time:\s+(\d+)ms/;
const STORE_INIT_RE = /\[Store:init\s+\+(\d+)ms/;
const PORT = 5191; // dedicated port to avoid clash with any other dev server

function ping(port) {
  return new Promise((res) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 1500 }, (r) => {
      r.resume();
      res(r.statusCode || 0);
    });
    req.on('error', () => res(0));
    req.on('timeout', () => { req.destroy(); res(0); });
  });
}

async function waitForServer(port, deadlineMs) {
  const end = Date.now() + deadlineMs;
  while (Date.now() < end) {
    if (await ping(port)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function startDevServer() {
  console.log(`[repro] starting vite on :${PORT}...`);
  const child = spawn(
    'npm',
    ['run', 'dev', '--', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
    { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, BROWSER: 'none' } },
  );
  child.stdout.on('data', (d) => process.stdout.write(`[vite] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`));
  const ok = await waitForServer(PORT, 90_000);
  if (!ok) {
    child.kill('SIGTERM');
    throw new Error(`dev server did not come up on :${PORT}`);
  }
  console.log(`[repro] vite ready on :${PORT}`);
  return child;
}

async function runScenario(browser, scenario, urlPath) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const marks = [];
  const consoleErrors = [];
  const pageErrors = [];
  let totalInitMs = null;
  let beginCount = 0;
  let skippedCount = 0;

  page.on('console', (msg) => {
    const text = msg.text();
    if (STORE_INIT_RE.test(text)) {
      marks.push({ raw: text, ts: Date.now() });
      if (text.includes('initializeStore - begin') || text.includes('initializeStore – begin')) beginCount++;
      if (text.includes('initializeStore - skipped') || text.includes('initializeStore – skipped')) skippedCount++;
    }
    const m = TOTAL_INIT_RE.exec(text);
    if (m) totalInitMs = parseInt(m[1], 10);
    if (msg.type() === 'error') consoleErrors.push(text);
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));

  const start = Date.now();
  const fullUrl = `http://127.0.0.1:${PORT}${urlPath}`;
  console.log(`[repro] ${scenario} -> ${fullUrl}`);
  try {
    await page.goto(fullUrl, { waitUntil: 'load', timeout: 90_000 });
  } catch (e) {
    pageErrors.push(`goto failed: ${e.message}`);
  }
  const deadline = Date.now() + 90_000;
  while (totalInitMs === null && Date.now() < deadline) {
    await page.waitForTimeout(250);
  }
  const navTime = Date.now() - start;
  const r = { scenario, url: urlPath, marks, totalInitMs, beginCount, skippedCount, consoleErrors, pageErrors, navTime };
  console.log(`[repro] ${scenario} done: totalInitMs=${totalInitMs}, beginCount=${beginCount}, skippedCount=${skippedCount}, navTime=${navTime}ms`);
  await ctx.close();
  return r;
}

async function main() {
  let server = null;
  if (!(await ping(PORT))) {
    server = await startDevServer();
  } else {
    console.log(`[repro] reusing existing server on :${PORT}`);
  }

  const browser = await chromium.launch();
  const results = [];
  try {
    results.push(await runScenario(browser, 'A_cold_no_deeplink', '/'));
    results.push(await runScenario(browser, 'B_cold_with_deeplink', `/?novel=${NOVEL_ID}`));
    // C: warm cache. Reuse a single context across two visits.
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      // setup pass (not recorded)
      await page.goto(`http://127.0.0.1:${PORT}/?novel=${NOVEL_ID}`, { waitUntil: 'load', timeout: 90_000 }).catch(() => {});
      await page.waitForTimeout(2_000);
      // recorded pass
      const marks = [];
      let totalInitMs = null;
      let beginCount = 0, skippedCount = 0;
      const consoleErrors = [], pageErrors = [];
      page.on('console', (msg) => {
        const text = msg.text();
        if (STORE_INIT_RE.test(text)) {
          marks.push({ raw: text, ts: Date.now() });
          if (text.includes('initializeStore - begin') || text.includes('initializeStore – begin')) beginCount++;
          if (text.includes('initializeStore - skipped') || text.includes('initializeStore – skipped')) skippedCount++;
        }
        const m = TOTAL_INIT_RE.exec(text);
        if (m) totalInitMs = parseInt(m[1], 10);
        if (msg.type() === 'error') consoleErrors.push(text);
      });
      page.on('pageerror', (err) => pageErrors.push(err.message));
      const start = Date.now();
      await page.goto(`http://127.0.0.1:${PORT}/?novel=${NOVEL_ID}`, { waitUntil: 'load', timeout: 90_000 }).catch((e) => pageErrors.push(`goto failed: ${e.message}`));
      const deadline = Date.now() + 60_000;
      while (totalInitMs === null && Date.now() < deadline) {
        await page.waitForTimeout(250);
      }
      results.push({
        scenario: 'C_warm_with_deeplink',
        url: `/?novel=${NOVEL_ID}`,
        marks, totalInitMs, beginCount, skippedCount,
        consoleErrors, pageErrors, navTime: Date.now() - start,
      });
      await ctx.close();
    }
  } finally {
    await browser.close();
    if (server) server.kill('SIGTERM');
  }
  writeFileSync(RESULT, JSON.stringify(results, null, 2));
  console.log(`[repro] wrote ${RESULT}`);
  for (const r of results) {
    console.log(`  ${r.scenario}: totalInitMs=${r.totalInitMs}, begin=${r.beginCount}, skipped=${r.skippedCount}, navTime=${r.navTime}ms`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
