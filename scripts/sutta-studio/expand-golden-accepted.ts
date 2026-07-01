/**
 * expand-golden-accepted — attach DPD-attested "accepted" senses to each golden word.
 *
 * Content-F1 (ADR SUTTA-009) is symmetric token-F1: a model sense token not in the
 * golden counts as a false positive. But the diagnostic shows ~40% of those FPs are
 * CORRECT, DPD-attested alternates (nibbāna→"extinguishment", satta→"creature") that
 * the golden's short curated list simply omits — so good models are penalised for right
 * answers. This writes, per golden lexicographer word, `acceptedSenses`: the DPD English
 * senses for that word. The scorer treats a model token as FP only if it is in NEITHER
 * the core golden NOR this accepted set — so attested alternates go neutral, while random
 * synonym-spraying (not DPD-attested) still counts against the model. Recall (fn) is
 * unchanged: it is measured against the CORE golden only, never the expanded set.
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

lexGolden._acceptedSensesFrom = 'data/dpd/mn10 (2026-07-01) — see ADR SUTTA-011';
fs.writeFileSync(lexPath, JSON.stringify(lexGolden, null, 2) + '\n');
console.log(`Added acceptedSenses to ${wordsTouched} words across ${phasesTouched} phases (${sensesAdded} DPD senses total).`);
