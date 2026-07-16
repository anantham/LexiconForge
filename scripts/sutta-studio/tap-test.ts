/**
 * The TAP TEST — interaction-level alignment audit of the real page.
 *
 * The alignment metric so far scores JSON links; this drives the LIVE
 * interface: for every link in the alignment golden, hover the Pāli word's
 * segments on the rendered page and check that the expected English tokens
 * actually LIGHT UP (the emerald active state). It catches everything the
 * JSON can't see — rehydrator drops, render-time link removal, DOM id
 * mismatches — which is the point: the benchmark's unit of evaluation is
 * the interface, not the data structure.
 *
 * Interaction contract (from the view code):
 *  - Pāli word container: #<phaseId>-<wordId>; its segment children carry
 *    ids containing "seg" and set hover state on mouseenter.
 *  - English token: #<phaseId>-target-<structureId>; active state renders
 *    the class text-emerald-400.
 *  - Segment-linked tokens are segment-precise, so we hover EVERY segment
 *    of the word and union the activated tokens — the word's full
 *    interactive affordance, matching the golden's word-level links.
 *
 * Usage: npx tsx scripts/sutta-studio/tap-test.ts [--url https://.../sutta/mn10] [--limit N]
 * Deterministic, read-only, no API keys. ~3-5 min for all 160 links.
 */

import * as fs from 'node:fs';
import { chromium } from 'playwright';

const argValue = (f: string) => {
  const i = process.argv.indexOf(f);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const URL = argValue('--url') || 'https://read.adityaarpitha.com/sutta/mn10';
const LIMIT = argValue('--limit') ? Number(argValue('--limit')) : Infinity;

const golden = JSON.parse(fs.readFileSync('test-fixtures/sutta-studio-alignment-golden.json', 'utf8')) as {
  groups: Array<{ phaseIds: string[]; tokens: string[]; links: Array<{ phaseId: string; wordId: string; surface: string; tokenIdxs: number[]; via: string }> }>;
};

const fold = (t: string) =>
  (t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics, keep base letters
    .replace(/[^a-z''-]/g, '')
    .replace(/(ies)$/, 'y')
    .replace(/(es|s)$/, '');

type LinkResult = {
  phaseId: string;
  wordId: string;
  surface: string;
  expected: string[];
  lit: string[];
  /** interaction: did the hover light ANY linked English token at all?
   * content: do the lit tokens match the golden's (Sujato) tokens? The
   * flagship's hand-curated English predates the Sujato alignment ("the
   * Blessed One" vs "Buddha"), so content mismatches there are variant
   * choices, not broken links — report the two levels separately. */
  interaction: 'lit' | 'dead' | 'word-missing';
  content: 'full' | 'partial' | 'none';
};

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  console.log(`[tap-test] ${URL}`);
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(1500);

  const results: LinkResult[] = [];
  let tested = 0;

  for (const g of golden.groups) {
    for (const link of g.links) {
      if (tested >= LIMIT) break;
      const expected = link.tokenIdxs.map((i) => g.tokens[i]).map(fold).filter(Boolean);
      if (!expected.length) continue;
      tested++;

      const word = page.locator(`[id="${link.phaseId}-${link.wordId}"]`);
      if ((await word.count()) === 0) {
        results.push({ phaseId: link.phaseId, wordId: link.wordId, surface: link.surface, expected, lit: [], interaction: 'word-missing', content: 'none' });
        continue;
      }

      // hover every segment child (ids contain "seg"); fall back to the word div
      const segs = word.locator('[id*="seg"]');
      const nSegs = await segs.count();
      const lit = new Set<string>();
      const hoverTargets = nSegs > 0 ? nSegs : 1;
      for (let s = 0; s < hoverTargets; s++) {
        const target = nSegs > 0 ? segs.nth(s) : word;
        try {
          await target.hover({ timeout: 5000 });
        } catch {
          continue;
        }
        await page.waitForTimeout(120);
        const active = await page
          .locator(`[id^="${link.phaseId}-target-"].text-emerald-400`)
          .allInnerTexts();
        for (const t of active) {
          const f = fold(t.split('\n')[0]);
          if (f) lit.add(f);
        }
      }
      await page.mouse.move(5, 5); // clear hover

      const hits = expected.filter((e) => [...lit].some((l) => l.includes(e) || e.includes(l)));
      results.push({
        phaseId: link.phaseId,
        wordId: link.wordId,
        surface: link.surface,
        expected,
        lit: [...lit],
        interaction: lit.size > 0 ? 'lit' : 'dead',
        content: hits.length === expected.length ? 'full' : hits.length > 0 ? 'partial' : 'none',
      });
    }
  }

  await browser.close();

  const inter = (v: LinkResult['interaction']) => results.filter((r) => r.interaction === v);
  const cont = (v: LinkResult['content']) => results.filter((r) => r.content === v);
  console.log(`\nlinks tested: ${results.length}`);
  console.log(`INTERACTION (does the tap light linked English at all?):`);
  console.log(`  lit: ${inter('lit').length} | dead: ${inter('dead').length} | word missing from DOM: ${inter('word-missing').length}`);
  console.log(`CONTENT (do lit tokens match the golden/Sujato tokens?):`);
  console.log(`  full: ${cont('full').length} | partial: ${cont('partial').length} | none: ${cont('none').length}`);
  for (const r of [...inter('word-missing'), ...inter('dead')].slice(0, 15)) {
    console.log(`  ✗ DEAD ${r.phaseId} ${r.surface} (${r.wordId}) expected [${r.expected.join(', ')}]`);
  }
  fs.writeFileSync('reports/sutta-studio/tap-test-results.json', JSON.stringify({ url: URL, generatedAt: new Date().toISOString(), results }, null, 1));
  console.log('\nTAP TEST COMPLETE');
};

run().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
