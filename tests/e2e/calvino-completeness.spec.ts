import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * UI-level completeness gate for the Calvino reader: every aligned pair in the
 * payload — every Weaver English phrase and every Italian token stream — must be
 * present in the RENDERED DOM of its unit page. This closes the payload→UI link
 * that validate_alignment.py (session→payload, invariant I2) cannot see: a
 * rendering bug could swallow pairs with the payload intact.
 *
 * Comparison is on whitespace-free text: rendering legitimately reflows spacing,
 * but every non-space character must survive.
 *
 * Data note: the payload derives from copyrighted text (Calvino/Weaver) and is
 * gitignored, so this spec SKIPS loudly when the data is absent (e.g. in CI).
 * It is a LOCAL gate; run it before scaling or shipping reader changes:
 *   npx playwright test tests/e2e/calvino-completeness.spec.ts --reporter=list
 * against a dev server (BASE env var, default http://localhost:5210).
 */

const BASE = process.env.BASE || 'http://localhost:5210';
const PAYLOAD = path.resolve(__dirname, '../../data/calvino/reader-payload.json');

const squash = (s: string) => (s || '').replace(/\s+/g, '');

type Tok = { s: string; ws?: boolean };
type Pair = { it: Tok[]; en: string };
type Unit = { n: number; title: string; blocks: { pairs: Pair[] }[] };

const available = fs.existsSync(PAYLOAD);

test.describe('Calvino reader completeness (payload → DOM)', () => {
  test.skip(!available, 'reader-payload.json absent (gitignored copyrighted data) — local-only gate');

  const payload = available
    ? (JSON.parse(fs.readFileSync(PAYLOAD, 'utf8')) as { units: Unit[] })
    : { units: [] };

  for (const unit of payload.units) {
    test(`unit ${unit.n} renders every aligned pair (${unit.title})`, async ({ page }) => {
      await page.goto(`${BASE}/calvino/${unit.n}`, { waitUntil: 'networkidle' });
      // the payload loads via dynamic import; wait for prose to appear
      await page.waitForSelector('p', { timeout: 20000 });
      const body = squash(await page.evaluate(() => document.body.innerText));

      const missing: string[] = [];
      let checked = 0;
      for (const block of unit.blocks) {
        for (const pair of block.pairs) {
          checked++;
          const it = squash(pair.it.map((t) => t.s).join(''));
          if (it && !body.includes(it)) {
            missing.push(`IT pair: "${pair.it.map((t) => t.s).join(' ').slice(0, 60)}..."`);
          }
          const en = squash(pair.en);
          if (en && !body.includes(en)) {
            missing.push(`EN pair: "${pair.en.slice(0, 60)}..."`);
          }
        }
      }
      expect(
        missing,
        `unit ${unit.n}: ${missing.length}/${checked} pairs missing from the rendered DOM:\n` +
          missing.slice(0, 10).join('\n'),
      ).toEqual([]);
    });
  }
});
