/**
 * Extract DPD per-form grammatical readings for a sutta's golden vocabulary.
 *
 * DPD's lookup.grammar column holds every legitimate analysis of an inflected
 * surface form, e.g. kāye → [masc acc pl of kāya, masc loc sg of kāya, ...].
 * We store the READING SET per surface — the facts layer grades a model's
 * asserted morph as "consistent with some legitimate reading" (fabricated
 * case/number = in no reading), mirroring how rootMatch grades against the
 * homonym-union root set. The golden is never mutated; DPD stays the
 * authority; ambiguity is preserved, not resolved (contextual disambiguation
 * is judge territory).
 *
 * Requires data/_raw/dpd/dpd.db (kept by build-dpd). Writes
 * data/dpd/<sutta>/grammar.json: { surface: [ {pos, gender?, case?, number?} ] }
 *
 * Usage: npx tsx scripts/sutta-studio/extract-dpd-grammar.ts [mn10]
 */

import * as fs from 'node:fs';
import Database from 'better-sqlite3';

const sutta = process.argv[2] || 'mn10';
const DB = 'data/_raw/dpd/dpd.db';
if (!fs.existsSync(DB)) {
  console.error(`missing ${DB} — run npm run build:dpd first (it caches the sqlite)`);
  process.exit(1);
}

const anat = JSON.parse(fs.readFileSync('test-fixtures/sutta-studio-anatomist-golden.json', 'utf8')).anatomist as Record<
  string,
  { words: Array<{ surface: string; wordClass?: string }> }
>;

const clean = (s: string) => s.toLowerCase().normalize('NFC').replace(/[^a-zāīūṁṃṅñṭḍṇḷ'']/g, '');
const surfaces = new Set<string>();
for (const ph of Object.values(anat)) {
  for (const w of ph.words) {
    if (w.wordClass !== 'content') continue;
    const c = clean(w.surface);
    if (c) surfaces.add(c);
  }
}

const GENDER: Record<string, string> = { masc: 'm', fem: 'f', nt: 'nt' };
const CASES = new Set(['nom', 'acc', 'instr', 'dat', 'abl', 'gen', 'loc', 'voc']);
const NUMBERS = new Set(['sg', 'pl']);

type Reading = { pos: string; gender?: string; case?: string; number?: string };

const db = new Database(DB, { readonly: true });
const stmt = db.prepare('SELECT grammar FROM lookup WHERE lookup_key = ?');
const out: Record<string, Reading[]> = {};
let hits = 0;

for (const s of [...surfaces].sort()) {
  const row = stmt.get(s) as { grammar: string } | undefined;
  if (!row?.grammar) continue;
  let parsed: Array<[string, string, string]>;
  try {
    parsed = JSON.parse(row.grammar);
  } catch {
    continue;
  }
  const readings: Reading[] = [];
  const seen = new Set<string>();
  for (const entry of parsed) {
    const [, pos, analysis] = entry;
    const r: Reading = { pos: pos || '' };
    for (const tok of (analysis || '').split(/\s+/)) {
      if (GENDER[tok]) r.gender = GENDER[tok];
      else if (CASES.has(tok)) r.case = tok;
      else if (NUMBERS.has(tok)) r.number = tok;
    }
    if (!r.gender && !r.case && !r.number) continue; // verb/indeclinable analyses: out of v1 scope
    const key = JSON.stringify(r);
    if (!seen.has(key)) {
      seen.add(key);
      readings.push(r);
    }
  }
  if (readings.length) {
    out[s] = readings;
    hits++;
  }
}
db.close();

fs.writeFileSync(
  `data/dpd/${sutta}/grammar.json`,
  JSON.stringify({ _source: 'DPD lookup.grammar (see data/dpd manifest for release)', _extractedAt: new Date().toISOString(), readings: out }, null, 1)
);
console.log(`content surfaces: ${surfaces.size} | with DPD nominal readings: ${hits} (${Math.round((100 * hits) / surfaces.size)}%)`);
console.log(`wrote data/dpd/${sutta}/grammar.json`);
