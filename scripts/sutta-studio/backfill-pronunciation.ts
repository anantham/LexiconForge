#!/usr/bin/env npx tsx
/**
 * Backfill PaliWord.pronunciation for every word in demoPacket.json that
 * doesn't already have one — using the deterministic syllabifier post-pass.
 *
 * Idempotent: words with hand-curated pronunciation are left alone. Re-running
 * only affects words that have been added since the last run.
 *
 * Usage:
 *   tsx scripts/sutta-studio/backfill-pronunciation.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { syllabifyPaliWord } from '../../services/sutta-studio/postPasses/syllabify';

// ─────────────────────────────────────────────────────────────────────────────
// HALT (integrity scan 2026-07): DO NOT RUN.
// This May-era one-off targeted components/sutta-studio/demoPacket.json, which
// was DELETED 2026-05-19 — its content moved to content/references/sutta/mn10.json
// and has been HAND-CURATED since. Re-pointing this backfill at the curated
// flagship packet would write algorithmic pronunciations into adjudicated data.
// Do not repoint or re-enable without re-adjudicating the transform.
// ─────────────────────────────────────────────────────────────────────────────
const HALTED = true as boolean; // branch form so tsc keeps type-checking the code below
if (HALTED) {
  console.error(
    'HALTED: backfill-pronunciation.ts is a May-era one-off whose target ' +
      '(components/sutta-studio/demoPacket.json) was deleted 2026-05-19. The packet now lives at ' +
      'content/references/sutta/mn10.json and is hand-curated — this transform must not run against ' +
      'it without re-adjudication. See the HALT comment at the top of this file.'
  );
  process.exit(1);
}

const PACKET_PATH = path.resolve('components/sutta-studio/demoPacket.json');

const packet = JSON.parse(fs.readFileSync(PACKET_PATH, 'utf-8'));

let added = 0;
let skipped = 0;
let alreadyHad = 0;
const examples: Array<{ surface: string; pronunciation: string }> = [];

for (const ph of packet.phases ?? []) {
  for (const w of ph.paliWords ?? []) {
    if (w.pronunciation) {
      alreadyHad++;
      continue;
    }
    const surface = (w.segments ?? []).map((s: any) => s.text).join('');
    if (!surface) {
      skipped++;
      continue;
    }
    const algo = syllabifyPaliWord(surface);
    if (!algo || algo.length === 0) {
      skipped++;
      continue;
    }
    w.pronunciation = algo;
    added++;
    if (examples.length < 8) examples.push({ surface, pronunciation: algo });
  }
}

fs.writeFileSync(PACKET_PATH, JSON.stringify(packet, null, 2) + '\n');

console.log(`\nBackfill complete:`);
console.log(`  Already had pronunciation:  ${alreadyHad}`);
console.log(`  Newly populated:            ${added}`);
console.log(`  Skipped (empty surface):    ${skipped}`);
console.log(`\nSample of newly added:`);
for (const ex of examples) {
  console.log(`  ${ex.surface.padEnd(24)}  →  ${ex.pronunciation}`);
}
