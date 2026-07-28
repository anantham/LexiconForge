/**
 * expand-golden-accepted — attach DPD-attested "accepted" senses to each golden word.
 *
 * ⚠️ STATUS: ARCHIVED / UNCONSUMED ANNOTATION LAYER (header corrected 2026-07,
 * integrity scan P1 — the earlier header described a scorer mechanism that no
 * longer exists).
 *
 * The SUTTA-011 fp-neutralization this script fed (scorer treats a model sense
 * token as FP only if in neither core golden nor acceptedSenses) was DELIBERATELY
 * REVERTED in 7750bd0 (2026-07-02) after a dual-family REVISE: the
 * uncontextualized DPD-homonym-union neutral set becomes a recall-only WSD hedge
 * (a dict-lookup script could ace it; stop-word laundering). Content-F1 is back
 * to strict SUTTA-009 balanced micro-F1, and NEITHER scorer (quality-scorer.ts,
 * facts-scorer.ts) reads `acceptedSenses` today.
 *
 * The `acceptedSenses` data this script writes is RETAINED as raw material for
 * the agreed path B in ADR SUTTA-011: curate context-valid senses INTO the core
 * golden (human-adjudicated, per-context) while keeping strict F1. Do NOT re-land
 * the neutralization mechanism off the back of this script — that is a metric
 * decision requiring re-adjudication, not a code cleanup.
 *
 * Non-destructive: adds `acceptedSenses` to lexicographer entries; core `senses` untouched.
 *
 * Run: npx tsx scripts/sutta-studio/expand-golden-accepted.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDpdSubsetFromFs } from '../../services/providers/dpd-loader-fs';
import type { DpdData, DpdHeadwords, DpdForms } from '../../services/providers/dpd';
import type { LexiconEntry } from '../../services/providers/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const p = (rel: string) => path.join(REPO, rel);

const anatGolden = JSON.parse(fs.readFileSync(p('test-fixtures/sutta-studio-anatomist-golden.json'), 'utf8'));
const lexPath = p('test-fixtures/sutta-studio-lexicographer-golden.json');
const lexGolden = JSON.parse(fs.readFileSync(lexPath, 'utf8'));

const dpd: DpdData = loadDpdSubsetFromFs('mn10');
const HW: DpdHeadwords = dpd.headwords;
const FORMS: DpdForms = dpd.forms ?? {};
const norm = (s: string) => s.trim().toLowerCase().normalize('NFC');

function dpdSensesForSurface(surface: string): string[] {
  const q = norm(surface);
  const lemmas = HW[q] ? [q] : (FORMS[q] ?? []);
  const out: string[] = [];
  for (const lm of lemmas) for (const e of (HW[lm] ?? []) as LexiconEntry[]) {
    for (const s of e.senses ?? []) if (s.english) out.push(s.english);
  }
  return out;
}

let phasesTouched = 0, wordsTouched = 0, sensesAdded = 0;
for (const phaseId of Object.keys(lexGolden.lexicographer)) {
  const lexPhase = lexGolden.lexicographer[phaseId];
  const anatPhase = anatGolden.anatomist[phaseId];
  if (!lexPhase?.senses || !anatPhase?.words) continue;
  let touched = false;
  for (const entry of lexPhase.senses) {
    const word = anatPhase.words.find((w: any) => w.id === entry.wordId);
    if (!word) continue;
    const dpdSenses = dpdSensesForSurface(word.surface);
    if (!dpdSenses.length) continue;
    entry.acceptedSenses = dpdSenses;      // additive; core `senses` untouched
    wordsTouched++; sensesAdded += dpdSenses.length; touched = true;
  }
  if (touched) phasesTouched++;
}

lexGolden._acceptedSensesFrom =
  'data/dpd/mn10 (2026-07-01) — ARCHIVED/UNCONSUMED: SUTTA-011 scorer mechanism reverted in 7750bd0; retained for a future adjudicated re-landing (ADR SUTTA-011 path B)';
fs.writeFileSync(lexPath, JSON.stringify(lexGolden, null, 2) + '\n');
console.log(`Added acceptedSenses to ${wordsTouched} words across ${phasesTouched} phases (${sensesAdded} DPD senses total).`);
