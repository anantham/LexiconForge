/**
 * E2E smoke — Sutta Studio grounding + persistent cache (real LLM)
 *
 * Verifies the two architectural changes that landed 2026-05-15:
 *   1. PR #57 — GROUNDING Phase 4 / Eudoxos Vism glosses are reachable
 *      from the live compile pipeline (the compiled packet contains at
 *      least one citation whose URL points at edhamma.github.io).
 *   2. PR #56 — Persistent L5 segmentCache survives a page reload (the
 *      IndexedDB `segment_cache` store has >0 entries after the first
 *      compile, and the second compile loads them).
 *
 * ⚠ Real LLM, real money. The test calls OpenRouter via the compiler
 * and runs for ~3–6 minutes total. Expected cost: ~$0.15 per run with
 * the default Gemini 3 Flash Preview model and `phaseLimit=4`.
 *
 * Skipped by default. To run:
 *
 *   export OPENROUTER_API_KEY=sk-or-v1-...
 *   export RUN_GROUNDING_SMOKE=1
 *   npx playwright test tests/e2e/sutta-studio-grounding-smoke.spec.ts --reporter=list
 *
 * Both env vars are required: the API key for the call, the explicit
 * RUN flag so you can't trigger paid runs by typing `npm run test:e2e`.
 *
 * Pre-flight (one-time): `npm install` in the project root must have
 * been run so the dev server can boot via playwright.config.ts webServer.
 */

import { test, expect } from '@playwright/test';
import { prepareFreshApp } from './helpers/sessionHarness';

const SHOULD_RUN =
  !!process.env.OPENROUTER_API_KEY && process.env.RUN_GROUNDING_SMOKE === '1';

test.describe('Sutta Studio grounding smoke', () => {
  // The whole describe block needs ample time — compile is the bottleneck.
  test.setTimeout(10 * 60 * 1000); // 10 minutes

  test.skip(
    !SHOULD_RUN,
    'Set OPENROUTER_API_KEY and RUN_GROUNDING_SMOKE=1 to run (paid LLM call ~$0.15)'
  );

  test('MN10 phaseLimit=4 produces Vism citations and persists the cache', async ({
    page,
  }) => {
    // Capture console for the post-compile diagnostic + cache-load log assertion.
    const consoleLines: string[] = [];
    page.on('console', (msg) => consoleLines.push(msg.text()));

    // ── Fresh app, no prior state ────────────────────────────────────────
    await prepareFreshApp(page);
    // Also wipe the sutta-studio-cache DB so the cache test starts cold
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const req = indexedDB.deleteDatabase('sutta-studio-cache');
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
          req.onblocked = () => resolve();
        })
    );

    // ── First compile (real LLM, ~3–4 min for phaseLimit=4) ─────────────
    await page.goto('/sutta/mn10?phaseLimit=4', { waitUntil: 'domcontentloaded' });

    // Wait until the compiler reports success via the store. We poll the
    // suttaStudio packet on the active chapter for `progress.state==='complete'`.
    await page.waitForFunction(
      () => {
        const store = (window as unknown as { __APP_STORE__?: { getState: () => unknown } })
          .__APP_STORE__;
        if (!store) return false;
        const state = store.getState() as {
          chapters?: Record<string, { suttaStudio?: { progress?: { state?: string } } }>;
        };
        const chapter = Object.values(state.chapters || {}).find(
          (c) => c?.suttaStudio?.progress
        );
        return chapter?.suttaStudio?.progress?.state === 'complete';
      },
      { timeout: 8 * 60 * 1000, polling: 2000 }
    );

    // ── Assert 1: at least one citation in the packet has an Eudoxos URL ─
    const packetSummary = await page.evaluate(() => {
      const store = (window as unknown as { __APP_STORE__?: { getState: () => unknown } })
        .__APP_STORE__;
      const state = store!.getState() as {
        chapters?: Record<string, { suttaStudio?: { citations?: Array<{ url?: string; id?: string }> } }>;
      };
      const chapter = Object.values(state.chapters || {}).find((c) => c?.suttaStudio?.citations);
      const citations = chapter?.suttaStudio?.citations || [];
      return {
        total: citations.length,
        eudoxosUrls: citations.filter((c) => /edhamma\.github\.io|eudoxos\.github\.io/i.test(c.url || '')).map((c) => ({ id: c.id, url: c.url })),
        vismIds: citations.filter((c) => /^cite:vism(-gloss)?:/i.test(c.id || '')).map((c) => c.id),
      };
    });

    console.log('[smoke] packet citations:', JSON.stringify(packetSummary, null, 2));
    expect(packetSummary.total, 'compiled packet has citations').toBeGreaterThan(0);
    expect(
      packetSummary.eudoxosUrls.length + packetSummary.vismIds.length,
      'at least one Vism-glossed citation present (proves PR #57 wired into the live pipeline)'
    ).toBeGreaterThan(0);

    // ── Assert 2: segment_cache IDB store has entries ───────────────────
    const cacheCountAfterFirst = await page.evaluate(
      () =>
        new Promise<number>((resolve, reject) => {
          const open = indexedDB.open('sutta-studio-cache', 2);
          open.onsuccess = () => {
            const db = open.result;
            if (!db.objectStoreNames.contains('segment_cache')) {
              db.close();
              return resolve(-1);
            }
            const tx = db.transaction(['segment_cache'], 'readonly');
            const req = tx.objectStore('segment_cache').count();
            req.onsuccess = () => {
              db.close();
              resolve(req.result);
            };
            req.onerror = () => {
              db.close();
              reject(req.error);
            };
          };
          open.onerror = () => reject(open.error);
        })
    );

    console.log(`[smoke] segment_cache count after first compile: ${cacheCountAfterFirst}`);
    expect(
      cacheCountAfterFirst,
      'segment_cache populated by the first compile (proves PR #56 persistence)'
    ).toBeGreaterThan(0);

    // ── Reload + re-compile ──────────────────────────────────────────────
    consoleLines.length = 0;
    await page.reload({ waitUntil: 'domcontentloaded' });

    // The reload triggers cache re-init. Wait for the SegmentCache load log.
    await expect
      .poll(
        () =>
          consoleLines.some((l) =>
            /\[SegmentCache\]\s+Loaded\s+\d+\/\d+\s+entries/.test(l)
          ),
        { timeout: 30_000 }
      )
      .toBe(true);

    const loadLog = consoleLines.find((l) =>
      /\[SegmentCache\]\s+Loaded\s+\d+\/\d+\s+entries/.test(l)
    );
    const [, loadedN] =
      loadLog?.match(/\[SegmentCache\]\s+Loaded\s+(\d+)\/(\d+)/) || ([] as unknown[]);
    console.log(`[smoke] segment_cache load log: ${loadLog}`);
    expect(
      Number(loadedN),
      'second app boot loaded persisted segment-cache entries from the first compile'
    ).toBeGreaterThan(0);
  });
});
